import type { AppElements } from './dom.ts';
import { clearResults } from './results.ts';
import { collectPayload, renderConstraintGrid, renderObjectiveGrid, setOptimization } from './form.ts';
import { buildProblemPreviewText } from './preview.ts';

export function resetNewProblem(els: AppElements, updatePreview: () => void): void {
  setOptimization('max');
  els.numVars.value = '2';
  els.numConstraints.value = '2';
  renderObjectiveGrid(els, 2, [0, 0], updatePreview);
  renderConstraintGrid(
    els,
    2,
    2,
    [
      { coefficients: [0, 0], operator: '<=', rhs: 0 },
      { coefficients: [0, 0], operator: '<=', rhs: 0 },
    ],
    updatePreview,
  );
  clearResults(els, 'Form reset.', collectPayload(els));
  els.problemPreview.textContent = buildProblemPreviewText({
    optimization: 'max',
    objective: [0, 0],
    constraints: [
      { coefficients: [0, 0], operator: '<=', rhs: 0 },
      { coefficients: [0, 0], operator: '<=', rhs: 0 },
    ],
  });
}
