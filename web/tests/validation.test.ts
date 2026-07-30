import { describe, expect, it } from 'vitest';

import { solveProblem } from '../src/api/solveProblem.ts';
import { parseCoefficientRequest, ValidationError } from '../src/api/validation.ts';

const VALID_REQUEST = {
  optimization: 'max' as const,
  objective: [1, 2],
  constraints: [
    { coefficients: [1, 1], operator: '<=' as const, rhs: 4 },
    { coefficients: [-2, 1], operator: '<=' as const, rhs: 1 },
    { coefficients: [1, 0], operator: '<=' as const, rhs: 3 },
  ],
};

describe('parseCoefficientRequest', () => {
  it('accepts a valid request without mutating it', () => {
    const request = structuredClone(VALID_REQUEST);
    const parsed = parseCoefficientRequest(request);
    expect(parsed).toEqual(request);
    expect(parsed).not.toBe(request);
    expect(request).toEqual(VALID_REQUEST);
  });

  it('rejects missing optimization', () => {
    expect(() =>
      parseCoefficientRequest({ ...VALID_REQUEST, optimization: undefined }),
    ).toThrow(ValidationError);
  });

  it('rejects invalid operator', () => {
    expect(() =>
      parseCoefficientRequest({
        ...VALID_REQUEST,
        constraints: [{ coefficients: [1, 1], operator: '<', rhs: 4 }],
      }),
    ).toThrow(/operator must be one of <=, >=, ==/);
  });

  it('rejects mismatched coefficient dimensions', () => {
    expect(() =>
      parseCoefficientRequest({
        ...VALID_REQUEST,
        constraints: [{ coefficients: [1], operator: '<=', rhs: 4 }],
      }),
    ).toThrow(/must contain 2 coefficients/);
  });

  it.each(['nan', 'inf', '-inf'] as const)('rejects non-finite values (%s)', (kind) => {
    const value = kind === 'nan' ? Number.NaN : kind === 'inf' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    expect(() =>
      parseCoefficientRequest({
        ...VALID_REQUEST,
        objective: [value, 2],
      }),
    ).toThrow(/must be finite/);
  });

  it('rejects boolean objective values', () => {
    expect(() =>
      parseCoefficientRequest({
        ...VALID_REQUEST,
        objective: [true as unknown as number, 2],
      }),
    ).toThrow(/must be a number/);
  });

  it('rejects excessive dimensions', () => {
    expect(() =>
      parseCoefficientRequest({
        optimization: 'max',
        objective: Array(21).fill(1),
        constraints: [{ coefficients: Array(21).fill(1), operator: '<=', rhs: 1 }],
      }),
    ).toThrow(/between 1 and 20/);
  });
});

describe('validation error mapping through solveProblem', () => {
  it('returns invalid_input ValidationError envelope', () => {
    const response = solveProblem({
      ...VALID_REQUEST,
      constraints: [{ coefficients: [1], operator: '<=', rhs: 4 }],
    });
    expect(response.ok).toBe(false);
    if (response.ok) {
      return;
    }
    expect(response.status).toBe('invalid_input');
    expect(response.error_type).toBe('ValidationError');
  });
});
