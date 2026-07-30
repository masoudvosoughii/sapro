/** Base class for linear programming solver errors. */
export class LpError extends Error {
  readonly kind: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
    this.kind = new.target.name;
  }
}

export class InvalidBaseError extends LpError {}

export class InvalidSlackError extends LpError {}

export class BaseAlreadySetError extends LpError {}

/** A linear program has no feasible solution. */
export class UnsolvableError extends LpError {}

/** A linear program is unbounded. */
export class BoundlessError extends LpError {}

/** The simplex algorithm encountered a cycling basis. */
export class CycleError extends LpError {}

/** The simplex calculation became numerically unsafe. */
export class NumericalFailureError extends LpError {}

/** The simplex iteration limit was reached before termination. */
export class IterationLimitError extends LpError {}

/** Singular or non-invertible matrix encountered during elimination. */
export class SingularMatrixError extends NumericalFailureError {}
