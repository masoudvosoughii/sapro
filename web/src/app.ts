import { solveProblem } from './api/solveProblem.ts';
import type { AppElements } from './ui/dom.ts';
import { getAppElements } from './ui/dom.ts';
import { EXAMPLES } from './ui/examples.ts';
import {
  collectPayload,
  rebuildGrids,
  renderConstraintGrid,
  renderObjectiveGrid,
  setOptimization,
} from './ui/form.ts';
import { buildProblemPreviewText } from './ui/preview.ts';
import { clearResults, renderResponse } from './ui/results.ts';
import { resetNewProblem } from './ui/reset.ts';

export interface AppController {
  elements: AppElements;
  updateProblemPreview(): void;
  loadExample(key: string): void;
  resetNewProblem(): void;
  solve(): void;
  populateExampleSelect(): void;
}

export interface AppControllerOptions {
  solveFn?: typeof solveProblem;
}

let solving = false;

export function createAppController(els: AppElements, options: AppControllerOptions = {}): AppController {
  const runSolve = options.solveFn ?? solveProblem;

  function updateProblemPreview(): void {
    els.problemPreview.textContent = buildProblemPreviewText(collectPayload(els));
  }

  function loadExample(key: string): void {
    const example = EXAMPLES[key];
    if (!example) {
      return;
    }
    setOptimization(example.optimization);
    els.numVars.value = String(example.numVars);
    els.numConstraints.value = String(example.numConstraints);
    renderObjectiveGrid(els, example.numVars, example.objective, updateProblemPreview);
    renderConstraintGrid(els, example.numVars, example.numConstraints, example.constraints, updateProblemPreview);
    updateProblemPreview();
  }

  function populateExampleSelect(): void {
    els.exampleSelect.replaceChildren();
    for (const [key, example] of Object.entries(EXAMPLES)) {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = example.label;
      els.exampleSelect.appendChild(option);
    }
  }

  function solve(): void {
    if (solving) {
      return;
    }
    solving = true;
    els.solveBtn.disabled = true;

    const payloadSnapshot = collectPayload(els);
    clearResults(els, 'Solving...', payloadSnapshot);

    try {
      const response = runSolve(payloadSnapshot);
      renderResponse(els, response, payloadSnapshot);
    } catch {
      clearResults(els, 'An unexpected error occurred.', payloadSnapshot);
      els.statusBox.textContent = 'An unexpected error occurred.';
      els.statusBox.className = 'error';
      els.resultSummary.replaceChildren();
      const messageLine = document.createElement('p');
      messageLine.textContent = 'An unexpected error occurred.';
      els.resultSummary.appendChild(messageLine);
    } finally {
      solving = false;
      els.solveBtn.disabled = false;
    }
  }

  return {
    elements: els,
    updateProblemPreview,
    loadExample,
    resetNewProblem: () => {
      resetNewProblem(els, updateProblemPreview);
    },
    solve,
    populateExampleSelect,
  };
}

export function bindAppEvents(controller: AppController): void {
  const { elements: els } = controller;

  const onDimensionChange = (): void => {
    rebuildGrids(els, () => {
      controller.updateProblemPreview();
    });
    controller.updateProblemPreview();
  };

  els.numVars.addEventListener('change', onDimensionChange);
  els.numConstraints.addEventListener('change', onDimensionChange);
  els.solveBtn.addEventListener('click', () => {
    controller.solve();
  });
  els.newProblemBtn.addEventListener('click', () => {
    controller.resetNewProblem();
  });
  els.loadExampleBtn.addEventListener('click', () => {
    controller.loadExample(els.exampleSelect.value);
  });

  document.querySelectorAll<HTMLInputElement>('input[name="optimization"]').forEach((input) => {
    input.addEventListener('change', () => {
      controller.updateProblemPreview();
    });
  });
}

export function bootApp(): AppController {
  const els = getAppElements();
  const controller = createAppController(els);
  bindAppEvents(controller);
  controller.populateExampleSelect();
  controller.loadExample('readme');
  return controller;
}
