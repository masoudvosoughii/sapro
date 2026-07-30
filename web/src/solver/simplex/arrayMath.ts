import type { Constraint } from '../algebra/Constraint.ts';
import type { Expression } from '../algebra/Expression.ts';
import type { Variable } from '../algebra/Variable.ts';

export interface FormattedConstraint {
  coefficients: Record<string, string>;
  rhs: string;
  operator: string;
}

export interface LpResultExtraData {
  removed_constraints?: Constraint[];
  formatted_removed_constraints?: FormattedConstraint[];
}

export interface LpResult {
  targetValue: number;
  variableValues: Map<Variable, number>;
  baseVariables: Variable[];
  precision: number | null;
  extraData?: LpResultExtraData;
}

export function indexOfVariable(variables: readonly Variable[], variable: Variable): number {
  return variables.findIndex((entry) => entry.name === variable.name);
}

export function basisKey(baseVars: readonly Variable[]): string {
  return baseVars
    .map((variable) => variable.name)
    .sort()
    .join('|');
}

export function cloneVariables(variables: readonly Variable[]): Variable[] {
  return variables.map((variable) => variable.clone());
}

export function zeros2d(rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, () => Array<number>(cols).fill(0));
}

export function zeros1d(length: number): number[] {
  return Array<number>(length).fill(0);
}

export function copy2d(matrix: readonly (readonly number[])[]): number[][] {
  return matrix.map((row) => [...row]);
}

export function copy1d(vector: readonly number[]): number[] {
  return [...vector];
}

export function cleanNearZeroArray(values: number[], epsilon: number): void {
  for (let index = 0; index < values.length; index += 1) {
    if (Math.abs(values[index] ?? 0) <= epsilon) {
      values[index] = 0;
    }
  }
}

export function cleanNearZeroMatrix(matrix: number[][], epsilon: number): void {
  for (const row of matrix) {
    cleanNearZeroArray(row, epsilon);
  }
}

export function buildCoefficientMatrix(
  constraints: readonly Constraint[],
  variables: readonly Variable[],
): { a: number[][]; b: number[]; m: number; n: number } {
  const m = constraints.length;
  const n = variables.length;
  const a = zeros2d(m, n);
  const b = zeros1d(m);
  for (let row = 0; row < m; row += 1) {
    const constraint = constraints[row];
    if (constraint === undefined) {
      continue;
    }
    for (const [variable, coef] of constraint.coefficients) {
      const col = indexOfVariable(variables, variable);
      if (col >= 0) {
        const rowValues = a[row];
        if (rowValues !== undefined) {
          rowValues[col] = coef;
        }
      }
    }
    b[row] = constraint.rhs;
  }
  return { a, b, m, n };
}

export function buildObjectiveVector(
  target: Expression,
  variables: readonly Variable[],
): number[] {
  const cT = zeros1d(variables.length);
  for (const [variable, coef] of target.coefficients) {
    const index = indexOfVariable(variables, variable);
    if (index >= 0) {
      cT[index] = coef;
    }
  }
  return cT;
}

export function matrixVectorMultiply(matrix: readonly (readonly number[])[], vector: readonly number[]): number[] {
  return matrix.map((row) =>
    row.reduce((sum, value, index) => sum + value * (vector[index] ?? 0), 0),
  );
}

export function vectorSubtract(left: readonly number[], right: readonly number[]): number[] {
  return left.map((value, index) => value - (right[index] ?? 0));
}

export function vectorDot(left: readonly number[], right: readonly number[]): number {
  return left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0);
}

export function ensureFiniteArray(values: readonly number[], message: string): void {
  for (const value of values) {
    if (!Number.isFinite(value)) {
      throw new Error(message);
    }
  }
}

export function ensureNoNaN(values: readonly number[], message: string): void {
  for (const value of values) {
    if (Number.isNaN(value)) {
      throw new Error(message);
    }
  }
}
