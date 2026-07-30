import { describe, expect, it } from 'vitest';

import {
  buildFeasiblePolygon,
  computeViewport,
  insideHalfPlane,
  polygonArea,
} from '../src/ui/feasibleRegion.ts';

describe('feasible region geometry helpers', () => {
  const readmePayload = {
    optimization: 'max' as const,
    objective: [1, 2],
    constraints: [
      { coefficients: [1, 1], operator: '<=' as const, rhs: 4 },
      { coefficients: [-2, 1], operator: '<=' as const, rhs: 1 },
      { coefficients: [1, 0], operator: '<=' as const, rhs: 3 },
    ],
  };

  it('clips non-negativity half-planes', () => {
    const viewport = computeViewport(readmePayload, null);
    const polygon = buildFeasiblePolygon(readmePayload, viewport);
    expect(polygon.length).toBeGreaterThanOrEqual(3);
    expect(polygonArea(polygon)).toBeGreaterThan(0);
    for (const point of polygon) {
      expect(insideHalfPlane(1, 0, 0, '>=', point.x, point.y)).toBe(true);
      expect(insideHalfPlane(0, 1, 0, '>=', point.x, point.y)).toBe(true);
    }
  });

  it('returns zero area for empty intersection', () => {
    const infeasible = {
      optimization: 'max' as const,
      objective: [1, 1],
      constraints: [
        { coefficients: [1, 0], operator: '>=' as const, rhs: 5 },
        { coefficients: [0, 1], operator: '>=' as const, rhs: 5 },
        { coefficients: [1, 1], operator: '<=' as const, rhs: 1 },
      ],
    };
    const viewport = computeViewport(infeasible, null);
    const polygon = buildFeasiblePolygon(infeasible, viewport);
    expect(polygonArea(polygon)).toBe(0);
  });
});
