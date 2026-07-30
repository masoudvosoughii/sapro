import { describe, expect, it } from 'vitest';

import { variable } from '../src/solver/algebra/index.ts';
import { Tableau } from '../src/solver/tableau/Tableau.ts';

describe('tableau representation', () => {
  const x1 = variable('x1');
  const x2 = variable('x2');

  it('deep-copies numeric storage on clone', () => {
    const tableau = new Tableau(
      [[1 / 5, 0], [0, 1 / 5]],
      [1 / 3, 1 / 3],
      [1 / 3, 1 / 3],
      -0.5,
      [x1, x2],
      [x1, x2],
    );
    const clone = tableau.clone();
    expect(clone.toFrame()).toEqual(tableau.toFrame());
    expect(clone).not.toBe(tableau);
    expect(clone.variables[0]).not.toBe(tableau.variables[0]);
  });

  it('formats tableau frames as string grids for UI compatibility', () => {
    const tableau = new Tableau(
      [[0.2, 0], [0, 0.2]],
      [1 / 3, 1 / 3],
      [1 / 3, 1 / 3],
      -0.5,
      [x1, x2],
      [x1, x2],
    );
    const frame = tableau.toFrame();
    expect(frame[0]).toEqual(['BV', 'x1', 'x2', 'RHS']);
    expect(frame[1]?.[0]).toBe('x1');
    expect(frame[1]?.[1]).toBe('1/5');
    expect(frame[3]?.[3]).toBe('z-1/2');
  });

  it('renders tab-separated display output', () => {
    const tableau = new Tableau(
      [[1, 0]],
      [2],
      [3],
      -4,
      [x1],
      [x1],
    );
    expect(tableau.display('=')).toContain('BV');
    expect(tableau.display('=')).toContain('z-4');
  });
});
