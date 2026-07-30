import { DEFAULT_EPSILON } from '../../src/solver/constants.ts';
import { approxEqual, numbersApproxEqual } from '../../src/solver/linalg/numeric.ts';

export interface CompareOptions {
  epsilon?: number;
  path?: string;
}

export class ParityMismatchError extends Error {
  readonly path: string;

  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'ParityMismatchError';
    this.path = path;
  }
}

function joinPath(base: string, segment: string | number): string {
  if (typeof segment === 'number') {
    return base.length === 0 ? `[${String(segment)}]` : `${base}[${String(segment)}]`;
  }
  return base.length === 0 ? segment : `${base}.${segment}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function compareNumbers(
  actual: number,
  expected: number,
  path: string,
  epsilon: number,
): void {
  if (!approxEqual(actual, expected, epsilon)) {
    throw new ParityMismatchError(
      path,
      `expected ${String(expected)}, received ${String(actual)} (epsilon=${String(epsilon)})`,
    );
  }
}

function compareNumberArrays(
  actual: readonly number[],
  expected: readonly number[],
  path: string,
  epsilon: number,
): void {
  if (actual.length !== expected.length) {
    throw new ParityMismatchError(
      path,
      `array length mismatch: expected ${String(expected.length)}, received ${String(actual.length)}`,
    );
  }
  if (!numbersApproxEqual(actual, expected, epsilon)) {
    for (let index = 0; index < expected.length; index += 1) {
      const expectedValue = expected[index];
      const actualValue = actual[index];
      if (
        expectedValue !== undefined &&
        actualValue !== undefined &&
        !approxEqual(actualValue, expectedValue, epsilon)
      ) {
        throw new ParityMismatchError(
          joinPath(path, index),
          `expected ${String(expectedValue)}, received ${String(actualValue)}`,
        );
      }
    }
  }
}

function compareMatrices(
  actual: readonly (readonly number[])[],
  expected: readonly (readonly number[])[],
  path: string,
  epsilon: number,
): void {
  if (actual.length !== expected.length) {
    throw new ParityMismatchError(path, 'matrix row count mismatch');
  }
  for (let row = 0; row < expected.length; row += 1) {
    compareNumberArrays(actual[row] ?? [], expected[row] ?? [], joinPath(path, row), epsilon);
  }
}

function compareTableauCells(
  actual: readonly (readonly string[])[],
  expected: readonly (readonly string[])[],
  path: string,
): void {
  if (actual.length !== expected.length) {
    throw new ParityMismatchError(path, 'tableau row count mismatch');
  }
  for (let row = 0; row < expected.length; row += 1) {
    const expectedRow = expected[row] ?? [];
    const actualRow = actual[row] ?? [];
    if (expectedRow.length !== actualRow.length) {
      throw new ParityMismatchError(joinPath(path, row), 'tableau column count mismatch');
    }
    for (let col = 0; col < expectedRow.length; col += 1) {
      if (expectedRow[col] !== actualRow[col]) {
        throw new ParityMismatchError(
          joinPath(joinPath(path, row), col),
          `expected ${JSON.stringify(expectedRow[col])}, received ${JSON.stringify(actualRow[col])}`,
        );
      }
    }
  }
}

function isNumberArray(value: readonly unknown[]): value is number[] {
  return value.every((item) => typeof item === 'number');
}

function isNumericMatrix(value: readonly unknown[]): value is readonly (readonly number[])[] {
  return value.every((row) => Array.isArray(row) && isNumberArray(row));
}

function isStringMatrix(value: readonly unknown[]): value is readonly (readonly string[])[] {
  return value.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === 'string'));
}

/**
 * Recursively compare parsed semantic values with numeric tolerance.
 */
export function assertSemanticParity(
  actual: unknown,
  expected: unknown,
  options: CompareOptions = {},
): void {
  const epsilon = options.epsilon ?? DEFAULT_EPSILON;
  const path = options.path ?? '';
  compareSemantic(actual, expected, path, epsilon);
}

function compareSemantic(actual: unknown, expected: unknown, path: string, epsilon: number): void {
  if (actual === expected) {
    return;
  }

  if (typeof actual === 'number' && typeof expected === 'number') {
    compareNumbers(actual, expected, path, epsilon);
    return;
  }

  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (isNumberArray(actual) && isNumberArray(expected)) {
      compareNumberArrays(actual, expected, path, epsilon);
      return;
    }
    if (isNumericMatrix(actual) && isNumericMatrix(expected)) {
      compareMatrices(actual, expected, path, epsilon);
      return;
    }
    if (isStringMatrix(actual) && isStringMatrix(expected)) {
      compareTableauCells(actual, expected, path);
      return;
    }
    if (actual.length !== expected.length) {
      throw new ParityMismatchError(
        path,
        `array length mismatch: expected ${String(expected.length)}, received ${String(actual.length)}`,
      );
    }
    for (let index = 0; index < expected.length; index += 1) {
      compareSemantic(actual[index], expected[index], joinPath(path, index), epsilon);
    }
    return;
  }

  if (isPlainObject(actual) && isPlainObject(expected)) {
    const keys = [...new Set([...Object.keys(actual), ...Object.keys(expected)])].sort();
    for (const key of keys) {
      if (!(key in expected)) {
        if (actual[key] === undefined) {
          continue;
        }
        throw new ParityMismatchError(joinPath(path, key), 'unexpected key in actual value');
      }
      if (!(key in actual)) {
        throw new ParityMismatchError(joinPath(path, key), 'missing key in actual value');
      }
      compareSemantic(actual[key], expected[key], joinPath(path, key), epsilon);
    }
    return;
  }

  throw new ParityMismatchError(
    path,
    `values differ: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
  );
}

export function tryAssertSemanticParity(
  actual: unknown,
  expected: unknown,
  options: CompareOptions = {},
): ParityMismatchError | null {
  try {
    assertSemanticParity(actual, expected, options);
    return null;
  } catch (error) {
    if (error instanceof ParityMismatchError) {
      return error;
    }
    throw error;
  }
}
