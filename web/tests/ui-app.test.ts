/**
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeEach, describe, expect, it } from 'vitest';

import { solveProblem } from '../src/api/solveProblem.ts';
import type { SolveRequest } from '../src/api/types.ts';
import type { SolveStep } from '../src/api/types.ts';
import { bootApp, createAppController } from '../src/app.ts';
import { getAppElements } from '../src/ui/dom.ts';
import { EXAMPLE_KEYS, EXAMPLES } from '../src/ui/examples.ts';
import { collectPayload } from '../src/ui/form.ts';
import { buildMethodLine, formatStepHeading } from '../src/ui/steps.ts';
import { loadAppHtml } from './helpers/setupDom.ts';

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function readIndexHtml(): string {
  return readFileSync(join(WEB_ROOT, 'index.html'), 'utf-8');
}

describe('application boot and static UI requirements', () => {
  beforeEach(() => {
    loadAppHtml();
    bootApp();
  });

  it('boots with readme example loaded', () => {
    const els = getAppElements();
    expect(els.problemPreview.textContent).toContain('Max Z = x1 + 2x2');
    expect(els.numVars.value).toBe('2');
    expect(els.numConstraints.value).toBe('3');
  });

  it('uses English lang and ltr direction without language selector', () => {
    const html = readIndexHtml();
    expect(html).toContain('lang="en"');
    expect(html).toContain('dir="ltr"');
    expect(html).not.toContain('lang-switch');
    expect(html).not.toContain('lang-fa');
    expect(html).not.toContain('فارسی');
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('does not include expand or collapse all controls', () => {
    const html = readIndexHtml();
    expect(html).not.toContain('expand-all-btn');
    expect(html).not.toContain('Expand All');
    expect(html).not.toContain('collapse-all-btn');
    expect(html).not.toContain('Collapse All');
    expect(document.querySelector('#expand-all-btn')).toBeNull();
    expect(document.querySelector('#collapse-all-btn')).toBeNull();
  });

  it('preserves identity and problem preview sections', () => {
    expect(document.body.textContent).toContain('Masoud Vosoughi');
    expect(document.body.textContent).toContain('Problem Preview');
    expect(document.getElementById('problem-preview')).not.toBeNull();
    expect(document.getElementById('feasible-region-viz')).not.toBeNull();
    expect(document.getElementById('new-problem-btn')).not.toBeNull();
  });
});

describe('form generation and payload collection', () => {
  beforeEach(() => {
    loadAppHtml();
    bootApp();
  });

  it('generates coefficient grids for current dimensions', () => {
    const els = getAppElements();
    expect(els.objectiveGrid.querySelectorAll('input').length).toBe(2);
    expect(els.constraintGrid.querySelectorAll('input[data-var-index]').length).toBe(6);
    expect(els.constraintGrid.querySelectorAll('select[data-role="operator"]').length).toBe(3);
  });

  it('collects payload matching readme example', () => {
    const payload = collectPayload(getAppElements());
    expect(payload.optimization).toBe('max');
    expect(payload.objective).toEqual([1, 2]);
    expect(payload.constraints.length).toBe(3);
  });
});

describe('built-in examples', () => {
  beforeEach(() => {
    loadAppHtml();
    bootApp();
  });

  it('exposes all nine examples in the select control', () => {
    const els = getAppElements();
    const optionValues = Array.from(els.exampleSelect.options).map((option) => option.value);
    expect(optionValues).toEqual(EXAMPLE_KEYS);
  });

  for (const key of EXAMPLE_KEYS) {
    it(`loads and solves example "${key}"`, () => {
      const controller = createAppController(getAppElements());
      controller.loadExample(key);
      const payload = collectPayload(getAppElements());
      const example = EXAMPLES[key];
      expect(example).toBeDefined();
      if (!example) {
        return;
      }
      expect(payload.optimization).toBe(example.optimization);
      expect(payload.objective).toEqual(example.objective);

      const response = solveProblem(payload);
      if (key === 'infeasible') {
        expect(response.ok).toBe(false);
        if (!response.ok) {
          expect(response.status).toBe('infeasible');
        }
        return;
      }
      if (key === 'unbounded') {
        expect(response.ok).toBe(false);
        if (!response.ok) {
          expect(response.status).toBe('unbounded');
        }
        return;
      }
      expect(response.ok).toBe(true);
    });
  }
});

describe('solve rendering', () => {
  beforeEach(() => {
    loadAppHtml();
    bootApp();
  });

  it('renders successful readme solve through in-memory API', () => {
    const controller = createAppController(getAppElements());
    controller.loadExample('readme');
    controller.solve();

    const els = getAppElements();
    expect(els.statusBox.className).toBe('ok');
    expect(els.resultSummary.textContent).toContain('Objective (Z):');
    expect(els.resultSummary.textContent).toContain('7');
    expect(els.resultSummary.textContent).toContain('Method: Simplex');
    expect(els.stepsContainer.querySelectorAll('details.step-panel').length).toBeGreaterThan(0);
    expect(els.feasibleViz.querySelector('svg')).not.toBeNull();
  });

  it('renders minimization and two-phase method lines', () => {
    const controller = createAppController(getAppElements());

    controller.loadExample('minimization');
    controller.solve();
    expect(getAppElements().resultSummary.textContent).toContain('Objective (Z):');

    controller.loadExample('mixed');
    controller.solve();
    const mixedResponse = solveProblem(collectPayload(getAppElements()));
    expect(mixedResponse.ok).toBe(true);
    if (mixedResponse.ok) {
      expect(getAppElements().resultSummary.textContent).toContain(
        buildMethodLine(mixedResponse.phase_counts),
      );
      expect(buildMethodLine(mixedResponse.phase_counts)).toContain('Two-Phase Simplex');
    }
  });

  it('renders infeasible and unbounded errors without leaving stale success', () => {
    const controller = createAppController(getAppElements());

    controller.loadExample('readme');
    controller.solve();
    expect(getAppElements().statusBox.className).toBe('ok');

    controller.loadExample('infeasible');
    controller.solve();
    expect(getAppElements().statusBox.className).toBe('error');
    expect(getAppElements().resultSummary.textContent).toContain('infeasible');
    expect(getAppElements().stepsContainer.children.length).toBe(0);

    controller.loadExample('unbounded');
    controller.solve();
    expect(getAppElements().statusBox.className).toBe('error');
    expect(getAppElements().resultSummary.textContent).toContain('unbounded');
  });

  it('renders invalid input from validation without fetch', () => {
    const controller = createAppController(getAppElements());
    const els = getAppElements();
    const objectiveInput = els.objectiveGrid.querySelector<HTMLInputElement>('input[data-objective-index="0"]');
    if (!objectiveInput) {
      throw new Error('missing objective input');
    }
    objectiveInput.value = '';
    controller.solve();
    expect(els.statusBox.className).toBe('error');
    expect(els.resultSummary.textContent.toLowerCase()).toMatch(/invalid|finite|number/);
  });

  it('renders iteration panels without phase labels in headings', () => {
    const controller = createAppController(getAppElements());
    controller.loadExample('mixed');
    controller.solve();

    const headings = Array.from(getAppElements().stepsContainer.querySelectorAll('summary')).map(
      (node) => node.textContent || '',
    );
    expect(headings.length).toBeGreaterThan(0);
    for (const heading of headings) {
      expect(heading).not.toContain('Phase I');
      expect(heading).not.toContain('Phase II');
    }
  });

  it('renders tableau using DOM text nodes', () => {
    const controller = createAppController(getAppElements());
    controller.loadExample('readme');
    controller.solve();

    const cell = getAppElements().stepsContainer.querySelector('table.tableau td');
    expect(cell?.innerHTML).toBe(cell?.textContent);
  });
});

describe('method line and step heading helpers', () => {
  it('shows Simplex when Phase I is zero', () => {
    expect(buildMethodLine({ phase_one: 0, phase_two: 3, total: 3 })).toBe('Method: Simplex');
    expect(buildMethodLine({ phase_one: 0, phase_two: 3, total: 3 })).not.toContain('Phase I: 0');
  });

  it('formats step headings for partial enter/leave data', () => {
    const base: Pick<SolveStep, 'index' | 'enter' | 'leave'> = { index: 1, enter: null, leave: null };
    expect(formatStepHeading({ ...base, enter: 'x1', leave: 's2' })).toBe('Step 1: x1 enters, s2 leaves');
    expect(formatStepHeading({ ...base, enter: 'x1', leave: null })).toBe('Step 1: x1 enters');
    expect(formatStepHeading({ ...base, enter: null, leave: 's2' })).toBe('Step 1: s2 leaves');
    expect(formatStepHeading(base)).toBe('Step 1');
  });
});

describe('New Problem reset', () => {
  beforeEach(() => {
    loadAppHtml();
    bootApp();
  });

  it('resets dimensions, fields, results, and preview without reload', () => {
    const controller = createAppController(getAppElements());
    controller.loadExample('readme');
    controller.solve();

    controller.resetNewProblem();

    const els = getAppElements();
    expect(els.numVars.value).toBe('2');
    expect(els.numConstraints.value).toBe('2');
    expect(els.resultSummary.textContent).toContain('No results yet.');
    expect(els.stepsContainer.children.length).toBe(0);
    expect(els.problemPreview.textContent).toContain('Max Z = 0');
    expect(els.feasibleViz.querySelector('svg')).not.toBeNull();
  });
});

describe('unsupported three-variable visualization', () => {
  beforeEach(() => {
    loadAppHtml();
    bootApp();
  });

  it('shows unavailable message for three decision variables', () => {
    const controller = createAppController(getAppElements());
    controller.loadExample('ge');
    controller.solve();
    expect(getAppElements().feasibleViz.textContent).toContain(
      'Two-dimensional visualization is available only',
    );
  });
});

describe('DOM and state safety', () => {
  beforeEach(() => {
    loadAppHtml();
    bootApp();
  });

  it('prevents duplicate concurrent solve work and restores button state', () => {
    let solveCalls = 0;
    const controller = createAppController(getAppElements(), {
      solveFn: (request: SolveRequest) => {
        solveCalls += 1;
        if (solveCalls === 1) {
          expect(getAppElements().solveBtn.disabled).toBe(true);
          controller.solve();
        }
        return solveProblem(request);
      },
    });
    const els = getAppElements();
    controller.loadExample('readme');

    controller.solve();
    expect(solveCalls).toBe(1);
    expect(els.solveBtn.disabled).toBe(false);
  });

  it('does not mutate solver response steps during rendering', () => {
    const readme = EXAMPLES['readme'];
    if (!readme) {
      throw new Error('missing readme example');
    }
    const response = solveProblem({
      optimization: readme.optimization,
      objective: [...readme.objective],
      constraints: readme.constraints.map((row) => ({
        coefficients: [...row.coefficients],
        operator: row.operator,
        rhs: row.rhs,
      })),
    });
    expect(response.ok).toBe(true);
    if (!response.ok) {
      return;
    }
    const snapshot = structuredClone(response.steps);
    loadAppHtml();
    const controller = createAppController(getAppElements());
    controller.loadExample('readme');
    controller.solve();
    expect(response.steps).toEqual(snapshot);
  });

  it('does not rewrite coefficient inputs after solve', () => {
    const controller = createAppController(getAppElements());
    controller.loadExample('readme');
    const before = collectPayload(getAppElements());
    controller.solve();
    const after = collectPayload(getAppElements());
    expect(after).toEqual(before);
  });

  it('rebuilds form dimensions when switching examples', () => {
    const controller = createAppController(getAppElements());
    controller.loadExample('ge');
    expect(getAppElements().numVars.value).toBe('1');
    controller.loadExample('readme');
    expect(getAppElements().numVars.value).toBe('2');
    expect(getAppElements().numConstraints.value).toBe('3');
  });
});
