import type { ExampleDefinition } from './dom.ts';

export const EXAMPLES: Record<string, ExampleDefinition> = {
  readme: {
    label: 'Basic bounded maximization',
    optimization: 'max',
    numVars: 2,
    numConstraints: 3,
    objective: [1, 2],
    constraints: [
      { coefficients: [1, 1], operator: '<=', rhs: 4 },
      { coefficients: [-2, 1], operator: '<=', rhs: 1 },
      { coefficients: [1, 0], operator: '<=', rhs: 3 },
    ],
  },
  minimization: {
    label: 'Minimization',
    optimization: 'min',
    numVars: 2,
    numConstraints: 1,
    objective: [1, 1],
    constraints: [{ coefficients: [1, 1], operator: '>=', rhs: 4 }],
  },
  ge: {
    label: 'Greater-than-or-equal constraint',
    optimization: 'max',
    numVars: 1,
    numConstraints: 2,
    objective: [1],
    constraints: [
      { coefficients: [1], operator: '>=', rhs: 1 },
      { coefficients: [1], operator: '<=', rhs: 5 },
    ],
  },
  equality: {
    label: 'Equality constraint',
    optimization: 'max',
    numVars: 2,
    numConstraints: 1,
    objective: [1, 1],
    constraints: [{ coefficients: [1, 1], operator: '==', rhs: 4 }],
  },
  mixed: {
    label: 'Mixed operators',
    optimization: 'max',
    numVars: 2,
    numConstraints: 3,
    objective: [1, 2],
    constraints: [
      { coefficients: [1, 0], operator: '<=', rhs: 4 },
      { coefficients: [0, 1], operator: '>=', rhs: 1 },
      { coefficients: [1, 1], operator: '==', rhs: 3 },
    ],
  },
  negative_rhs: {
    label: 'Negative RHS',
    optimization: 'max',
    numVars: 1,
    numConstraints: 2,
    objective: [1],
    constraints: [
      { coefficients: [1], operator: '>=', rhs: -5 },
      { coefficients: [1], operator: '<=', rhs: 3 },
    ],
  },
  infeasible: {
    label: 'Infeasible problem',
    optimization: 'max',
    numVars: 2,
    numConstraints: 3,
    objective: [1, 1],
    constraints: [
      { coefficients: [1, 0], operator: '>=', rhs: 5 },
      { coefficients: [0, 1], operator: '>=', rhs: 5 },
      { coefficients: [1, 1], operator: '<=', rhs: 1 },
    ],
  },
  unbounded: {
    label: 'Unbounded problem',
    optimization: 'max',
    numVars: 2,
    numConstraints: 2,
    objective: [1, 1],
    constraints: [
      { coefficients: [1, 0], operator: '>=', rhs: 1 },
      { coefficients: [0, 1], operator: '>=', rhs: 2 },
    ],
  },
  decimal: {
    label: 'Decimal coefficients',
    optimization: 'max',
    numVars: 2,
    numConstraints: 2,
    objective: [2.5, 1.5],
    constraints: [
      { coefficients: [1.5, 1], operator: '<=', rhs: 4 },
      { coefficients: [1, 0], operator: '<=', rhs: 2 },
    ],
  },
};

export const EXAMPLE_KEYS = Object.keys(EXAMPLES);
