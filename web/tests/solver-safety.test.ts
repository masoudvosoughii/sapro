import { describe, expect, it } from 'vitest';

import { solveProblem } from '../src/api/solveProblem.ts';
import { buildSimplexProblem } from '../src/solver/buildProblem.ts';
import { collectTaggedSteps } from '../src/solver/collectTaggedSteps.ts';
import { parseCoefficientRequest } from '../src/api/validation.ts';
import { applySimplexPivot, type PivotState } from '../src/solver/simplex/pivot.ts';
import { NumericalFailureError } from '../src/solver/errors/LpError.ts';
import { coeff, le, normalizeConstraintRhs, variable } from '../src/solver/algebra/index.ts';

function cloneRequest<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const README = {
  optimization: 'max' as const,
  objective: [1, 2],
  constraints: [
    { coefficients: [1, 1], operator: '<=' as const, rhs: 4 },
    { coefficients: [-2, 1], operator: '<=' as const, rhs: 1 },
    { coefficients: [1, 0], operator: '<=' as const, rhs: 3 },
  ],
};

describe('mutation and repeatability safety', () => {
  it('does not mutate the input request', () => {
    const request = cloneRequest(README);
    const before = JSON.stringify(request);
    solveProblem(request);
    expect(JSON.stringify(request)).toBe(before);
  });

  it('returns semantically equivalent results on repeated solves', () => {
    const first = solveProblem(cloneRequest(README));
    const second = solveProblem(cloneRequest(README));
    expect(first).toEqual(second);
  });

  it('does not leak slack generator state between independent solves', () => {
    const equality = {
      optimization: 'max' as const,
      objective: [1, 1],
      constraints: [{ coefficients: [1, 1], operator: '==' as const, rhs: 4 }],
    };
    const first = solveProblem(cloneRequest(equality));
    const second = solveProblem(cloneRequest(equality));
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) {
      return;
    }
    expect(first.objective_value).toBeCloseTo(4, 9);
    expect(second.objective_value).toBeCloseTo(4, 9);
  });
});

describe('tableau snapshot isolation', () => {
  it('deep-copies tableau snapshots across steps', () => {
    const problem = buildSimplexProblem(parseCoefficientRequest(README));
    const { tagged } = collectTaggedSteps(problem);
    const first = tagged[0]?.[0]?.tableau.toFrame();
    const last = tagged.at(-1)?.[0]?.tableau.toFrame();
    expect(first).toBeDefined();
    expect(last).toBeDefined();
    expect(first).not.toEqual(last);
  });
});

describe('near-zero pivot numerical failure', () => {
  it('raises NumericalFailure for a pivot element below epsilon', () => {
    const state: PivotState = {
      data: [[1e-12, 1]],
      sigma: [1, 0],
      rhs: [1],
    };
    expect(() => applySimplexPivot(state, 0, 0, 1, 1e-9)).toThrow(NumericalFailureError);
  });
});

describe('normalization reference preservation', () => {
  it('keeps positive-RHS constraints on the same object reference after normalization', () => {
    const x1 = variable('x1');
    const original = le(coeff(x1, 1), 4);
    expect(normalizeConstraintRhs(original)).toBe(original);
  });
});
