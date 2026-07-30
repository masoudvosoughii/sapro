import { describe, expect, it } from 'vitest';

import {
  ParityMismatchError,
  assertSemanticParity,
  tryAssertSemanticParity,
} from './helpers/parityCompare.ts';

describe('semantic parity comparison', () => {
  it('compares nested objects with numeric tolerance', () => {
    assertSemanticParity(
      {
        objective_value: 7.0000000001,
        variable_values: { x1: 1, x2: 3.0000000004 },
      },
      {
        objective_value: 7,
        variable_values: { x1: 1, x2: 3 },
      },
    );
  });

  it('compares numeric matrices with tolerance', () => {
    assertSemanticParity(
      [
        [1, 0],
        [0, 1 + 1e-10],
      ],
      [
        [1, 0],
        [0, 1],
      ],
    );
  });

  it('compares formatted tableau strings exactly when provided as string grids', () => {
    assertSemanticParity(
      [
        ['BV', 'x1', 'RHS'],
        ['x1', '1/5', '1/3'],
      ],
      [
        ['BV', 'x1', 'RHS'],
        ['x1', '1/5', '1/3'],
      ],
    );
  });

  it('reports useful failure paths for nested mismatches', () => {
    const actual = {
      steps: [
        { index: 1, tableau: [['BV'], ['x1', '1']] },
        { index: 2, tableau: [['BV'], ['x1', '2']] },
        { index: 3, tableau: [['BV'], ['x1', '9']] },
      ],
    };
    const expected = {
      steps: [
        { index: 1, tableau: [['BV'], ['x1', '1']] },
        { index: 2, tableau: [['BV'], ['x1', '2']] },
        { index: 3, tableau: [['BV'], ['x1', '3']] },
      ],
    };

    const error = tryAssertSemanticParity(actual, expected);
    expect(error).toBeInstanceOf(ParityMismatchError);
    expect(error?.path).toBe('steps[2].tableau[1][1]');
  });

  it('handles optional and nullable fields', () => {
    assertSemanticParity(
      { enter: null, leave: 's1', phase_iteration: undefined },
      { enter: null, leave: 's1' },
    );
  });
});
