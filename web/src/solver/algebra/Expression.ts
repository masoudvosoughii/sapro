import { Variable } from './Variable.ts';

function formatCoefficient(variable: Variable, coef: number, isFirst: boolean): string {
  if (coef === 1) {
    return isFirst ? variable.name : `+ ${variable.name}`;
  }
  if (coef === -1) {
    return isFirst ? `-${variable.name}` : `- ${variable.name}`;
  }
  const magnitude = Math.abs(coef);
  if (isFirst) {
    return `${coef < 0 ? '-' : ''}${String(magnitude)}${variable.name}`;
  }
  const sign = coef < 0 ? '-' : '+';
  return `${sign} ${String(magnitude)}${variable.name}`;
}

/** A linear expression with at most one coefficient per variable. */
export class Expression {
  private readonly coefs: Map<Variable, number>;

  constructor(coefs: Map<Variable, number> | Array<[Variable, number]>) {
    this.coefs = new Map<Variable, number>();
    const entries = coefs instanceof Map ? [...coefs.entries()] : coefs;
    for (const [variable, coef] of entries) {
      if (coef !== 0) {
        this.coefs.set(variable, coef);
      }
    }
  }

  static single(variable: Variable, coef: number): Expression {
    return new Expression([[variable, coef]]);
  }

  get coefficients(): ReadonlyMap<Variable, number> {
    return this.coefs;
  }

  clone(): Expression {
    return new Expression(new Map(this.coefs));
  }

  display(): string {
    let first = true;
    let result = '';
    for (const [variable, coef] of this.coefs) {
      result += ` ${formatCoefficient(variable, coef, first)}`;
      first = false;
    }
    return result.trim();
  }

  neg(): Expression {
    const coefs = new Map<Variable, number>();
    for (const [variable, coef] of this.coefs) {
      coefs.set(variable, -coef);
    }
    return new Expression(coefs);
  }

  add(other: Expression): Expression {
    const coefs = new Map(this.coefs);
    for (const [variable, coef] of other.coefs) {
      const existing = coefs.get(variable);
      if (existing === undefined) {
        coefs.set(variable, coef);
      } else {
        const sum = existing + coef;
        if (sum === 0) {
          coefs.delete(variable);
        } else {
          coefs.set(variable, sum);
        }
      }
    }
    return new Expression(coefs);
  }

  sub(other: Expression): Expression {
    return this.add(other.neg());
  }

  mul(scalar: number): Expression {
    const coefs = new Map<Variable, number>();
    for (const [variable, coef] of this.coefs) {
      coefs.set(variable, coef * scalar);
    }
    return new Expression(coefs);
  }
}

export function variable(name: string): Variable {
  return new Variable(name);
}

export function coeff(variableRef: Variable, value: number): Expression {
  return Expression.single(variableRef, value);
}

export function add(
  left: Variable | Expression,
  right: Variable | Expression,
): Expression {
  const lhs = left instanceof Variable ? Expression.single(left, 1) : left;
  const rhs = right instanceof Variable ? Expression.single(right, 1) : right;
  return lhs.add(rhs);
}

export function sub(
  left: Variable | Expression,
  right: Variable | Expression,
): Expression {
  const lhs = left instanceof Variable ? Expression.single(left, 1) : left;
  const rhs = right instanceof Variable ? Expression.single(right, 1) : right;
  return lhs.sub(rhs);
}

export function mul(scalar: number, value: Variable | Expression): Expression {
  const expr = value instanceof Variable ? Expression.single(value, 1) : value;
  return expr.mul(scalar);
}

export function div(expr: Expression, scalar: number): Expression {
  return expr.mul(1 / scalar);
}

export function neg(value: Variable | Expression): Expression {
  const expr = value instanceof Variable ? Expression.single(value, 1) : value;
  return expr.neg();
}
