import { buildSimplexProblem } from '../solver/buildProblem.ts';
import { collectTaggedSteps, encodeStep } from '../solver/collectTaggedSteps.ts';
import { LpError } from '../solver/errors/LpError.ts';
import { toSolveErrorResponse } from '../solver/errors/transport.ts';
import type { ParsedSolveRequest } from '../api/validation.ts';
import type { SolveResponse } from '../api/types.ts';

export interface SolverRunOptions {
  maxIterations?: number;
}

/** Mirror export-script iteration-limit generation without changing the public API. */
export function solveParsedRequestWithOptions(
  request: ParsedSolveRequest,
  options: SolverRunOptions = {},
): SolveResponse {
  const problem = buildSimplexProblem(request);
  if (options.maxIterations !== undefined) {
    problem.maxIterations = options.maxIterations;
  }

  try {
    const { tagged, phaseCounts } = collectTaggedSteps(problem);
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
      steps: tagged.map(([step, phase, phaseIteration], index) =>
        encodeStep(index + 1, step, phase, phaseIteration),
      ),
    };
  } catch (error) {
    if (error instanceof LpError) {
      return toSolveErrorResponse(error);
    }
    throw error;
  }
}
