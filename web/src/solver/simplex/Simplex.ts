import {
  Constraint,
  normalizeConstraintRhs,
} from '../algebra/Constraint.ts';
import { Expression } from '../algebra/Expression.ts';
import { Variable, variableSequence } from '../algebra/Variable.ts';
import { DEFAULT_EPSILON, DEFAULT_MAX_ITERATIONS } from '../constants.ts';
import {
  BaseAlreadySetError,
  BoundlessError,
  CycleError,
  InvalidBaseError,
  IterationLimitError,
  NumericalFailureError,
  UnsolvableError,
} from '../errors/LpError.ts';
import { DenseMatrix } from '../linalg/DenseMatrix.ts';
import { ftoa } from '../format/ftoa.ts';
import { Tableau } from '../tableau/Tableau.ts';
import {
  basisKey,
  buildCoefficientMatrix,
  buildObjectiveVector,
  cleanNearZeroArray,
  cleanNearZeroMatrix,
  cloneVariables,
  copy1d,
  copy2d,
  ensureFiniteArray,
  ensureNoNaN,
  indexOfVariable,
  type LpResult,
  vectorDot,
  zeros1d,
  zeros2d,
} from './arrayMath.ts';
import type { LpStep } from './types.ts';
import {
  applySimplexPivot,
  ensureFinite,
  isNegative,
  isPositive,
  isZero,
  type PivotState,
} from './pivot.ts';

export { DEFAULT_EPSILON, DEFAULT_MAX_ITERATIONS } from '../constants.ts';

export interface SimplexOptions {
  vs?: Variable[];
  bvs?: Variable[];
  maximize?: boolean;
  slackVarGenerator?: Iterator<Variable>;
  slackVarPrefix?: string;
  epsilon?: number;
  maxIterations?: number;
  autoTwoPhase?: boolean;
}

export class Simplex {
  target: Expression;
  constraints: Constraint[];
  variables: Variable[];
  baseVars: Variable[] | null;
  maximize: boolean;
  slackVarGenerator: Iterator<Variable>;
  result: LpResult | null;
  epsilon: number;
  maxIterations: number;
  autoTwoPhase: boolean;

  private numSlackVars = 0;
  private rhsNormalized = false;
  private slackCanonicalized = false;
  private phaseOneDone = false;

  constructor(target: Expression, constraints: Constraint[], options: SimplexOptions = {}) {
    this.epsilon = Simplex.validateEpsilon(options.epsilon ?? DEFAULT_EPSILON);
    this.maxIterations = Simplex.validateMaxIterations(options.maxIterations ?? DEFAULT_MAX_ITERATIONS);
    this.autoTwoPhase = Simplex.validateAutoTwoPhase(options.autoTwoPhase ?? true);
    this.target = target;
    this.constraints = [...constraints];
    this.baseVars = options.bvs === undefined ? null : [...options.bvs];
    this.maximize = options.maximize ?? false;
    this.slackVarGenerator =
      options.slackVarGenerator ?? variableSequence(options.slackVarPrefix ?? 's');
    this.result = null;

    if (options.vs === undefined) {
      const variableSet = new Map<string, Variable>();
      for (const constraint of constraints) {
        for (const variable of constraint.variables) {
          variableSet.set(variable.name, variable);
        }
      }
      this.variables = [...variableSet.values()].sort((left, right) =>
        left.name.localeCompare(right.name),
      );
    } else {
      this.variables = [...options.vs];
    }
  }

  static validateEpsilon(epsilon: number): number {
    if (!Number.isFinite(epsilon)) {
      throw new Error('epsilon must be finite');
    }
    if (epsilon <= 0) {
      throw new Error('epsilon must be positive');
    }
    return epsilon;
  }

  static validateMaxIterations(maxIterations: number): number {
    if (typeof maxIterations === 'boolean') {
      throw new Error('max_iterations must be a positive integer');
    }
    if (!Number.isInteger(maxIterations)) {
      throw new Error('max_iterations must be a positive integer');
    }
    if (maxIterations <= 0) {
      throw new Error('max_iterations must be a positive integer');
    }
    return maxIterations;
  }

  static validateAutoTwoPhase(autoTwoPhase: boolean): boolean {
    if (typeof autoTwoPhase !== 'boolean') {
      throw new Error('auto_two_phase must be a boolean');
    }
    return autoTwoPhase;
  }

  requiresPhaseOne(): boolean {
    if (this.phaseOneDone) {
      return false;
    }
    if (this.baseVars !== null) {
      return false;
    }
    this.ensureNormalizedRhs();
    this.canonicalize();
    const m = this.constraints.length;
    if (m <= 0) {
      return false;
    }
    return this.numSlackVars !== m;
  }

  setBaseVars(baseVars: Variable[] | null): void {
    this.baseVars = baseVars === null ? null : [...baseVars];
  }

  canonicalize(): number {
    this.ensureNormalizedRhs();
    if (this.slackCanonicalized) {
      return this.numSlackVars;
    }
    for (const constraint of this.constraints) {
      if (!constraint.isCanonical) {
        this.numSlackVars += 1;
        const next = this.slackVarGenerator.next();
        if (next.done) {
          throw new NumericalFailureError('slack variable generator exhausted');
        }
        const slackVar = next.value;
        constraint.canonicalize(slackVar);
        this.variables.push(slackVar);
      }
    }
    this.slackCanonicalized = true;
    return this.numSlackVars;
  }

  *twoPhase(
    yieldInitialTableau = false,
    precision: number | null = null,
    artificialVarPrefix = 'u',
  ): Generator<LpStep, void, undefined> {
    this.prepare(false);
    if (this.baseVars !== null) {
      throw new BaseAlreadySetError('base variables already set');
    }
    this.phaseOneDone = false;

    const artificialVars = [...variableSequence(artificialVarPrefix, this.constraints.length)];
    const baseVars = cloneVariables(artificialVars);
    const variables = [...this.variables, ...artificialVars];
    const m = this.constraints.length;

    const phaseConstraints = this.constraints.map((constraint, index) => {
      const artificial = artificialVars[index];
      if (artificial === undefined) {
        throw new NumericalFailureError('missing artificial variable');
      }
      const coefs = new Map(constraint.coefficients);
      coefs.set(artificial, 1);
      return new Constraint(coefs, constraint.rhs, constraint.operator);
    });

    const artificialObjective = new Expression(
      artificialVars.map((variable): [Variable, number] => [variable, 1]),
    );
    const initialized = this.initMatrices(phaseConstraints, variables, artificialObjective, baseVars);
    const { data, sigma, rhs } = initialized;
    let z = initialized.z;
    const baseVarMemo = new Set<string>([basisKey(baseVars)]);
    let pivotCount = 0;

    if (yieldInitialTableau) {
      yield this.makeStep(data, sigma, rhs, z, variables, baseVars, precision, null, null);
    }

    /* eslint-disable @typescript-eslint/no-unnecessary-condition -- simplex pivot loops */
    while (true) {
      const enterIndex = this.selectEnteringVar(sigma.slice(0, sigma.length - m), false);
      if (enterIndex === null) {
        break;
      }
      this.checkPivotLimit('Phase I', pivotCount);
      const ratioResult = this.primalRatioTest(data, rhs, enterIndex);
      if (ratioResult.leaveIndex === null) {
        throw new BoundlessError('unbounded problem');
      }
      const leaveVar = baseVars[ratioResult.leaveIndex];
      if (leaveVar === undefined) {
        throw new NumericalFailureError('missing leave variable');
      }
      const state: PivotState = { data, sigma, rhs };
      const pivotRatio = applySimplexPivot(state, enterIndex, ratioResult.leaveIndex, m, this.epsilon);
      z -= (rhs[ratioResult.leaveIndex] ?? 0) * pivotRatio;
      const entering = variables[enterIndex];
      if (entering === undefined) {
        throw new NumericalFailureError('missing entering variable');
      }
      baseVars[ratioResult.leaveIndex] = entering;
      pivotCount += 1;

      yield this.makeStep(data, sigma, rhs, z, variables, baseVars, precision, entering, leaveVar);
      this.checkCycle(baseVars, baseVarMemo);
    }
    /* eslint-enable @typescript-eslint/no-unnecessary-condition */

    if (!isZero(z, this.epsilon) || rhs.some((value) => isNegative(value, this.epsilon))) {
      throw new UnsolvableError('cannot find feasible solution');
    }

    const removedConstraints: Constraint[] = [];
    for (const artificial of artificialVars) {
      const basisIndex = baseVars.findIndex((variable) => variable.name === artificial.name);
      if (basisIndex >= 0) {
        const removed = this.constraints.splice(basisIndex, 1)[0];
        if (removed !== undefined) {
          removedConstraints.push(removed);
        }
        baseVars.splice(basisIndex, 1);
      }
    }
    this.setBaseVars(baseVars);
    this.phaseOneDone = true;

    const cT = buildObjectiveVector(this.target, this.variables);
    const x = zeros1d(this.variables.length);
    for (let index = 0; index < baseVars.length; index += 1) {
      const baseVar = baseVars[index];
      const value = rhs[index];
      if (baseVar !== undefined && value !== undefined) {
        x[indexOfVariable(this.variables, baseVar)] = value;
      }
    }

    const varValues = new Map<Variable, number>(this.variables.map((variable) => [variable, 0]));
    for (let index = 0; index < baseVars.length; index += 1) {
      const baseVar = baseVars[index];
      const value = rhs[index];
      if (baseVar !== undefined && value !== undefined) {
        varValues.set(baseVar, value);
      }
    }
    for (const artificial of artificialVars) {
      varValues.delete(artificial);
    }

    this.result = {
      targetValue: vectorDot(cT, x),
      variableValues: varValues,
      baseVariables: cloneVariables(baseVars),
      precision,
      extraData: {
        removed_constraints: removedConstraints,
        formatted_removed_constraints: removedConstraints.map((constraint) => ({
          coefficients: Object.fromEntries(
            [...constraint.coefficients.entries()].map(([variable, coef]) => [variable.name, ftoa(coef, precision)]),
          ),
          rhs: ftoa(constraint.rhs, precision),
          operator: constraint.operator,
        })),
      },
    };
  }

  *solve(yieldInitialTableau = false, precision: number | null = null): Generator<LpStep, void, undefined> {
    if (this.autoTwoPhase && this.requiresPhaseOne()) {
      yield* this.twoPhase(yieldInitialTableau, precision);
    }

    if (!this.phaseOneDone) {
      this.prepare(true);
    } else {
      this.preparePhaseTwo();
    }

    const m = this.constraints.length;
    if (this.baseVars === null) {
      throw new InvalidBaseError('cannot determine base variables');
    }

    const initialized = this.initMatrices(this.constraints, this.variables, this.target, this.baseVars);
    const { data, sigma, rhs } = initialized;
    let z = initialized.z;
    const baseVars = this.baseVars;
    const baseVarMemo = new Set<string>([basisKey(baseVars)]);
    let pivotCount = 0;

    if (yieldInitialTableau) {
      yield this.makeStep(data, sigma, rhs, z, this.variables, baseVars, precision, null, null);
    }

    /* eslint-disable @typescript-eslint/no-unnecessary-condition -- simplex pivot loops */
    while (true) {
      const enterIndex = this.selectEnteringVar(sigma, this.maximize);
      if (enterIndex === null) {
        break;
      }
      this.checkPivotLimit('Phase II', pivotCount);
      const ratioResult = this.primalRatioTest(data, rhs, enterIndex);
      if (ratioResult.leaveIndex === null) {
        throw new BoundlessError('unbounded problem');
      }
      const leaveVar = baseVars[ratioResult.leaveIndex];
      if (leaveVar === undefined) {
        throw new NumericalFailureError('missing leave variable');
      }
      const state: PivotState = { data, sigma, rhs };
      const pivotRatio = applySimplexPivot(state, enterIndex, ratioResult.leaveIndex, m, this.epsilon);
      z -= (rhs[ratioResult.leaveIndex] ?? 0) * pivotRatio;
      const entering = this.variables[enterIndex];
      if (entering === undefined) {
        throw new NumericalFailureError('missing entering variable');
      }
      baseVars[ratioResult.leaveIndex] = entering;
      pivotCount += 1;

      yield this.makeStep(data, sigma, rhs, z, this.variables, baseVars, precision, entering, leaveVar);
      this.checkCycle(baseVars, baseVarMemo);
    }
    /* eslint-enable @typescript-eslint/no-unnecessary-condition */

    baseVarMemo.clear();
    /* eslint-disable @typescript-eslint/no-unnecessary-condition -- dual repair loop */
    while (true) {
      const leaveIndex = this.selectLeavingVar(rhs);
      if (leaveIndex === null) {
        break;
      }
      this.checkPivotLimit('Phase II dual repair', pivotCount);
      const leaveVar = baseVars[leaveIndex];
      if (leaveVar === undefined) {
        throw new NumericalFailureError('missing leave variable');
      }
      const leaveRow = data[leaveIndex];
      if (leaveRow === undefined) {
        throw new NumericalFailureError('missing leave row');
      }
      const enterable = leaveRow.map((value) => isNegative(value, this.epsilon));
      if (!enterable.some(Boolean)) {
        throw new UnsolvableError(`cannot make "${leaveVar.name}" leave base`);
      }
      const ratios = leaveRow.map((value, index) =>
        enterable[index] ? (sigma[index] ?? 0) / value : Number.POSITIVE_INFINITY,
      );
      ensureNoNaN(ratios, 'dual ratio test produced non-finite values');
      let enterIndex = 0;
      let best = Math.abs(ratios[0] ?? Number.POSITIVE_INFINITY);
      for (let index = 1; index < ratios.length; index += 1) {
        const candidate = Math.abs(ratios[index] ?? Number.POSITIVE_INFINITY);
        if (candidate < best) {
          best = candidate;
          enterIndex = index;
        }
      }

      const pivot = ensureFinite(leaveRow[enterIndex] ?? Number.NaN, 'dual pivot element is not finite');
      if (isZero(pivot, this.epsilon)) {
        throw new NumericalFailureError('dual pivot element is too close to zero');
      }

      rhs[leaveIndex] = (rhs[leaveIndex] ?? 0) / pivot;
      for (let col = 0; col < leaveRow.length; col += 1) {
        leaveRow[col] = (leaveRow[col] ?? 0) / pivot;
      }
      for (let row = 0; row < m; row += 1) {
        if (row === leaveIndex) {
          continue;
        }
        const targetRow = data[row];
        if (targetRow === undefined) {
          continue;
        }
        const entry = targetRow[enterIndex] ?? 0;
        if (isZero(entry, this.epsilon)) {
          continue;
        }
        rhs[row] = (rhs[row] ?? 0) - (rhs[leaveIndex] ?? 0) * entry;
        for (let col = 0; col < targetRow.length; col += 1) {
          targetRow[col] = (targetRow[col] ?? 0) - (leaveRow[col] ?? 0) * entry;
        }
      }
      const pivotEntry = ensureFinite(leaveRow[enterIndex] ?? Number.NaN, 'normalized dual pivot element is not finite');
      const ratio = ensureFinite((sigma[enterIndex] ?? 0) / pivotEntry, 'dual sigma update ratio is not finite');
      for (let col = 0; col < sigma.length; col += 1) {
        sigma[col] = (sigma[col] ?? 0) - (leaveRow[col] ?? 0) * ratio;
      }
      z = ensureFinite(z - (rhs[leaveIndex] ?? 0) * ratio, 'objective value is not finite after dual pivot');
      cleanNearZeroMatrix(data, this.epsilon);
      cleanNearZeroArray(sigma, this.epsilon);
      cleanNearZeroArray(rhs, this.epsilon);
      ensureFiniteArray(data.flat(), 'tableau became non-finite after dual pivot');
      ensureFiniteArray(sigma, 'reduced costs became non-finite after dual pivot');
      ensureFiniteArray(rhs, 'rhs became non-finite after dual pivot');

      const entering = this.variables[enterIndex];
      if (entering === undefined) {
        throw new NumericalFailureError('missing entering variable');
      }
      baseVars[leaveIndex] = entering;
      pivotCount += 1;

      yield this.makeStep(data, sigma, rhs, z, this.variables, baseVars, precision, entering, leaveVar);
      this.checkCycle(baseVars, baseVarMemo);
    }
    /* eslint-enable @typescript-eslint/no-unnecessary-condition */

    const varValues = new Map<Variable, number>(this.variables.map((variable) => [variable, 0]));
    for (let index = 0; index < baseVars.length; index += 1) {
      const baseVar = baseVars[index];
      const value = rhs[index];
      if (baseVar !== undefined && value !== undefined) {
        varValues.set(baseVar, value);
      }
    }

    this.result = {
      targetValue: -z,
      variableValues: varValues,
      baseVariables: cloneVariables(baseVars),
      precision,
    };
  }

  private makeStep(
    data: number[][],
    sigma: number[],
    rhs: number[],
    z: number,
    variables: Variable[],
    baseVars: Variable[],
    precision: number | null,
    enter: Variable | null,
    leave: Variable | null,
  ): LpStep {
    return {
      tableau: new Tableau(
        copy2d(data),
        copy1d(sigma),
        copy1d(rhs),
        z,
        cloneVariables(variables),
        cloneVariables(baseVars),
        precision,
      ),
      enter,
      leave,
    };
  }

  private ensureNormalizedRhs(): void {
    if (this.rhsNormalized) {
      return;
    }
    this.constraints = this.constraints.map((constraint) => normalizeConstraintRhs(constraint));
    this.rhsNormalized = true;
  }

  private prepare(needBaseVars: boolean): void {
    this.canonicalize();
    const m = this.constraints.length;
    if (m <= 0) {
      throw new UnsolvableError('constraints is empty');
    }
    if (!needBaseVars) {
      return;
    }
    if (this.baseVars === null) {
      if (this.numSlackVars === m) {
        this.baseVars = this.variables.slice(-m);
      } else {
        throw new InvalidBaseError('cannot determine base variables');
      }
    } else if (this.baseVars.length !== m) {
      throw new InvalidBaseError("number of base variables doesn't match number of constraints");
    }
  }

  private preparePhaseTwo(): void {
    this.ensureNormalizedRhs();
    const m = this.constraints.length;
    if (m <= 0) {
      throw new UnsolvableError('constraints is empty');
    }
    if (this.baseVars === null) {
      throw new InvalidBaseError('cannot determine base variables');
    }
    if (this.baseVars.length !== m) {
      throw new InvalidBaseError("number of base variables doesn't match number of constraints");
    }
    for (const baseVar of this.baseVars) {
      if (indexOfVariable(this.variables, baseVar) < 0) {
        throw new InvalidBaseError(`base variable ${baseVar.name} is not in the problem`);
      }
    }
  }

  private initMatrices(
    constraints: Constraint[],
    variables: Variable[],
    target: Expression,
    baseVars: Variable[],
  ): { data: number[][]; sigma: number[]; rhs: number[]; z: number } {
    const { a, b, m, n } = buildCoefficientMatrix(constraints, variables);
    const cT = buildObjectiveVector(target, variables);
    const baseIndices = baseVars.map((variable) => indexOfVariable(variables, variable));
    const nonBaseIndices = [...Array(n).keys()].filter((index) => !baseIndices.includes(index));

    const abRows = Array.from({ length: m }, (_, row) =>
      baseIndices.map((col) => a[row]?.[col] ?? 0),
    );
    const anRows = Array.from({ length: m }, (_, row) =>
      nonBaseIndices.map((col) => a[row]?.[col] ?? 0),
    );
    const ab = DenseMatrix.fromRows(abRows);
    const an = DenseMatrix.fromRows(anRows);
    const abInverse = ab.invert();
    const abInverseAn = abInverse.multiply(an);

    const data = zeros2d(m, n);
    for (let row = 0; row < m; row += 1) {
      const baseCol = baseIndices[row];
      const rowData = data[row];
      if (baseCol !== undefined && rowData !== undefined) {
        rowData[baseCol] = 1;
      }
    }
    for (let row = 0; row < m; row += 1) {
      const rowData = data[row];
      if (rowData === undefined) {
        continue;
      }
      for (let col = 0; col < nonBaseIndices.length; col += 1) {
        const targetCol = nonBaseIndices[col];
        if (targetCol !== undefined) {
          rowData[targetCol] = abInverseAn.at(row, col);
        }
      }
    }

    const cTB = baseIndices.map((index) => cT[index] ?? 0);
    const cTN = nonBaseIndices.map((index) => cT[index] ?? 0);
    const sigma = zeros1d(n);
    const abInverseAnRows = abInverseAn.toArray();
    for (let col = 0; col < nonBaseIndices.length; col += 1) {
      const targetIndex = nonBaseIndices[col];
      const column = abInverseAnRows.map((row) => row[col] ?? 0);
      if (targetIndex !== undefined) {
        sigma[targetIndex] = (cTN[col] ?? 0) - vectorDot(cTB, column);
      }
    }

    const rhs = abInverse.multiplyVector(b);
    let z = -vectorDot(cTB, rhs);
    cleanNearZeroMatrix(data, this.epsilon);
    cleanNearZeroArray(sigma, this.epsilon);
    cleanNearZeroArray(rhs, this.epsilon);
    z = ensureFinite(z, 'objective value is not finite after initialization');
    ensureFiniteArray(data.flat(), 'tableau is not finite after initialization');
    ensureFiniteArray(sigma, 'reduced costs are not finite after initialization');
    ensureFiniteArray(rhs, 'rhs is not finite after initialization');
    return { data, sigma, rhs, z };
  }

  private selectEnteringVar(sigma: readonly number[], maximize: boolean): number | null {
    const candidates: number[] = [];
    for (let index = 0; index < sigma.length; index += 1) {
      const value = sigma[index] ?? 0;
      if (maximize ? isPositive(value, this.epsilon) : isNegative(value, this.epsilon)) {
        candidates.push(index);
      }
    }
    return candidates.length > 0 ? (candidates[0] ?? null) : null;
  }

  private selectLeavingVar(rhs: readonly number[]): number | null {
    const candidates: number[] = [];
    for (let index = 0; index < rhs.length; index += 1) {
      if (isNegative(rhs[index] ?? 0, this.epsilon)) {
        candidates.push(index);
      }
    }
    return candidates.length > 0 ? (candidates[0] ?? null) : null;
  }

  private primalRatioTest(
    data: readonly (readonly number[])[],
    rhs: readonly number[],
    enterIndex: number,
  ): { leaveIndex: number | null; ratios: number[] } {
    const cols = data[0]?.length ?? 0;
    if (enterIndex < 0 || enterIndex >= cols) {
      throw new NumericalFailureError('entering column index out of bounds');
    }
    const pivotCol = data.map((row) => row[enterIndex] ?? 0);
    const ratios = pivotCol.map((value, index) =>
      isPositive(value, this.epsilon) ? (rhs[index] ?? 0) / value : Number.POSITIVE_INFINITY,
    );
    ensureNoNaN(ratios, 'ratio test produced non-finite values');
    if (!ratios.some((value) => Number.isFinite(value))) {
      return { leaveIndex: null, ratios };
    }
    let leaveIndex = 0;
    let best = ratios[0] ?? Number.POSITIVE_INFINITY;
    for (let index = 1; index < ratios.length; index += 1) {
      const candidate = ratios[index] ?? Number.POSITIVE_INFINITY;
      if (candidate < best) {
        best = candidate;
        leaveIndex = index;
      }
    }
    const pivot = ensureFinite(data[leaveIndex]?.[enterIndex] ?? Number.NaN, 'pivot element is not finite');
    if (isZero(pivot, this.epsilon)) {
      throw new NumericalFailureError('pivot element is too close to zero');
    }
    if (!isPositive(pivot, this.epsilon)) {
      return { leaveIndex: null, ratios };
    }
    return { leaveIndex, ratios };
  }

  private checkPivotLimit(phase: string, completedPivots: number): void {
    if (completedPivots >= this.maxIterations) {
      throw new IterationLimitError(
        `${phase} exceeded iteration limit after ${String(completedPivots)} pivots (max_iterations=${String(this.maxIterations)})`,
      );
    }
  }

  private checkCycle(baseVars: Variable[], memo: Set<string>): void {
    const key = basisKey(baseVars);
    if (memo.has(key)) {
      throw new CycleError('encountered cycle in simplex');
    }
    memo.add(key);
  }
}

export { applySimplexPivot } from './pivot.ts';
