import {
  Constraint,
  Expression,
  Variable,
  variableSequence,
} from './algebra/index.ts';
import { Simplex } from './simplex/Simplex.ts';
import type { ParsedSolveRequest } from '../api/validation.ts';

function slackVarGenerator(numDecisionVars: number): Iterator<Variable> {
  return variableSequence('s', undefined, numDecisionVars + 1);
}

/** Build a fresh Simplex problem from a validated coefficient request. */
export function buildSimplexProblem(request: ParsedSolveRequest): Simplex {
  const variables = request.objective.map((_, index) => new Variable(`x${String(index + 1)}`));
  const objective = new Expression(
    variables.map((variable, index) => [variable, request.objective[index] ?? 0]),
  );

  const constraints = request.constraints.map((row) => {
    const coefs: Array<[Variable, number]> = variables.map(
      (variable, index) => [variable, row.coefficients[index] ?? 0],
    );
    return new Constraint(coefs, row.rhs, row.operator);
  });

  return new Simplex(objective, constraints, {
    vs: variables,
    maximize: request.optimization === 'max',
    slackVarGenerator: slackVarGenerator(variables.length),
  });
}
