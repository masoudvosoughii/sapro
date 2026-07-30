import { NumericalFailureError, SingularMatrixError } from '../errors/LpError.ts';
import { assertFiniteNumber, isFiniteNumber } from './numeric.ts';

export class DenseMatrix {
  readonly rows: number;
  readonly cols: number;
  private readonly data: number[][];

  constructor(rows: number, cols: number, data?: number[][]) {
    this.rows = rows;
    this.cols = cols;
    if (data === undefined) {
      this.data = Array.from({ length: rows }, () => Array<number>(cols).fill(0));
      return;
    }
    if (data.length !== rows || data.some((row) => row.length !== cols)) {
      throw new NumericalFailureError('matrix data shape mismatch');
    }
    for (const row of data) {
      for (const value of row) {
        if (!isFiniteNumber(value)) {
          throw new NumericalFailureError('matrix contains non-finite values');
        }
      }
    }
    this.data = data.map((row) => [...row]);
  }

  static identity(size: number): DenseMatrix {
    const data = Array.from({ length: size }, (_, row) =>
      Array.from({ length: size }, (_, col) => (row === col ? 1 : 0)),
    );
    return new DenseMatrix(size, size, data);
  }

  static fromRows(rows: number[][]): DenseMatrix {
    if (rows.length === 0) {
      throw new NumericalFailureError('matrix must contain at least one row');
    }
    const cols = rows[0]?.length ?? 0;
    return new DenseMatrix(rows.length, cols, rows);
  }

  clone(): DenseMatrix {
    return new DenseMatrix(this.rows, this.cols, this.data);
  }

  at(row: number, col: number): number {
    this.validateIndex(row, col);
    return assertFiniteNumber(this.data[row]?.[col] ?? Number.NaN, 'matrix entry');
  }

  set(row: number, col: number, value: number): void {
    this.validateIndex(row, col);
    const targetRow = this.data[row];
    if (targetRow === undefined) {
      throw new NumericalFailureError('matrix index out of bounds');
    }
    targetRow[col] = assertFiniteNumber(value, 'matrix entry');
  }

  row(rowIndex: number): number[] {
    if (rowIndex < 0 || rowIndex >= this.rows) {
      throw new NumericalFailureError('row index out of bounds');
    }
    return [...(this.data[rowIndex] ?? [])];
  }

  column(colIndex: number): number[] {
    if (colIndex < 0 || colIndex >= this.cols) {
      throw new NumericalFailureError('column index out of bounds');
    }
    return this.data.map((row) => row[colIndex] ?? 0);
  }

  replaceRow(rowIndex: number, values: readonly number[]): void {
    if (rowIndex < 0 || rowIndex >= this.rows) {
      throw new NumericalFailureError('row index out of bounds');
    }
    if (values.length !== this.cols) {
      throw new NumericalFailureError('replacement row has invalid length');
    }
    for (const value of values) {
      assertFiniteNumber(value, 'matrix row entry');
    }
    this.data[rowIndex] = [...values];
  }

  transpose(): DenseMatrix {
    const transposed = Array.from({ length: this.cols }, () => Array<number>(this.rows).fill(0));
    for (let row = 0; row < this.rows; row += 1) {
      for (let col = 0; col < this.cols; col += 1) {
        const targetRow = transposed[col];
        if (targetRow !== undefined) {
          targetRow[row] = this.at(row, col);
        }
      }
    }
    return new DenseMatrix(this.cols, this.rows, transposed);
  }

  multiply(other: DenseMatrix): DenseMatrix {
    if (this.cols !== other.rows) {
      throw new NumericalFailureError('incompatible matrix shapes for multiplication');
    }
    const result = DenseMatrix.fromRows(
      Array.from({ length: this.rows }, () => Array<number>(other.cols).fill(0)),
    );
    for (let row = 0; row < this.rows; row += 1) {
      for (let col = 0; col < other.cols; col += 1) {
        let sum = 0;
        for (let inner = 0; inner < this.cols; inner += 1) {
          sum += this.at(row, inner) * other.at(inner, col);
        }
        result.set(row, col, sum);
      }
    }
    return result;
  }

  multiplyVector(vector: readonly number[]): number[] {
    if (vector.length !== this.cols) {
      throw new NumericalFailureError('incompatible matrix/vector shapes for multiplication');
    }
    for (const value of vector) {
      assertFiniteNumber(value, 'vector entry');
    }
    return Array.from({ length: this.rows }, (_, row) => {
      let sum = 0;
      for (let col = 0; col < this.cols; col += 1) {
        sum += this.at(row, col) * (vector[col] ?? 0);
      }
      return sum;
    });
  }

  /**
   * Invert a square matrix using Gauss-Jordan elimination with partial pivoting.
   */
  invert(): DenseMatrix {
    if (this.rows !== this.cols) {
      throw new NumericalFailureError('only square matrices can be inverted');
    }
    const size = this.rows;
    const augmented = this.clone();
    const inverse = DenseMatrix.identity(size);

    for (let pivotCol = 0; pivotCol < size; pivotCol += 1) {
      let pivotRow = pivotCol;
      let pivotValue = Math.abs(augmented.at(pivotRow, pivotCol));

      for (let row = pivotCol + 1; row < size; row += 1) {
        const candidate = Math.abs(augmented.at(row, pivotCol));
        if (candidate > pivotValue) {
          pivotValue = candidate;
          pivotRow = row;
        }
      }

      if (pivotValue === 0) {
        throw new SingularMatrixError('matrix is singular or numerically singular');
      }

      if (pivotRow !== pivotCol) {
        swapRows(augmented, pivotRow, pivotCol);
        swapRows(inverse, pivotRow, pivotCol);
      }

      const pivot = augmented.at(pivotCol, pivotCol);
      scaleRow(augmented, pivotCol, 1 / pivot);
      scaleRow(inverse, pivotCol, 1 / pivot);

      for (let row = 0; row < size; row += 1) {
        if (row === pivotCol) {
          continue;
        }
        const factor = augmented.at(row, pivotCol);
        if (factor === 0) {
          continue;
        }
        eliminateRow(augmented, row, pivotCol, factor);
        eliminateRow(inverse, row, pivotCol, factor);
      }
    }

    return inverse;
  }

  toArray(): number[][] {
    return this.data.map((row) => [...row]);
  }

  private validateIndex(row: number, col: number): void {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
      throw new NumericalFailureError('matrix index out of bounds');
    }
  }
}

function swapRows(matrix: DenseMatrix, a: number, b: number): void {
  const rowA = matrix.row(a);
  const rowB = matrix.row(b);
  matrix.replaceRow(a, rowB);
  matrix.replaceRow(b, rowA);
}

function scaleRow(matrix: DenseMatrix, rowIndex: number, factor: number): void {
  const scaled = matrix.row(rowIndex).map((value) => value * factor);
  matrix.replaceRow(rowIndex, scaled);
}

function eliminateRow(
  matrix: DenseMatrix,
  targetRow: number,
  pivotCol: number,
  factor: number,
): void {
  const pivotRow = matrix.row(pivotCol);
  const target = matrix.row(targetRow);
  const next = target.map((value, index) => value - factor * (pivotRow[index] ?? 0));
  matrix.replaceRow(targetRow, next);
}
