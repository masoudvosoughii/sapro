import { describe, expect, it } from 'vitest';

import { ftoa, limitDenominator } from '../src/solver/format/ftoa.ts';
import { normalizeNegativeZero } from '../src/solver/linalg/numeric.ts';

const PYTHON_FTOA_CASES: Array<[number, number | null, boolean, string]> = [
  [0, null, false, '0'],
  [0, null, true, '+0'],
  [-0, null, false, '0'],
  [1, null, false, '1'],
  [1, null, true, '+1'],
  [-1, null, false, '-1'],
  [0.5, null, false, '1/2'],
  [0.5, null, true, '+1/2'],
  [1 / 3, null, false, '1/3'],
  [1 / 3, null, true, '+1/3'],
  [1e-12, null, false, '0'],
  [1e-12, null, true, '+0'],
  [1_000_000_000, null, false, '1000000000'],
  [1_000_000_000, null, true, '+1000000000'],
  [2.5, null, false, '5/2'],
  [2.5, null, true, '+5/2'],
  [-2.5, null, false, '-5/2'],
  [0.33, null, false, '33/100'],
  [0.33, 2, false, '0.33'],
  [10, 2, false, '10'],
  [1 / 3, 2, false, '0.33'],
  [1e-12, 2, false, '1e-12'],
  [1_000_000_000, 2, false, '1e+09'],
];

describe('ftoa formatting', () => {
  for (const [value, precision, plusSign, expected] of PYTHON_FTOA_CASES) {
    it(`formats ${String(value)} precision=${String(precision)} plus=${String(plusSign)}`, () => {
      expect(ftoa(value, precision, plusSign)).toBe(expected);
    });
  }

  it('limits denominators like Python Fraction.limit_denominator()', () => {
    expect(limitDenominator(1 / 3)).toEqual({ numerator: 1, denominator: 3 });
    expect(limitDenominator(0.33)).toEqual({ numerator: 33, denominator: 100 });
  });

  it('cleans up negative zero for numeric comparisons', () => {
    expect(normalizeNegativeZero(-0)).toBe(0);
    expect(Object.is(normalizeNegativeZero(-0), 0)).toBe(true);
  });
});
