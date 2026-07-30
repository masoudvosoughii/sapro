import { describe, expect, it } from 'vitest';

import { NumericalFailureError, SingularMatrixError } from '../src/solver/errors/LpError.ts';
import { DenseMatrix } from '../src/solver/linalg/DenseMatrix.ts';
import { approxEqual } from '../src/solver/linalg/numeric.ts';

describe('dense matrix operations', () => {
  it('validates matrix shape on construction', () => {
    expect(() => DenseMatrix.fromRows([[1, 2], [3]])).toThrow(NumericalFailureError);
  });

  it('multiplies matrices and vectors', () => {
    const left = DenseMatrix.fromRows([
      [1, 2],
      [3, 4],
    ]);
    const right = DenseMatrix.fromRows([
      [2, 0],
      [1, 2],
    ]);
    const product = left.multiply(right);
    expect(product.toArray()).toEqual([
      [4, 4],
      [10, 8],
    ]);
    expect(left.multiplyVector([1, 1])).toEqual([3, 7]);
  });

  it('multiplies by identity without changing values', () => {
    const matrix = DenseMatrix.fromRows([
      [2, -1],
      [0, 3],
    ]);
    const identity = DenseMatrix.identity(2);
    expect(matrix.multiply(identity).toArray()).toEqual(matrix.toArray());
    expect(identity.multiply(matrix).toArray()).toEqual(matrix.toArray());
  });

  it('extracts and replaces rows', () => {
    const matrix = DenseMatrix.fromRows([
      [1, 2],
      [3, 4],
    ]);
    expect(matrix.row(1)).toEqual([3, 4]);
    expect(matrix.column(0)).toEqual([1, 3]);
    matrix.replaceRow(0, [9, 8]);
    expect(matrix.row(0)).toEqual([9, 8]);
  });

  it('transposes matrices', () => {
    const matrix = DenseMatrix.fromRows([
      [1, 2, 3],
      [4, 5, 6],
    ]);
    expect(matrix.transpose().toArray()).toEqual([
      [1, 4],
      [2, 5],
      [3, 6],
    ]);
  });
});

describe('matrix inversion', () => {
  it('inverts a known 2x2 matrix', () => {
    const matrix = DenseMatrix.fromRows([
      [4, 7],
      [2, 6],
    ]);
    const inverse = matrix.invert();
    const identity = matrix.multiply(inverse);
    expect(identity.at(0, 0)).toBeCloseTo(1, 9);
    expect(identity.at(0, 1)).toBeCloseTo(0, 9);
    expect(identity.at(1, 0)).toBeCloseTo(0, 9);
    expect(identity.at(1, 1)).toBeCloseTo(1, 9);
  });

  it('uses row swapping during inversion when needed', () => {
    const matrix = DenseMatrix.fromRows([
      [0, 1],
      [2, 3],
    ]);
    const inverse = matrix.invert();
    const product = matrix.multiply(inverse);
    expect(product.at(0, 0)).toBeCloseTo(1, 9);
    expect(product.at(1, 1)).toBeCloseTo(1, 9);
  });

  it('throws for singular matrices', () => {
    const matrix = DenseMatrix.fromRows([
      [1, 2],
      [2, 4],
    ]);
    expect(() => matrix.invert()).toThrow(SingularMatrixError);
  });

  it('rejects non-finite matrix input', () => {
    expect(() => DenseMatrix.fromRows([[Number.NaN, 1]])).toThrow(NumericalFailureError);
    expect(() => DenseMatrix.fromRows([[Number.POSITIVE_INFINITY, 1]])).toThrow(
      NumericalFailureError,
    );
  });
});

describe('approximate numerical equality', () => {
  it('compares floating-point values with tolerance', () => {
    expect(approxEqual(1, 1 + 1e-10)).toBe(true);
    expect(approxEqual(1, 1 + 1e-6)).toBe(false);
  });
});
