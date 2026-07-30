import { InvalidSlackError } from '../errors/LpError.ts';
import { Variable } from './Variable.ts';
import { Expression } from './Expression.ts';

export type OperatorType = '<=' | '>=' | '==';

const FLIPPED_OPERATOR: Record<OperatorType, OperatorType> = {
  '<=': '>=',
  '>=': '<=',
  '==': '==',
};

/** A linear equation or inequality constraint. */
export class Constraint {
  readonly rhs: number;
  private _operator: OperatorType;
  private readonly coefs: Map<Variable, number>;

  constructor(
    coefs: Map<Variable, number> | Array<[Variable, number]>,
    rhs: number,
    operator: OperatorType,
  ) {
    this.coefs = normalizeCoefficientInput(coefs);
    this.rhs = rhs;
    this._operator = operator;
  }

  get operator(): OperatorType {
    return this._operator;
  }

  get coefficients(): ReadonlyMap<Variable, number> {
    return this.coefs;
  }

  get variables(): ReadonlySet<Variable> {
    return new Set(this.coefs.keys());
  }

  get isCanonical(): boolean {
    return this.operator === '==';
  }

  /** Return a deep clone with copied coefficient map. */
  clone(): Constraint {
    return new Constraint(new Map(this.coefs), this.rhs, this.operator);
  }

  /**
   * Convert an inequality into an equation using a slack/surplus variable.
   * Mutates this constraint in place, matching Python semantics.
   */
  canonicalize(slackVar: Variable): void {
    if (this.coefs.has(slackVar)) {
      throw new InvalidSlackError('existing slack variable');
    }
    if (this._operator === '<=') {
      this.coefs.set(slackVar, 1);
      this._operator = '==';
    } else if (this._operator === '>=') {
      this.coefs.set(slackVar, -1);
      this._operator = '==';
    }
  }

  display(): string {
    return `${new Expression(this.coefs).display()} ${this._operator} ${String(this.rhs)}`;
  }
}

function normalizeCoefficientInput(
  coefs: Map<Variable, number> | Array<[Variable, number]>,
): Map<Variable, number> {
  const entries: Array<[Variable, number]> =
    coefs instanceof Map ? [...coefs.entries()] : coefs;

  const result = new Map<Variable, number>();
  for (const [variable, coef] of entries) {
    if (coef !== 0) {
      result.set(variable, coef);
    }
  }
  return result;
}

/**
 * Return an equivalent constraint with a nonnegative right-hand side.
 * Matches ``normalize_constraint_rhs`` in Python.
 */
export function normalizeConstraintRhs(constraint: Constraint): Constraint {
  if (constraint.rhs >= 0) {
    return constraint;
  }
  const coefs = new Map<Variable, number>();
  for (const [variable, coef] of constraint.coefficients) {
    coefs.set(variable, -coef);
  }
  return new Constraint(coefs, -constraint.rhs, FLIPPED_OPERATOR[constraint.operator]);
}

/** Build a constraint from a coefficient map. */
export function constraint(
  coefs: Map<Variable, number> | Array<[Variable, number]>,
  rhs: number,
  operator: OperatorType,
): Constraint {
  return new Constraint(coefs, rhs, operator);
}

export function le(lhs: Expression, rhs: number): Constraint {
  return new Constraint(new Map(lhs.coefficients), rhs, '<=');
}

export function ge(lhs: Expression, rhs: number): Constraint {
  return new Constraint(new Map(lhs.coefficients), rhs, '>=');
}

export function eq(lhs: Expression, rhs: number): Constraint {
  return new Constraint(new Map(lhs.coefficients), rhs, '==');
}
