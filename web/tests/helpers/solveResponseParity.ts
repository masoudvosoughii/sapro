import { expect } from 'vitest';

import type { SolveResponse, SolveStep } from '../../src/api/types.ts';
import { DEFAULT_EPSILON } from '../../src/solver/constants.ts';
import { assertSemanticParity } from './parityCompare.ts';

function compareSteps(actual: readonly SolveStep[], expected: readonly SolveStep[]): void {
  expect(actual.length).toBe(expected.length);
  for (let index = 0; index < expected.length; index += 1) {
    const expectedStep = expected[index];
    const actualStep = actual[index];
    if (expectedStep === undefined || actualStep === undefined) {
      throw new Error(`missing step at index ${String(index)}`);
    }
    assertSemanticParity(actualStep.index, expectedStep.index, { path: `steps[${String(index)}].index` });
    assertSemanticParity(actualStep.phase, expectedStep.phase, { path: `steps[${String(index)}].phase` });
    assertSemanticParity(actualStep.enter, expectedStep.enter, { path: `steps[${String(index)}].enter` });
    assertSemanticParity(actualStep.leave, expectedStep.leave, { path: `steps[${String(index)}].leave` });
    if (expectedStep.phase_iteration !== undefined) {
      assertSemanticParity(actualStep.phase_iteration, expectedStep.phase_iteration, {
        path: `steps[${String(index)}].phase_iteration`,
      });
    } else {
      expect(actualStep.phase_iteration).toBeUndefined();
    }
    assertSemanticParity(actualStep.tableau, expectedStep.tableau, {
      path: `steps[${String(index)}].tableau`,
      epsilon: DEFAULT_EPSILON,
    });
  }
}

export function assertSolveResponseParity(actual: SolveResponse, expected: SolveResponse): void {
  assertSemanticParity(actual.ok, expected.ok);
  assertSemanticParity(actual.status, expected.status);

  if (!expected.ok) {
    if (!actual.ok) {
      assertSemanticParity(actual.error_type, expected.error_type);
      assertSemanticParity(actual.message, expected.message);
    }
    return;
  }

  if (!actual.ok) {
    throw new Error(`expected success but received ${actual.error_type}: ${actual.message}`);
  }

  assertSemanticParity(actual.status_label, expected.status_label);
  assertSemanticParity(actual.objective_value, expected.objective_value, { epsilon: DEFAULT_EPSILON });
  assertSemanticParity(actual.variable_values, expected.variable_values, { epsilon: DEFAULT_EPSILON });
  assertSemanticParity(actual.step_count, expected.step_count);
  assertSemanticParity(actual.phase_counts, expected.phase_counts);
  compareSteps(actual.steps, expected.steps);
}
