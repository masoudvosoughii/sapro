/** Default numerical tolerance for the simplex engine (matches Python). */
export const DEFAULT_EPSILON = 1e-9;

/** Default maximum pivot operations per phase invocation (matches Python). */
export const DEFAULT_MAX_ITERATIONS = 10_000;

/** Maximum decision variables and constraints supported by the solver. */
export const MAX_DIMENSION = 20;

/** Default maximum denominator when formatting fractions in ``ftoa``. */
export const DEFAULT_FRACTION_LIMIT = 1_000_000;
