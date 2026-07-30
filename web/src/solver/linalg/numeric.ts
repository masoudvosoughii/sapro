import { DEFAULT_EPSILON } from '../constants.ts';
import { NumericalFailureError } from '../errors/LpError.ts';

/** Exact structural equality for integers (non-approximate). */
export function exactEqual(a: number, b: number): boolean {
  return a === b;
}

export function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

export function assertFiniteNumber(value: number, label = 'value'): number {
  if (!isFiniteNumber(value)) {
    throw new NumericalFailureError(`${label} must be finite`);
  }
  return value;
}

export function approxEqual(
  a: number,
  b: number,
  epsilon: number = DEFAULT_EPSILON,
): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  return Math.abs(a - b) <= epsilon;
}

export function approxZero(value: number, epsilon: number = DEFAULT_EPSILON): boolean {
  return Math.abs(value) <= epsilon;
}

export function numbersApproxEqual(
  left: readonly number[],
  right: readonly number[],
  epsilon: number = DEFAULT_EPSILON,
): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index];
    const b = right[index];
    if (a === undefined || b === undefined || !approxEqual(a, b, epsilon)) {
      return false;
    }
  }
  return true;
}

/** Normalize negative zero to positive zero for display comparisons. */
export function normalizeNegativeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}
