import { describe, expect, it } from 'vitest';

import {
  Expression,
  Variable,
  VariablePool,
  add,
  coeff,
  eq,
  ge,
  le,
  mul,
  neg,
  sub,
  variable,
  variableSequence,
} from '../src/solver/algebra/index.ts';
import { InvalidSlackError } from '../src/solver/errors/LpError.ts';

describe('algebra construction', () => {
  it('creates variables and expressions with explicit builders', () => {
    const x1 = variable('x1');
    const x2 = variable('x2');
    const expr = add(x1, mul(2, x2));
    expect(expr.display()).toBe('x1 + 2x2');
    expect(neg(expr).display()).toBe('-x1 - 2x2');
  });

  it('builds constraints with comparison helpers', () => {
    const x1 = variable('x1');
    const x2 = variable('x2');
    const constraint = le(add(x1, mul(3, x2)), 10);
    expect(constraint.operator).toBe('<=');
    expect(constraint.rhs).toBe(10);
    expect(constraint.coefficients.get(x1)).toBe(1);
    expect(constraint.coefficients.get(x2)).toBe(3);
  });

  it('supports equality and greater-than-or-equal constraints', () => {
    const x1 = variable('x1');
    expect(eq(coeff(x1, 2), 6).operator).toBe('==');
    expect(ge(coeff(x1, 1), 4).operator).toBe('>=');
  });

  it('generates variable sequences', () => {
    const generated = [...variableSequence('x', 3, 2)];
    expect(generated.map((item) => item.name)).toEqual(['x2', 'x3', 'x4']);
  });

  it('reuses variables from a pool', () => {
    const pool = new VariablePool();
    expect(pool.get('x1')).toBe(pool.get('x1'));
    expect(pool.get('x1')).not.toBe(new Variable('x1'));
  });
});

describe('algebra cloning', () => {
  it('clones expressions and constraints without sharing mutable maps', () => {
    const x1 = variable('x1');
    const x2 = variable('x2');
    const original = le(add(x1, x2), 4);
    const cloned = original.clone();

    expect(cloned).not.toBe(original);
    expect(cloned.rhs).toBe(original.rhs);
    expect(cloned.operator).toBe(original.operator);
    expect(cloned.coefficients.get(x1)).toBe(1);

    const expr = new Expression([[x1, 3], [x2, -1]]);
    const exprClone = expr.clone();
    expect(exprClone.display()).toBe(expr.display());
    expect(exprClone).not.toBe(expr);
  });

  it('canonicalizes inequalities in place using slack variables', () => {
    const x1 = variable('x1');
    const slack = variable('s1');
    const constraint = le(coeff(x1, 2), 5);
    constraint.canonicalize(slack);

    expect(constraint.operator).toBe('==');
    expect(constraint.coefficients.get(slack)).toBe(1);
    expect(() => {
      constraint.canonicalize(slack);
    }).toThrow(InvalidSlackError);
  });

  it('subtracts expressions through explicit helpers', () => {
    const x1 = variable('x1');
    const x2 = variable('x2');
    expect(sub(add(x1, x2), coeff(x2, 1)).display()).toBe('x1');
  });
});
