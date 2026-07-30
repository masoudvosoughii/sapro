import { describe, expect, it } from 'vitest';

import { solveProblem } from '../src/api/solveProblem.ts';
import { EXAMPLES } from '../src/ui/examples.ts';

describe('dual-repair regression (negative RHS path)', () => {
  const request = EXAMPLES['negative_rhs'];
  if (!request) {
    throw new Error('missing negative_rhs example');
  }

  const toSolveRequest = () => ({
    optimization: request.optimization,
    objective: [...request.objective],
    constraints: request.constraints.map((row) => ({
      coefficients: [...row.coefficients],
      operator: row.operator,
      rhs: row.rhs,
    })),
  });

  it('reaches optimal solution without numerical failure', () => {
    const response = solveProblem(toSolveRequest());

    expect(response.ok).toBe(true);
    if (!response.ok) {
      return;
    }

    expect(response.status).toBe('optimal');
    expect(response.objective_value).toBeCloseTo(3, 9);
    expect(response.variable_values['x1']).toBeCloseTo(3, 9);
  });

  it('returns stable repeated results', () => {
    const first = solveProblem(toSolveRequest());
    const second = solveProblem(toSolveRequest());

    expect(first).toEqual(second);
  });
});
