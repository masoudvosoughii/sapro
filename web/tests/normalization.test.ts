import { describe, expect, it } from 'vitest';

import {
  Constraint,
  coeff,
  le,
  normalizeConstraintRhs,
  variable,
} from '../src/solver/algebra/index.ts';

describe('constraint normalization', () => {
  it('leaves positive RHS constraints unchanged by reference', () => {
    const x1 = variable('x1');
    const original = le(coeff(x1, 1), 4);
    expect(normalizeConstraintRhs(original)).toBe(original);
  });

  it('flips negative <= constraints to >=', () => {
    const x1 = variable('x1');
    const original = le(coeff(x1, 1), -2);
    const normalized = normalizeConstraintRhs(original);

    expect(normalized).not.toBe(original);
    expect(normalized.operator).toBe('>=');
    expect(normalized.rhs).toBe(2);
    expect(normalized.coefficients.get(x1)).toBe(-1);
  });

  it('flips negative >= constraints to <=', () => {
    const x1 = variable('x1');
    const original = new Constraint([[x1, 1]], -5, '>=');
    const normalized = normalizeConstraintRhs(original);

    expect(normalized.operator).toBe('<=');
    expect(normalized.rhs).toBe(5);
    expect(normalized.coefficients.get(x1)).toBe(-1);
  });

  it('scales negative equalities while preserving operator', () => {
    const x1 = variable('x1');
    const original = new Constraint([[x1, 2]], -6, '==');
    const normalized = normalizeConstraintRhs(original);

    expect(normalized.operator).toBe('==');
    expect(normalized.rhs).toBe(6);
    expect(normalized.coefficients.get(x1)).toBe(-2);
  });

  it('does not mutate the source constraint', () => {
    const x1 = variable('x1');
    const original = le(coeff(x1, 1), -2);
    normalizeConstraintRhs(original);
    expect(original.operator).toBe('<=');
    expect(original.rhs).toBe(-2);
    expect(original.coefficients.get(x1)).toBe(1);
  });
});

describe('normalization idempotence', () => {
  it('returns the same object on the second normalization', () => {
    const x1 = variable('x1');
    const once = normalizeConstraintRhs(le(coeff(x1, 1), -2));
    const twice = normalizeConstraintRhs(once);
    expect(twice).toBe(once);
    expect(twice.rhs).toBe(2);
  });
});
