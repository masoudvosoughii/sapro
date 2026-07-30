import { MAX_DIMENSION } from '../solver/constants.ts';
import type { ConstraintOperator, SolveConstraint, SolveRequest } from './types.ts';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export type ParsedSolveRequest = SolveRequest;

function parseNumber(value: unknown, label: string): number {
  if (typeof value === 'boolean' || typeof value !== 'number') {
    throw new ValidationError(`${label} must be a number`);
  }
  const number = value;
  if (!Number.isFinite(number)) {
    throw new ValidationError(`${label} must be finite`);
  }
  return number;
}

function validateDimensions(numVars: number, numConstraints: number): void {
  if (numVars < 1 || numVars > MAX_DIMENSION) {
    throw new ValidationError(`objective must contain between 1 and ${String(MAX_DIMENSION)} coefficients`);
  }
  if (numConstraints < 1 || numConstraints > MAX_DIMENSION) {
    throw new ValidationError(`constraints must contain between 1 and ${String(MAX_DIMENSION)} rows`);
  }
}

function isSupportedOperator(value: unknown): value is ConstraintOperator {
  return value === '<=' || value === '>=' || value === '==';
}

/**
 * Validate and normalize a coefficient-table solve request.
 * Matches ``parse_coefficient_request`` in Python without mutating input.
 */
export function parseCoefficientRequest(request: unknown): ParsedSolveRequest {
  if (typeof request !== 'object' || request === null || Array.isArray(request)) {
    throw new ValidationError('request body must be a JSON object');
  }

  const payload = request as Record<string, unknown>;
  const optimization = payload['optimization'];
  if (optimization !== 'max' && optimization !== 'min') {
    throw new ValidationError('optimization must be "max" or "min"');
  }

  const objective = payload['objective'];
  if (!Array.isArray(objective) || objective.length === 0) {
    throw new ValidationError('objective must be a non-empty array');
  }

  const constraints = payload['constraints'];
  if (!Array.isArray(constraints) || constraints.length === 0) {
    throw new ValidationError('constraints must be a non-empty array');
  }

  const numVars = objective.length;
  const numConstraints = constraints.length;
  validateDimensions(numVars, numConstraints);

  const parsedObjective = objective.map((value, index) =>
    parseNumber(value, `objective[${String(index)}]`),
  );

  const parsedConstraints: SolveConstraint[] = constraints.map((row, rowIndex) => {
    if (typeof row !== 'object' || row === null || Array.isArray(row)) {
      throw new ValidationError(`constraints[${String(rowIndex)}] must be an object`);
    }
    const constraint = row as Record<string, unknown>;
    const coefficients = constraint['coefficients'];
    if (!Array.isArray(coefficients)) {
      throw new ValidationError(`constraints[${String(rowIndex)}].coefficients must be an array`);
    }
    if (coefficients.length !== numVars) {
      throw new ValidationError(
        `constraints[${String(rowIndex)}] must contain ${String(numVars)} coefficients`,
      );
    }
    const operator = constraint['operator'];
    if (!isSupportedOperator(operator)) {
      throw new ValidationError(`constraints[${String(rowIndex)}].operator must be one of <=, >=, ==`);
    }
    if (!('rhs' in constraint)) {
      throw new ValidationError(`constraints[${String(rowIndex)}].rhs is required`);
    }
    return {
      coefficients: coefficients.map((value, colIndex) =>
        parseNumber(value, `constraints[${String(rowIndex)}].coefficients[${String(colIndex)}]`),
      ),
      operator,
      rhs: parseNumber(constraint['rhs'], `constraints[${String(rowIndex)}].rhs`),
    };
  });

  return {
    optimization,
    objective: parsedObjective,
    constraints: parsedConstraints,
  };
}
