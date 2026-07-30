import type {
  ParityFixture,
  RepeatedSolveFixture,
  SolveRequest,
  SolveResponse,
  SolveStep,
  TableauFrame,
} from '../src/api/types.ts';

const CONSTRAINT_OPERATORS = new Set(['<=', '>=', '==']);
const OPTIMIZATION_VALUES = new Set(['max', 'min']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function assertSolveRequest(value: unknown): asserts value is SolveRequest {
  if (!isRecord(value)) {
    throw new Error('request must be an object');
  }
  if (!OPTIMIZATION_VALUES.has(String(value['optimization']))) {
    throw new Error('request.optimization must be "max" or "min"');
  }
  if (!Array.isArray(value['objective']) || !value['objective'].every(isFiniteNumber)) {
    throw new Error('request.objective must be a finite number array');
  }
  if (!Array.isArray(value['constraints'])) {
    throw new Error('request.constraints must be an array');
  }
  for (const constraint of value['constraints']) {
    if (!isRecord(constraint)) {
      throw new Error('each constraint must be an object');
    }
    if (!Array.isArray(constraint['coefficients']) || !constraint['coefficients'].every(isFiniteNumber)) {
      throw new Error('constraint.coefficients must be a finite number array');
    }
    if (!CONSTRAINT_OPERATORS.has(String(constraint['operator']))) {
      throw new Error('constraint.operator must be <=, >=, or ==');
    }
    if (!isFiniteNumber(constraint['rhs'])) {
      throw new Error('constraint.rhs must be a finite number');
    }
  }
}

function assertTableauFrame(value: unknown): asserts value is TableauFrame {
  if (!Array.isArray(value)) {
    throw new Error('tableau must be a 2-D string array');
  }
  for (const row of value) {
    if (!Array.isArray(row) || !row.every((cell) => typeof cell === 'string')) {
      throw new Error('tableau rows must contain only strings');
    }
  }
}

function assertSolveStep(value: unknown): asserts value is SolveStep {
  if (!isRecord(value)) {
    throw new Error('step must be an object');
  }
  if (!Number.isInteger(value['index']) || Number(value['index']) < 1) {
    throw new Error('step.index must be a positive integer');
  }
  if (!(value['enter'] === null || typeof value['enter'] === 'string')) {
    throw new Error('step.enter must be null or string');
  }
  if (!(value['leave'] === null || typeof value['leave'] === 'string')) {
    throw new Error('step.leave must be null or string');
  }
  assertTableauFrame(value['tableau']);
  if (typeof value['phase'] !== 'string') {
    throw new Error('step.phase must be a string');
  }
  if (
    value['phase_iteration'] !== undefined &&
    (!Number.isInteger(value['phase_iteration']) || Number(value['phase_iteration']) < 1)
  ) {
    throw new Error('step.phase_iteration must be a positive integer when present');
  }
}

export function assertSolveResponse(value: unknown): asserts value is SolveResponse {
  if (!isRecord(value)) {
    throw new Error('response must be an object');
  }
  if (typeof value['ok'] !== 'boolean') {
    throw new Error('response.ok must be boolean');
  }
  if (typeof value['status'] !== 'string') {
    throw new Error('response.status must be string');
  }

  if (value['ok']) {
    if (value['status'] !== 'optimal') {
      throw new Error('successful response status must be optimal');
    }
    if (typeof value['status_label'] !== 'string') {
      throw new Error('response.status_label must be string');
    }
    if (!isFiniteNumber(value['objective_value'])) {
      throw new Error('response.objective_value must be finite');
    }
    if (!isRecord(value['variable_values'])) {
      throw new Error('response.variable_values must be an object');
    }
    for (const [name, variableValue] of Object.entries(value['variable_values'])) {
      if (!name.startsWith('x')) {
        throw new Error(`decision variable name must start with x: ${name}`);
      }
      if (!isFiniteNumber(variableValue)) {
        throw new Error(`variable value for ${name} must be finite`);
      }
    }
    if (!Number.isInteger(value['step_count']) || Number(value['step_count']) < 0) {
      throw new Error('response.step_count must be a non-negative integer');
    }
    if (!isRecord(value['phase_counts'])) {
      throw new Error('response.phase_counts must be an object');
    }
    for (const key of ['phase_one', 'phase_two', 'total'] as const) {
      if (!Number.isInteger(value['phase_counts'][key]) || Number(value['phase_counts'][key]) < 0) {
        throw new Error(`response.phase_counts.${key} must be a non-negative integer`);
      }
    }
    if (!Array.isArray(value['steps'])) {
      throw new Error('response.steps must be an array');
    }
    for (const step of value['steps']) {
      assertSolveStep(step);
    }
    return;
  }

  if (typeof value['error_type'] !== 'string' || typeof value['message'] !== 'string') {
    throw new Error('error response must include error_type and message');
  }
}

export function assertParityFixture(value: unknown): asserts value is ParityFixture {
  if (!isRecord(value)) {
    throw new Error('fixture must be an object');
  }
  if (typeof value['name'] !== 'string' || value['name'].length === 0) {
    throw new Error('fixture.name must be a non-empty string');
  }
  assertSolveRequest(value['request']);
  assertSolveResponse(value['response']);
}

export function assertRepeatedSolveFixture(value: unknown): asserts value is RepeatedSolveFixture {
  if (!isRecord(value)) {
    throw new Error('repeated fixture must be an object');
  }
  if (typeof value['name'] !== 'string' || value['name'].length === 0) {
    throw new Error('repeated fixture.name must be a non-empty string');
  }
  assertSolveRequest(value['request']);
  assertSolveResponse(value['response_first']);
  assertSolveResponse(value['response_second']);
}
