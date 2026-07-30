import { buildSimplexProblem } from '../solver/buildProblem.ts';
import { collectTaggedSteps, encodeStep } from '../solver/collectTaggedSteps.ts';
import { parseCoefficientRequest, ValidationError } from './validation.ts';
import { LpError } from '../solver/errors/LpError.ts';
import {
  INTERNAL_ERROR_RESPONSE,
  toSolveErrorResponse,
} from '../solver/errors/transport.ts';
import type { SolveRequest, SolveResponse } from './types.ts';

function isLpError(error: unknown): error is LpError {
  return error instanceof LpError;
}

/**
 * Solve a coefficient-table request entirely in memory.
 */
export function solveProblem(request: SolveRequest): SolveResponse {
  try {
    const parsed = parseCoefficientRequest(request);
    const problem = buildSimplexProblem(parsed);

    let taggedSteps: ReturnType<typeof collectTaggedSteps>['tagged'];
    let phaseCounts: ReturnType<typeof collectTaggedSteps>['phaseCounts'];
    try {
      ({ tagged: taggedSteps, phaseCounts } = collectTaggedSteps(problem));
    } catch (error) {
      if (isLpError(error)) {
        return toSolveErrorResponse(error);
      }
      throw error;
    }

    const result = problem.result;
    if (result === null) {
      return {
        ok: false,
        status: 'error',
        error_type: 'SolverError',
        message: 'The solver did not produce a result.',
      };
    }

    const decisionValues: Record<string, number> = {};
    for (const [variable, value] of result.variableValues) {
      if (variable.name.startsWith('x')) {
        decisionValues[variable.name] = value;
      }
    }

    return {
      ok: true,
      status: 'optimal',
      status_label: 'Optimal solution found.',
      objective_value: result.targetValue,
      variable_values: decisionValues,
      step_count: phaseCounts.total,
      phase_counts: phaseCounts,
      steps: taggedSteps.map(([step, phase, phaseIteration], index) =>
        encodeStep(index + 1, step, phase, phaseIteration),
      ),
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      return {
        ok: false,
        status: 'invalid_input',
        error_type: 'ValidationError',
        message: error.message,
      };
    }
    if (isLpError(error)) {
      return toSolveErrorResponse(error);
    }
    return { ...INTERNAL_ERROR_RESPONSE };
  }
}
