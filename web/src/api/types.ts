export type OptimizationDirection = 'max' | 'min';

export type ConstraintOperator = '<=' | '>=' | '==';

export interface SolveConstraint {
  coefficients: number[];
  operator: ConstraintOperator;
  rhs: number;
}

export interface SolveRequest {
  optimization: OptimizationDirection;
  objective: number[];
  constraints: SolveConstraint[];
}

export interface PhaseCounts {
  phase_one: number;
  phase_two: number;
  total: number;
}

export type TableauFrame = string[][];

export interface SolveStep {
  index: number;
  enter: string | null;
  leave: string | null;
  tableau: TableauFrame;
  phase: string;
  phase_iteration?: number;
}

export interface SolveSuccessResponse {
  ok: true;
  status: 'optimal';
  status_label: string;
  objective_value: number;
  variable_values: Record<string, number>;
  step_count: number;
  phase_counts: PhaseCounts;
  steps: SolveStep[];
}

export interface SolveErrorResponse {
  ok: false;
  status: string;
  error_type: string;
  message: string;
}

export type SolveResponse = SolveSuccessResponse | SolveErrorResponse;

export interface ParityFixture {
  name: string;
  request: SolveRequest;
  response: SolveResponse;
}

export interface RepeatedSolveFixture {
  name: string;
  request: SolveRequest;
  response_first: SolveResponse;
  response_second: SolveResponse;
}
