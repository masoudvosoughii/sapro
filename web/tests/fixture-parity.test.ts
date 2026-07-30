import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { solveProblem } from '../src/api/solveProblem.ts';
import { parseCoefficientRequest } from '../src/api/validation.ts';
import type {
  ParityFixture,
  RepeatedSolveFixture,
  SolveResponse,
  SolveSuccessResponse,
} from '../src/api/types.ts';
import { solveParsedRequestWithOptions } from '../src/solver/solveParsedRequest.ts';
import {
  assertParityFixture,
  assertRepeatedSolveFixture,
} from './fixture-schema.ts';
import { assertSemanticParity, tryAssertSemanticParity } from './helpers/parityCompare.ts';
import { assertSolveResponseParity } from './helpers/solveResponseParity.ts';

const FIXTURES_DIR = join(import.meta.dirname, '..', 'fixtures');

function loadJson(fileName: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, fileName), 'utf8')) as unknown;
}

const FIXTURE_FILES = readdirSync(FIXTURES_DIR)
  .filter((fileName) => fileName.endsWith('.json') && !fileName.startsWith('_'))
  .sort();

function isParityFixture(value: unknown): value is ParityFixture {
  return typeof value === 'object' && value !== null && 'request' in value && 'response' in value;
}

function isRepeatedSolveFixture(value: unknown): value is RepeatedSolveFixture {
  return (
    typeof value === 'object' &&
    value !== null &&
    'request' in value &&
    'response_first' in value &&
    'response_second' in value
  );
}

describe('fixture-driven solver parity', () => {
  for (const fileName of FIXTURE_FILES) {
    it(`matches Python oracle for ${fileName}`, () => {
      const payload = loadJson(fileName);
      if (fileName === 'repeated_solve_readme.json') {
        assertRepeatedSolveFixture(payload);
        if (!isRepeatedSolveFixture(payload)) {
          throw new Error('invalid repeated solve fixture');
        }
        const fixture = payload;
        const first = solveProblem(fixture.request);
        const second = solveProblem(fixture.request);
        assertSolveResponseParity(first, fixture.response_first);
        assertSolveResponseParity(second, fixture.response_second);
        assertSemanticParity(first, second);
        return;
      }

      assertParityFixture(payload);
      if (!isParityFixture(payload)) {
        throw new Error('invalid parity fixture');
      }
      const fixture = payload;
      const actual =
        fileName === 'iteration_limit_readme.json'
          ? solveParsedRequestWithOptions(parseCoefficientRequest(fixture.request), { maxIterations: 2 })
          : solveProblem(fixture.request);
      assertSolveResponseParity(actual, fixture.response);
    });
  }
});

describe('readme fixture details', () => {
  it('returns the documented optimum', () => {
    const fixture = loadJson('readme.json') as ParityFixture;
    const actual = solveProblem(fixture.request);
    expect(actual.ok).toBe(true);
    if (!actual.ok) {
      return;
    }
    expect(actual.objective_value).toBeCloseTo(7, 9);
    expect(actual.variable_values['x1']).toBeCloseTo(1, 9);
    expect(actual.variable_values['x2']).toBeCloseTo(3, 9);
    expect(actual.step_count).toBe(3);
    expect(actual.phase_counts.phase_one).toBe(0);
    expect(actual.phase_counts.phase_two).toBe(3);
  });
});

describe('iteration limit fixture', () => {
  it('returns iteration_limit status when max_iterations is constrained internally', () => {
    const fixture = loadJson('iteration_limit_readme.json') as ParityFixture;
    const actual = solveParsedRequestWithOptions(parseCoefficientRequest(fixture.request), {
      maxIterations: 2,
    });
    expect(actual.ok).toBe(false);
    if (actual.ok) {
      return;
    }
    expect(actual.status).toBe('iteration_limit');
    expect(actual.error_type).toBe('IterationLimit');
    expect(actual.message).toContain('max_iterations=2');
  });
});

export function cloneRequest<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function assertSuccess(response: SolveResponse): asserts response is SolveSuccessResponse {
  expect(response.ok).toBe(true);
}

export function expectMismatchPath(actual: unknown, expected: unknown, path: string): void {
  const error = tryAssertSemanticParity(actual, expected);
  expect(error?.path).toBe(path);
}
