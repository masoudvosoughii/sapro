import type { SolveRequest, SolveResponse } from './types.ts';

/**
 * Client-side solve entry point. Not wired to a solver in Checkpoint 1.
 */
export function solveProblem(request: SolveRequest): SolveResponse {
  void request;
  return {
    ok: false,
    status: 'error',
    error_type: 'NotImplementedError',
    message: 'TypeScript solver not implemented yet (Checkpoint 1 scaffold).',
  };
}
