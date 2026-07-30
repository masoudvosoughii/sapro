import { NumericalFailureError } from '../errors/LpError.ts';
import { cleanNearZeroArray, cleanNearZeroMatrix, copy1d, copy2d, ensureFiniteArray } from './arrayMath.ts';

export interface PivotState {
  data: number[][];
  sigma: number[];
  rhs: number[];
}

export function isZero(value: number, epsilon: number): boolean {
  return Math.abs(value) <= epsilon;
}

export function isPositive(value: number, epsilon: number): boolean {
  return value > epsilon;
}

export function isNegative(value: number, epsilon: number): boolean {
  return value < -epsilon;
}

export function ensureFinite(value: number, message: string): number {
  if (!Number.isFinite(value)) {
    throw new NumericalFailureError(message);
  }
  return value;
}

/**
 * Apply a primal simplex pivot. Exported for deterministic numerical-failure tests.
 */
export function applySimplexPivot(
  state: PivotState,
  enterIndex: number,
  leaveIndex: number,
  m: number,
  epsilon: number,
): number {
  const { data, sigma, rhs } = state;
  if (!(leaveIndex >= 0 && leaveIndex < m && enterIndex >= 0 && enterIndex < (data[0]?.length ?? 0))) {
    throw new NumericalFailureError('pivot indices out of bounds');
  }

  const pivot = ensureFinite(data[leaveIndex]?.[enterIndex] ?? Number.NaN, 'pivot element is not finite');
  if (isZero(pivot, epsilon)) {
    throw new NumericalFailureError('pivot element is too close to zero');
  }
  if (!isPositive(pivot, epsilon)) {
    throw new NumericalFailureError('pivot element must be positive');
  }

  const leaveRow = data[leaveIndex];
  if (leaveRow === undefined) {
    throw new NumericalFailureError('pivot row missing');
  }

  rhs[leaveIndex] = (rhs[leaveIndex] ?? 0) / pivot;
  for (let col = 0; col < leaveRow.length; col += 1) {
    leaveRow[col] = (leaveRow[col] ?? 0) / pivot;
  }

  for (let row = 0; row < m; row += 1) {
    if (row === leaveIndex) {
      continue;
    }
    const targetRow = data[row];
    if (targetRow === undefined) {
      continue;
    }
    const entry = targetRow[enterIndex] ?? 0;
    if (isZero(entry, epsilon)) {
      continue;
    }
    rhs[row] = (rhs[row] ?? 0) - (rhs[leaveIndex] ?? 0) * entry;
    for (let col = 0; col < targetRow.length; col += 1) {
      targetRow[col] = (targetRow[col] ?? 0) - (leaveRow[col] ?? 0) * entry;
    }
  }

  const pivotEntry = ensureFinite(leaveRow[enterIndex] ?? Number.NaN, 'normalized pivot element is not finite');
  const ratio = ensureFinite((sigma[enterIndex] ?? 0) / pivotEntry, 'sigma update ratio is not finite');
  for (let col = 0; col < sigma.length; col += 1) {
    sigma[col] = (sigma[col] ?? 0) - (leaveRow[col] ?? 0) * ratio;
  }

  cleanNearZeroMatrix(data, epsilon);
  cleanNearZeroArray(sigma, epsilon);
  cleanNearZeroArray(rhs, epsilon);
  ensureFiniteArray(data.flat(), 'tableau became non-finite after pivot');
  ensureFiniteArray(sigma, 'reduced costs became non-finite after pivot');
  ensureFiniteArray(rhs, 'rhs became non-finite after pivot');
  return ratio;
}

export function clonePivotState(state: PivotState): PivotState {
  return {
    data: copy2d(state.data),
    sigma: copy1d(state.sigma),
    rhs: copy1d(state.rhs),
  };
}
