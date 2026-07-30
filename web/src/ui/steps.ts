import type { PhaseCounts } from '../api/types.ts';
import type { SolveStep, TableauFrame } from '../api/types.ts';

export function buildMethodLine(phaseCounts: PhaseCounts | null | undefined): string {
  if (!phaseCounts || phaseCounts.phase_one === 0) {
    return 'Method: Simplex';
  }
  return `Method: Two-Phase Simplex · Phase I: ${String(phaseCounts.phase_one)} · Phase II: ${String(phaseCounts.phase_two)}`;
}

export function formatStepHeading(step: Pick<SolveStep, 'index' | 'enter' | 'leave'>): string {
  if (step.enter && step.leave) {
    return `Step ${String(step.index)}: ${step.enter} enters, ${step.leave} leaves`;
  }
  if (step.enter) {
    return `Step ${String(step.index)}: ${step.enter} enters`;
  }
  if (step.leave) {
    return `Step ${String(step.index)}: ${step.leave} leaves`;
  }
  return `Step ${String(step.index)}`;
}

export function createTableauElement(tableau: TableauFrame | null | undefined): HTMLElement {
  if (!tableau || tableau.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No tableau data.';
    return empty;
  }

  const headers = tableau[0];
  const bodyRows = tableau.slice(1, -1);
  const footer = tableau[tableau.length - 1];

  const table = document.createElement('table');
  table.className = 'tableau';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const header of headers ?? []) {
    const th = document.createElement('th');
    th.textContent = header;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const row of bodyRows) {
    const tr = document.createElement('tr');
    for (const cell of row) {
      const td = document.createElement('td');
      td.textContent = cell;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }

  const footerRow = document.createElement('tr');
  for (const cell of footer ?? []) {
    const td = document.createElement('td');
    td.textContent = cell;
    footerRow.appendChild(td);
  }
  tbody.appendChild(footerRow);
  table.appendChild(tbody);

  return table;
}

export function renderStepsContainer(container: HTMLElement, steps: readonly SolveStep[] | null | undefined): void {
  container.replaceChildren();
  if (!steps || steps.length === 0) {
    return;
  }

  for (const step of steps) {
    const details = document.createElement('details');
    details.className = 'step-panel';

    const summary = document.createElement('summary');
    summary.textContent = formatStepHeading(step);
    summary.setAttribute('aria-expanded', 'false');
    details.appendChild(summary);

    const body = document.createElement('div');
    body.className = 'step-body math-ltr';
    body.appendChild(createTableauElement(step.tableau));
    details.appendChild(body);

    details.addEventListener('toggle', () => {
      summary.setAttribute('aria-expanded', details.open ? 'true' : 'false');
    });

    container.appendChild(details);
  }
}
