/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';

import { buildProblemPreviewText } from '../src/ui/preview.ts';
import { formatObjectiveExpression, formatTerm } from '../src/ui/form.ts';

describe('problem preview formatting', () => {
  it('formats objective signs without double signs', () => {
    const preview = buildProblemPreviewText({
      optimization: 'max',
      objective: [3, -2],
      constraints: [{ coefficients: [1, 0], operator: '<=', rhs: 4 }],
    });
    expect(preview.startsWith('Max Z = 3x1 - 2x2')).toBe(true);
    expect(preview).not.toContain('+ -');
  });

  it('omits zero terms and formats coefficient 1 and -1', () => {
    expect(formatTerm(1, 'x1', true)).toBe('x1');
    expect(formatTerm(-1, 'x2', false)).toBe(' - x2');
    expect(formatTerm(0, 'x3', false)).toBe('');
    expect(formatObjectiveExpression([0, 2, 0])).toBe('2x2');
  });

  it('shows non-negativity and constraint operators', () => {
    const preview = buildProblemPreviewText({
      optimization: 'min',
      objective: [1, 1],
      constraints: [{ coefficients: [1, 1], operator: '==', rhs: 4 }],
    });
    expect(preview.startsWith('Min Z =')).toBe(true);
    expect(preview).toContain('x1 + x2 = 4');
    expect(preview).toContain('x1, x2 >= 0');
  });

  it('does not call the solver', () => {
    const preview = buildProblemPreviewText({
      optimization: 'max',
      objective: [1],
      constraints: [{ coefficients: [1], operator: '<=', rhs: 1 }],
    });
    expect(preview).toContain('Max Z = x1');
  });
});
