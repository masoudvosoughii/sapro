import { UI_EPS, type AppElements, type SolvePayload, MAX_DIM, MIN_DIM } from './dom.ts';
import type { ExampleConstraintRow } from './dom.ts';

export function clampDimension(value: string | number): number {
  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed)) {
    return MIN_DIM;
  }
  return Math.min(MAX_DIM, Math.max(MIN_DIM, parsed));
}

export function getOptimization(): 'max' | 'min' {
  const selected = document.querySelector<HTMLInputElement>('input[name="optimization"]:checked');
  return selected?.value === 'min' ? 'min' : 'max';
}

export function setOptimization(value: 'max' | 'min'): void {
  const input = document.querySelector<HTMLInputElement>(`input[name="optimization"][value="${value}"]`);
  if (input) {
    input.checked = true;
  }
}

function makeNumberInput(value: number, onInput: () => void): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'number';
  input.step = 'any';
  input.value = String(value);
  input.addEventListener('input', onInput);
  return input;
}

export function renderObjectiveGrid(
  els: AppElements,
  numVars: number,
  values: number[] | null,
  onInput: () => void,
): void {
  els.objectiveGrid.replaceChildren();
  const table = document.createElement('table');
  table.className = 'coeff-grid';
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.appendChild(document.createElement('th'));
  for (let j = 0; j < numVars; j += 1) {
    const th = document.createElement('th');
    th.textContent = `x${String(j + 1)}`;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  const row = document.createElement('tr');
  const label = document.createElement('td');
  label.className = 'row-label';
  label.textContent = 'Objective';
  row.appendChild(label);
  for (let j = 0; j < numVars; j += 1) {
    const cell = document.createElement('td');
    const input = makeNumberInput(values ? (values[j] ?? 0) : 0, onInput);
    input.dataset['objectiveIndex'] = String(j);
    cell.appendChild(input);
    row.appendChild(cell);
  }
  tbody.appendChild(row);
  table.appendChild(tbody);
  els.objectiveGrid.appendChild(table);
}

export function renderConstraintGrid(
  els: AppElements,
  numVars: number,
  numConstraints: number,
  rows: ExampleConstraintRow[] | null,
  onInput: () => void,
): void {
  els.constraintGrid.replaceChildren();
  const table = document.createElement('table');
  table.className = 'coeff-grid';
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.appendChild(document.createElement('th'));
  for (let j = 0; j < numVars; j += 1) {
    const th = document.createElement('th');
    th.textContent = `x${String(j + 1)}`;
    headRow.appendChild(th);
  }
  for (const headerLabel of ['Operator', 'RHS']) {
    const th = document.createElement('th');
    th.textContent = headerLabel;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (let i = 0; i < numConstraints; i += 1) {
    const rowData = rows ? rows[i] : null;
    const tr = document.createElement('tr');
    const label = document.createElement('td');
    label.className = 'row-label';
    label.textContent = `C${String(i + 1)}`;
    tr.appendChild(label);

    for (let j = 0; j < numVars; j += 1) {
      const cell = document.createElement('td');
      const coef = rowData ? (rowData.coefficients[j] ?? 0) : 0;
      const input = makeNumberInput(coef, onInput);
      input.dataset['constraintIndex'] = String(i);
      input.dataset['varIndex'] = String(j);
      cell.appendChild(input);
      tr.appendChild(cell);
    }

    const opCell = document.createElement('td');
    const opSelect = document.createElement('select');
    for (const op of ['<=', '>=', '=='] as const) {
      const option = document.createElement('option');
      option.value = op;
      option.textContent = op;
      opSelect.appendChild(option);
    }
    opSelect.value = rowData ? rowData.operator : '<=';
    opSelect.dataset['constraintIndex'] = String(i);
    opSelect.dataset['role'] = 'operator';
    opSelect.addEventListener('change', onInput);
    opCell.appendChild(opSelect);
    tr.appendChild(opCell);

    const rhsCell = document.createElement('td');
    const rhsInput = makeNumberInput(rowData ? rowData.rhs : 0, onInput);
    rhsInput.dataset['constraintIndex'] = String(i);
    rhsInput.dataset['role'] = 'rhs';
    rhsCell.appendChild(rhsInput);
    tr.appendChild(rhsCell);

    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  els.constraintGrid.appendChild(table);
}

export function rebuildGrids(els: AppElements, onInput: () => void): void {
  const numVars = clampDimension(els.numVars.value);
  const numConstraints = clampDimension(els.numConstraints.value);
  els.numVars.value = String(numVars);
  els.numConstraints.value = String(numConstraints);
  renderObjectiveGrid(els, numVars, null, onInput);
  renderConstraintGrid(els, numVars, numConstraints, null, onInput);
}

export function collectPayload(els: AppElements): SolvePayload {
  const numVars = clampDimension(els.numVars.value);
  const numConstraints = clampDimension(els.numConstraints.value);
  const objective: number[] = [];
  for (let j = 0; j < numVars; j += 1) {
    const input = els.objectiveGrid.querySelector<HTMLInputElement>(`input[data-objective-index="${String(j)}"]`);
    objective.push(Number.parseFloat(input?.value ?? '0'));
  }

  const constraints: SolvePayload['constraints'] = [];
  for (let i = 0; i < numConstraints; i += 1) {
    const coefficients: number[] = [];
    for (let j = 0; j < numVars; j += 1) {
      const input = els.constraintGrid.querySelector<HTMLInputElement>(
        `input[data-constraint-index="${String(i)}"][data-var-index="${String(j)}"]`,
      );
      coefficients.push(Number.parseFloat(input?.value ?? '0'));
    }
    const operatorSelect = els.constraintGrid.querySelector<HTMLSelectElement>(
      `select[data-constraint-index="${String(i)}"][data-role="operator"]`,
    );
    const rhsInput = els.constraintGrid.querySelector<HTMLInputElement>(
      `input[data-constraint-index="${String(i)}"][data-role="rhs"]`,
    );
    const operator = operatorSelect?.value;
    if (operator !== '<=' && operator !== '>=' && operator !== '==') {
      throw new Error('Invalid operator in form');
    }
    constraints.push({
      coefficients,
      operator,
      rhs: Number.parseFloat(rhsInput?.value ?? '0'),
    });
  }

  return {
    optimization: getOptimization(),
    objective,
    constraints,
  };
}

export function formatNumber(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(6).replace(/\.?0+$/, '');
}

export function formatTerm(coef: number, varName: string, isFirst: boolean): string {
  if (Math.abs(coef) < UI_EPS) {
    return '';
  }
  const absCoef = Math.abs(coef);
  let coefPart = '';
  if (absCoef !== 1) {
    coefPart = formatNumber(absCoef);
  }
  const term = `${coefPart}${varName}`;
  if (isFirst) {
    return coef < 0 ? `-${term}` : term;
  }
  return coef < 0 ? ` - ${term}` : ` + ${term}`;
}

export function formatObjectiveExpression(objective: readonly number[]): string {
  let expr = '';
  let first = true;
  objective.forEach((coef, index) => {
    const part = formatTerm(coef, `x${String(index + 1)}`, first);
    if (part) {
      expr += part;
      first = false;
    }
  });
  return expr || '0';
}
