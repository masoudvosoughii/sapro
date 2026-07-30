import type { ConstraintOperator, SolveRequest } from '../api/types.ts';

export const MIN_DIM = 1;
export const MAX_DIM = 20;
export const UI_EPS = 1e-9;

export interface ExampleConstraintRow {
  coefficients: number[];
  operator: ConstraintOperator;
  rhs: number;
}

export interface ExampleDefinition {
  label: string;
  optimization: 'max' | 'min';
  numVars: number;
  numConstraints: number;
  objective: number[];
  constraints: ExampleConstraintRow[];
}

export interface AppElements {
  numVars: HTMLInputElement;
  numConstraints: HTMLInputElement;
  objectiveGrid: HTMLElement;
  constraintGrid: HTMLElement;
  problemPreview: HTMLPreElement;
  statusBox: HTMLElement;
  resultSummary: HTMLElement;
  feasibleViz: HTMLElement;
  feasibleNote: HTMLParagraphElement;
  stepsContainer: HTMLElement;
  exampleSelect: HTMLSelectElement;
  solveBtn: HTMLButtonElement;
  newProblemBtn: HTMLButtonElement;
  loadExampleBtn: HTMLButtonElement;
}

export type SolvePayload = SolveRequest;

export function requireElement<T extends HTMLElement>(id: string, ctor: new () => T): T {
  const element = document.getElementById(id);
  if (!(element instanceof ctor)) {
    throw new Error(`Missing #${id} element`);
  }
  return element;
}

export function getAppElements(): AppElements {
  return {
    numVars: requireElement('num-vars', HTMLInputElement),
    numConstraints: requireElement('num-constraints', HTMLInputElement),
    objectiveGrid: requireElement('objective-grid', HTMLElement),
    constraintGrid: requireElement('constraint-grid', HTMLElement),
    problemPreview: requireElement('problem-preview', HTMLPreElement),
    statusBox: requireElement('status-box', HTMLElement),
    resultSummary: requireElement('result-summary', HTMLElement),
    feasibleViz: requireElement('feasible-region-viz', HTMLElement),
    feasibleNote: requireElement('feasible-region-note', HTMLParagraphElement),
    stepsContainer: requireElement('steps-container', HTMLElement),
    exampleSelect: requireElement('example-select', HTMLSelectElement),
    solveBtn: requireElement('solve-btn', HTMLButtonElement),
    newProblemBtn: requireElement('new-problem-btn', HTMLButtonElement),
    loadExampleBtn: requireElement('load-example-btn', HTMLButtonElement),
  };
}
