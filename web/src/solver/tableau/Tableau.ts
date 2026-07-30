import { Variable } from '../algebra/Variable.ts';
import { ftoa } from '../format/ftoa.ts';
import { formatTable } from '../format/formatTable.ts';
import type { TableauFrame } from '../../api/types.ts';

/** Numerical simplex tableau with explicit variable ordering. */
export class Tableau {
  readonly data: readonly (readonly number[])[];
  readonly sigma: readonly number[];
  readonly rhs: readonly number[];
  readonly z: number;
  readonly variables: readonly Variable[];
  readonly bases: readonly Variable[];
  readonly precision: number | null;

  constructor(
    data: readonly (readonly number[])[],
    sigma: readonly number[],
    rhs: readonly number[],
    z: number,
    variables: readonly Variable[],
    bases: readonly Variable[],
    precision: number | null = null,
  ) {
    this.data = deepCopyMatrix(data);
    this.sigma = [...sigma];
    this.rhs = [...rhs];
    this.z = z;
    this.variables = variables.map((variable) => variable.clone());
    this.bases = bases.map((variable) => variable.clone());
    this.precision = precision;
  }

  clone(): Tableau {
    return new Tableau(
      this.data,
      this.sigma,
      this.rhs,
      this.z,
      this.variables,
      this.bases,
      this.precision,
    );
  }

  toFrame(): TableauFrame {
    const frame: string[][] = [
      ['BV', ...this.variables.map((variable) => variable.name), 'RHS'],
    ];

    for (let rowIndex = 0; rowIndex < this.data.length; rowIndex += 1) {
      const row = this.data[rowIndex] ?? [];
      const base = this.bases[rowIndex]?.name ?? '';
      frame.push([
        base,
        ...row.map((value) => ftoa(value, this.precision)),
        ftoa(this.rhs[rowIndex] ?? 0, this.precision),
      ]);
    }

    frame.push([
      '',
      ...this.sigma.map((value) => ftoa(value, this.precision)),
      `z${ftoa(this.z, this.precision, true)}`,
    ]);

    return frame;
  }

  display(separator = '-'): string {
    const frame = this.toFrame();
    return formatTable(frame, [frame.length, frame[0]?.length ?? 0], separator);
  }
}

function deepCopyMatrix(matrix: readonly (readonly number[])[]): number[][] {
  return matrix.map((row) => [...row]);
}
