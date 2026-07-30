import type { SolveErrorResponse } from '../../api/types.ts';
import {
  BoundlessError,
  CycleError,
  InvalidBaseError,
  IterationLimitError,
  LpError,
  NumericalFailureError,
  UnsolvableError,
} from './LpError.ts';

export interface TransportErrorMapping {
  status: string;
  error_type: string;
  message: string;
}

/**
 * Map core solver errors to API/transport payloads.
 * Keeps transport concerns separate from solver error classes.
 */
export function mapLpErrorToTransport(error: LpError): TransportErrorMapping {
  if (error instanceof UnsolvableError) {
    return {
      status: 'infeasible',
      error_type: 'Unsolvable',
      message: 'The problem has no feasible solution.',
    };
  }
  if (error instanceof BoundlessError) {
    return {
      status: 'unbounded',
      error_type: 'Boundless',
      message: 'The problem is unbounded.',
    };
  }
  if (error instanceof CycleError) {
    return {
      status: 'cycle',
      error_type: 'Cycle',
      message: 'The simplex algorithm encountered a cycling basis.',
    };
  }
  if (error instanceof NumericalFailureError) {
    return {
      status: 'numerical_failure',
      error_type: 'NumericalFailure',
      message: 'The solver encountered a numerical failure.',
    };
  }
  if (error instanceof IterationLimitError) {
    return {
      status: 'iteration_limit',
      error_type: 'IterationLimit',
      message: error.message,
    };
  }
  if (error instanceof InvalidBaseError) {
    return {
      status: 'invalid_input',
      error_type: 'InvalidBase',
      message: 'A valid initial basis is not available.',
    };
  }
  return {
    status: 'error',
    error_type: error.name,
    message: error.message,
  };
}

export function toSolveErrorResponse(error: LpError): SolveErrorResponse {
  const mapped = mapLpErrorToTransport(error);
  return {
    ok: false,
    status: mapped.status,
    error_type: mapped.error_type,
    message: mapped.message,
  };
}

export const INTERNAL_ERROR_RESPONSE: SolveErrorResponse = {
  ok: false,
  status: 'internal_error',
  error_type: 'InternalError',
  message: 'An unexpected internal error occurred while solving the problem.',
};
