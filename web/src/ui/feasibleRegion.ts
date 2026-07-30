import { UI_EPS, type AppElements, type SolvePayload } from './dom.ts';
import { formatNumber } from './form.ts';
import type { SolveResponse } from '../api/types.ts';

/** Half-plane and clipping tolerance (matches original app.js EPS). */
export const FEASIBLE_REGION_EPS = UI_EPS;

export const CONSTRAINT_COLORS = ['#245bdb', '#1f7a4d', '#b45309', '#7c3aed', '#be123c'] as const;

export interface Point2D {
  x: number;
  y: number;
}

export interface Viewport {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function nearlyZero(value: number): boolean {
  return Math.abs(value) < FEASIBLE_REGION_EPS;
}

export function evalConstraint(a: number, b: number, x: number, y: number): number {
  return a * x + b * y;
}

export function insideHalfPlane(a: number, b: number, rhs: number, op: string, x: number, y: number): boolean {
  const value = evalConstraint(a, b, x, y);
  if (op === '<=') {
    return value <= rhs + FEASIBLE_REGION_EPS;
  }
  if (op === '>=') {
    return value >= rhs - FEASIBLE_REGION_EPS;
  }
  return Math.abs(value - rhs) <= FEASIBLE_REGION_EPS;
}

export function intersectSegmentWithLine(
  p1: Point2D,
  p2: Point2D,
  a: number,
  b: number,
  rhs: number,
): Point2D | null {
  const f1 = evalConstraint(a, b, p1.x, p1.y) - rhs;
  const f2 = evalConstraint(a, b, p2.x, p2.y) - rhs;
  if (Math.abs(f2 - f1) < FEASIBLE_REGION_EPS) {
    return null;
  }
  const t = f1 / (f1 - f2);
  return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
}

export function clipPolygon(
  polygon: Point2D[],
  a: number,
  b: number,
  rhs: number,
  op: string,
): Point2D[] {
  if (polygon.length === 0) {
    return [];
  }
  const output: Point2D[] = [];
  for (let i = 0; i < polygon.length; i += 1) {
    const current = polygon[i];
    const previous = polygon[(i + polygon.length - 1) % polygon.length];
    if (current === undefined || previous === undefined) {
      continue;
    }
    const currInside = insideHalfPlane(a, b, rhs, op, current.x, current.y);
    const prevInside = insideHalfPlane(a, b, rhs, op, previous.x, previous.y);
    if (currInside) {
      if (!prevInside) {
        const hit = intersectSegmentWithLine(previous, current, a, b, rhs);
        if (hit) {
          output.push(hit);
        }
      }
      output.push(current);
    } else if (prevInside) {
      const hit = intersectSegmentWithLine(previous, current, a, b, rhs);
      if (hit) {
        output.push(hit);
      }
    }
  }
  return output;
}

export function computeViewport(payload: SolvePayload, optimalPoint: Point2D | null): Viewport {
  let maxX = 1;
  let maxY = 1;
  for (const row of payload.constraints) {
    const a = row.coefficients[0] ?? 0;
    const b = row.coefficients[1] ?? 0;
    if (!nearlyZero(a)) {
      maxX = Math.max(maxX, row.rhs / a);
    }
    if (!nearlyZero(b)) {
      maxY = Math.max(maxY, row.rhs / b);
    }
  }
  if (optimalPoint) {
    maxX = Math.max(maxX, optimalPoint.x * 1.2);
    maxY = Math.max(maxY, optimalPoint.y * 1.2);
  }
  maxX = Math.max(4, maxX * 1.2);
  maxY = Math.max(4, maxY * 1.2);
  return { minX: 0, minY: 0, maxX, maxY };
}

export function buildFeasiblePolygon(payload: SolvePayload, viewport: Viewport): Point2D[] {
  let polygon: Point2D[] = [
    { x: viewport.minX, y: viewport.minY },
    { x: viewport.maxX, y: viewport.minY },
    { x: viewport.maxX, y: viewport.maxY },
    { x: viewport.minX, y: viewport.maxY },
  ];
  polygon = clipPolygon(polygon, 1, 0, 0, '>=');
  polygon = clipPolygon(polygon, 0, 1, 0, '>=');
  for (const row of payload.constraints) {
    if (row.operator === '==') {
      continue;
    }
    const a = row.coefficients[0] ?? 0;
    const b = row.coefficients[1] ?? 0;
    polygon = clipPolygon(polygon, a, b, row.rhs, row.operator);
  }
  return polygon;
}

export function lineSegmentInViewport(
  a: number,
  b: number,
  rhs: number,
  viewport: Viewport,
): [Point2D, Point2D] | null {
  const points: Point2D[] = [];
  const { minX, maxX, minY, maxY } = viewport;
  if (!nearlyZero(b)) {
    points.push({ x: minX, y: (rhs - a * minX) / b });
    points.push({ x: maxX, y: (rhs - a * maxX) / b });
  }
  if (!nearlyZero(a)) {
    points.push({ x: (rhs - b * minY) / a, y: minY });
    points.push({ x: (rhs - b * maxY) / a, y: maxY });
  }
  const clipped = points.filter(
    (p) =>
      p.x >= minX - FEASIBLE_REGION_EPS &&
      p.x <= maxX + FEASIBLE_REGION_EPS &&
      p.y >= minY - FEASIBLE_REGION_EPS &&
      p.y <= maxY + FEASIBLE_REGION_EPS,
  );
  if (clipped.length < 2) {
    return null;
  }
  const first = clipped[0];
  const last = clipped[clipped.length - 1];
  if (first === undefined || last === undefined) {
    return null;
  }
  return [first, last];
}

export function polygonArea(polygon: Point2D[]): number {
  if (polygon.length < 3) {
    return 0;
  }
  let area = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];
    if (p1 === undefined || p2 === undefined) {
      continue;
    }
    area += p1.x * p2.y - p2.x * p1.y;
  }
  return Math.abs(area) / 2;
}

function createSvgElement(tag: string, attrs: Record<string, string>): SVGElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value);
  }
  return el;
}

export function renderFeasibleRegion(
  els: AppElements,
  result: SolveResponse | null,
  payload: SolvePayload | null,
): void {
  els.feasibleNote.hidden = true;
  els.feasibleNote.textContent = '';
  els.feasibleViz.setAttribute('aria-label', 'Feasible region chart for two decision variables');

  if (!payload || payload.objective.length !== 2) {
    els.feasibleViz.replaceChildren();
    const message = document.createElement('p');
    message.className = 'viz-message';
    message.textContent =
      'Two-dimensional visualization is available only for problems with exactly two decision variables.';
    els.feasibleViz.appendChild(message);
    return;
  }

  const optimalPoint =
    result?.ok === true
      ? {
          x: Number(result.variable_values['x1']),
          y: Number(result.variable_values['x2']),
        }
      : null;

  const viewport = computeViewport(payload, optimalPoint);
  const width = 420;
  const height = 320;
  const pad = 36;

  const toSvgX = (x: number): number =>
    pad + ((x - viewport.minX) / (viewport.maxX - viewport.minX)) * (width - 2 * pad);
  const toSvgY = (y: number): number =>
    height - pad - ((y - viewport.minY) / (viewport.maxY - viewport.minY)) * (height - 2 * pad);

  let note = '';
  if (result && !result.ok && result.status === 'infeasible') {
    note = 'No feasible region exists.';
  } else if (result && !result.ok && result.status === 'unbounded') {
    note = 'The feasible region continues beyond the displayed chart.';
  }

  const hasEquality = payload.constraints.some((row) => row.operator === '==');
  const polygon = buildFeasiblePolygon(payload, viewport);
  const area = polygonArea(polygon);
  const showFill = area > FEASIBLE_REGION_EPS && !(result && !result.ok && result.status === 'infeasible');

  const svg = createSvgElement('svg', {
    viewBox: `0 0 ${String(width)} ${String(height)}`,
    role: 'img',
    'aria-label': 'Feasible region chart for two decision variables',
  });

  svg.appendChild(
    createSvgElement('rect', {
      x: '0',
      y: '0',
      width: String(width),
      height: String(height),
      fill: '#fafbfd',
    }),
  );

  svg.appendChild(
    createSvgElement('line', {
      x1: String(pad),
      y1: String(height - pad),
      x2: String(width - pad),
      y2: String(height - pad),
      stroke: '#64748b',
      'stroke-width': '1',
    }),
  );
  svg.appendChild(
    createSvgElement('line', {
      x1: String(pad),
      y1: String(pad),
      x2: String(pad),
      y2: String(height - pad),
      stroke: '#64748b',
      'stroke-width': '1',
    }),
  );

  const xLabel = createSvgElement('text', {
    x: String(width - pad),
    y: String(height - pad + 20),
    'text-anchor': 'end',
    'font-size': '12',
  });
  xLabel.textContent = 'x1';
  svg.appendChild(xLabel);

  const yLabel = createSvgElement('text', {
    x: String(pad - 8),
    y: String(pad),
    'text-anchor': 'end',
    'font-size': '12',
  });
  yLabel.textContent = 'x2';
  svg.appendChild(yLabel);

  if (showFill) {
    const points = polygon.map((p) => `${String(toSvgX(p.x))},${String(toSvgY(p.y))}`).join(' ');
    svg.appendChild(
      createSvgElement('polygon', {
        points,
        fill: 'rgba(36, 91, 219, 0.18)',
        stroke: '#245bdb',
        'stroke-width': '1.5',
      }),
    );
  }

  payload.constraints.forEach((row, index) => {
    const a = row.coefficients[0] ?? 0;
    const b = row.coefficients[1] ?? 0;
    const color = CONSTRAINT_COLORS[index % CONSTRAINT_COLORS.length] ?? '#245bdb';
    const segment = lineSegmentInViewport(a, b, row.rhs, viewport);
    if (!segment) {
      return;
    }
    const lineAttrs: Record<string, string> = {
      x1: String(toSvgX(segment[0].x)),
      y1: String(toSvgY(segment[0].y)),
      x2: String(toSvgX(segment[1].x)),
      y2: String(toSvgY(segment[1].y)),
      stroke: color,
      'stroke-width': '2',
    };
    if (row.operator !== '==') {
      lineAttrs['stroke-dasharray'] = '6 4';
    }
    svg.appendChild(createSvgElement('line', lineAttrs));

    const label = createSvgElement('text', {
      x: String(toSvgX(segment[1].x)),
      y: String(toSvgY(segment[1].y) - 6),
      'font-size': '11',
      fill: color,
    });
    label.textContent = `C${String(index + 1)}`;
    svg.appendChild(label);
  });

  if (optimalPoint && Number.isFinite(optimalPoint.x) && Number.isFinite(optimalPoint.y)) {
    svg.appendChild(
      createSvgElement('circle', {
        cx: String(toSvgX(optimalPoint.x)),
        cy: String(toSvgY(optimalPoint.y)),
        r: '5',
        fill: '#1f7a4d',
        stroke: '#fff',
        'stroke-width': '1.5',
      }),
    );
    const optimalLabel = createSvgElement('text', {
      x: String(toSvgX(optimalPoint.x) + 8),
      y: String(toSvgY(optimalPoint.y) - 8),
      'font-size': '11',
      fill: '#1f7a4d',
    });
    optimalLabel.textContent = `Optimal point (${formatNumber(optimalPoint.x)}, ${formatNumber(optimalPoint.y)})`;
    svg.appendChild(optimalLabel);
  }

  const legend = createSvgElement('text', {
    x: String(pad),
    y: '18',
    'font-size': '11',
    fill: '#475569',
  });
  legend.textContent = 'Constraints';
  svg.appendChild(legend);

  els.feasibleViz.replaceChildren(svg);

  if (note) {
    els.feasibleNote.hidden = false;
    els.feasibleNote.textContent = note;
  } else if (hasEquality && area <= FEASIBLE_REGION_EPS) {
    els.feasibleNote.hidden = false;
    els.feasibleNote.textContent =
      'Equality constraints are shown as lines; lower-dimensional feasible sets may not be shaded.';
  } else if (result && !result.ok && result.status === 'unbounded') {
    els.feasibleNote.hidden = false;
    els.feasibleNote.textContent = 'The feasible region continues beyond the displayed chart.';
  }
}
