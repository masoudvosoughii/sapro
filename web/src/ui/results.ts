import type { SolvePayload } from './dom.ts';
import type { AppElements } from './dom.ts';
import { formatNumber } from './form.ts';
import { buildMethodLine, renderStepsContainer } from './steps.ts';
import { renderFeasibleRegion } from './feasibleRegion.ts';
import type { SolveResponse } from '../api/types.ts';

export function clearResults(els: AppElements, message: string, payload?: SolvePayload): void {
  els.statusBox.textContent = message;
  els.statusBox.className = '';
  els.resultSummary.replaceChildren();
  const empty = document.createElement('p');
  empty.className = 'empty-state';
  empty.textContent = 'No results yet.';
  els.resultSummary.appendChild(empty);
  els.stepsContainer.replaceChildren();
  renderFeasibleRegion(els, null, payload ?? null);
}

export function renderErrorResult(els: AppElements, data: Extract<SolveResponse, { ok: false }>, payload: SolvePayload): void {
  els.statusBox.textContent = data.message || 'Request failed.';
  els.statusBox.className = 'error';
  els.resultSummary.replaceChildren();

  const statusLine = document.createElement('p');
  const statusStrong = document.createElement('strong');
  statusStrong.textContent = 'Status:';
  statusLine.appendChild(statusStrong);
  statusLine.appendChild(document.createTextNode(` ${data.status || 'error'}`));
  els.resultSummary.appendChild(statusLine);

  const messageLine = document.createElement('p');
  messageLine.textContent = data.message || 'Unknown error.';
  els.resultSummary.appendChild(messageLine);

  els.stepsContainer.replaceChildren();
  renderFeasibleRegion(els, data, payload);
}

export function renderSuccessResult(
  els: AppElements,
  data: Extract<SolveResponse, { ok: true }>,
  payload: SolvePayload,
): void {
  els.statusBox.textContent = data.status_label || 'Optimal solution found.';
  els.statusBox.className = 'ok';

  els.resultSummary.replaceChildren();

  const statusLine = document.createElement('p');
  const statusStrong = document.createElement('strong');
  statusStrong.textContent = 'Status:';
  statusLine.appendChild(statusStrong);
  statusLine.appendChild(document.createTextNode(` ${data.status_label || 'Optimal solution found.'}`));
  els.resultSummary.appendChild(statusLine);

  const objectiveLine = document.createElement('p');
  const objectiveStrong = document.createElement('strong');
  objectiveStrong.textContent = 'Objective (Z):';
  objectiveLine.appendChild(objectiveStrong);
  objectiveLine.appendChild(document.createTextNode(` ${formatNumber(data.objective_value)}`));
  els.resultSummary.appendChild(objectiveLine);

  const varsText = Object.entries(data.variable_values)
    .map(([name, value]) => `${name} = ${formatNumber(value)}`)
    .join(', ');

  const varsLine = document.createElement('p');
  const varsStrong = document.createElement('strong');
  varsStrong.textContent = 'Decision variables:';
  varsLine.appendChild(varsStrong);
  varsLine.appendChild(document.createTextNode(` ${varsText || 'None'}`));
  els.resultSummary.appendChild(varsLine);

  const phaseCounts = data.phase_counts;
  const totalIterations = phaseCounts.total;

  const iterationsLine = document.createElement('p');
  const iterationsStrong = document.createElement('strong');
  iterationsStrong.textContent = 'Iterations:';
  iterationsLine.appendChild(iterationsStrong);
  iterationsLine.appendChild(document.createTextNode(` ${String(totalIterations)}`));
  els.resultSummary.appendChild(iterationsLine);

  const methodLine = document.createElement('p');
  methodLine.className = 'method-line';
  methodLine.textContent = buildMethodLine(phaseCounts);
  els.resultSummary.appendChild(methodLine);

  renderStepsContainer(els.stepsContainer, data.steps);
  renderFeasibleRegion(els, data, payload);
}

export function renderResponse(els: AppElements, data: SolveResponse, payload: SolvePayload): void {
  if (!data.ok) {
    renderErrorResult(els, data, payload);
    return;
  }
  renderSuccessResult(els, data, payload);
}
