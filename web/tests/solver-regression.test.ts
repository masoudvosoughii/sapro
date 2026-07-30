import { describe, expect, it } from 'vitest';

import { solveProblem } from '../src/api/solveProblem.ts';
import { buildSimplexProblem } from '../src/solver/buildProblem.ts';
import { collectTaggedSteps } from '../src/solver/collectTaggedSteps.ts';
import { parseCoefficientRequest } from '../src/api/validation.ts';
import { InvalidBaseError } from '../src/solver/errors/LpError.ts';
import { solveParsedRequestWithOptions } from '../src/solver/solveParsedRequest.ts';

describe('solver regression scenarios', () => {
  it('solves bounded maximization', () => {
    const response = solveProblem({
      optimization: 'max',
      objective: [1, 2],
      constraints: [
        { coefficients: [1, 1], operator: '<=', rhs: 4 },
        { coefficients: [-2, 1], operator: '<=', rhs: 1 },
        { coefficients: [1, 0], operator: '<=', rhs: 3 },
      ],
    });
    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.objective_value).toBeCloseTo(7, 9);
  });

  it('solves minimization requiring Phase I', () => {
    const response = solveProblem({
      optimization: 'min',
      objective: [1, 1],
      constraints: [{ coefficients: [1, 1], operator: '>=', rhs: 4 }],
    });
    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.objective_value).toBeCloseTo(4, 9);
    expect(response.phase_counts.total).toBeGreaterThan(0);
  });

  it('solves equality and mixed operator problems', () => {
    const equality = solveProblem({
      optimization: 'max',
      objective: [1, 1],
      constraints: [{ coefficients: [1, 1], operator: '==', rhs: 4 }],
    });
    expect(equality.ok).toBe(true);
    if (equality.ok) {
      expect(equality.objective_value).toBeCloseTo(4, 9);
    }

    const mixed = solveProblem({
      optimization: 'max',
      objective: [1, 2],
      constraints: [
        { coefficients: [1, 0], operator: '<=', rhs: 4 },
        { coefficients: [0, 1], operator: '>=', rhs: 1 },
        { coefficients: [1, 1], operator: '==', rhs: 3 },
      ],
    });
    expect(mixed.ok).toBe(true);
    if (mixed.ok) {
      expect(mixed.objective_value).toBeCloseTo(6, 9);
    }
  });

  it('handles negative RHS normalization', () => {
    const response = solveProblem({
      optimization: 'max',
      objective: [1],
      constraints: [
        { coefficients: [1], operator: '>=', rhs: -5 },
        { coefficients: [1], operator: '<=', rhs: 3 },
      ],
    });
    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.objective_value).toBeCloseTo(3, 9);
  });

  it('reports infeasible and unbounded problems', () => {
    const infeasible = solveProblem({
      optimization: 'max',
      objective: [1, 1],
      constraints: [
        { coefficients: [1, 0], operator: '>=', rhs: 5 },
        { coefficients: [0, 1], operator: '>=', rhs: 5 },
        { coefficients: [1, 1], operator: '<=', rhs: 1 },
      ],
    });
    expect(infeasible.ok).toBe(false);
    if (!infeasible.ok) {
      expect(infeasible.status).toBe('infeasible');
    }

    const unbounded = solveProblem({
      optimization: 'max',
      objective: [1, 1],
      constraints: [
        { coefficients: [1, 0], operator: '>=', rhs: 1 },
        { coefficients: [0, 1], operator: '>=', rhs: 2 },
      ],
    });
    expect(unbounded.ok).toBe(false);
    if (!unbounded.ok) {
      expect(unbounded.status).toBe('unbounded');
    }
  });

  it('does not rerun Phase I after explicit twoPhase then solve', () => {
    const parsed = parseCoefficientRequest({
      optimization: 'max',
      objective: [1, 1],
      constraints: [{ coefficients: [1, 1], operator: '==', rhs: 4 }],
    });
    const problem = buildSimplexProblem(parsed);
    for (const _step of problem.twoPhase()) {
      void _step;
    }
    expect(problem.requiresPhaseOne()).toBe(false);
    for (const _step of problem.solve()) {
      void _step;
    }
    expect(problem.result?.targetValue).toBeCloseTo(4, 9);
  });

  it('raises InvalidBase when auto two-phase is disabled on equality', () => {
    const parsed = parseCoefficientRequest({
      optimization: 'max',
      objective: [1, 1],
      constraints: [{ coefficients: [1, 1], operator: '==', rhs: 4 }],
    });
    const problem = buildSimplexProblem(parsed);
    problem.autoTwoPhase = false;
    expect(() => collectTaggedSteps(problem)).toThrow(InvalidBaseError);
  });

  it('resets iteration budget between independent solves', () => {
    const parsed = parseCoefficientRequest({
      optimization: 'max',
      objective: [1, 2],
      constraints: [
        { coefficients: [1, 1], operator: '<=', rhs: 4 },
        { coefficients: [-2, 1], operator: '<=', rhs: 1 },
        { coefficients: [1, 0], operator: '<=', rhs: 3 },
      ],
    });
    const limited = solveParsedRequestWithOptions(parsed, { maxIterations: 2 });
    expect(limited.ok).toBe(false);
    const full = solveParsedRequestWithOptions(parsed, { maxIterations: 10_000 });
    expect(full.ok).toBe(true);
  });
});
