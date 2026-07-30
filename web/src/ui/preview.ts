import type { SolvePayload } from './dom.ts';
import { formatNumber, formatObjectiveExpression } from './form.ts';

export function formatConstraintLine(row: SolvePayload['constraints'][number]): string {
  const lhs = formatObjectiveExpression(row.coefficients);
  const op = row.operator === '==' ? '=' : row.operator;
  return `${lhs} ${op} ${formatNumber(row.rhs)}`;
}

export function buildProblemPreviewText(payload: SolvePayload): string {
  const dir = payload.optimization === 'max' ? 'Max' : 'Min';
  const lines = [`${dir} Z = ${formatObjectiveExpression(payload.objective)}`, '', 'Subject to:'];
  for (const row of payload.constraints) {
    lines.push(formatConstraintLine(row));
  }
  const varNames = payload.objective.map((_, index) => `x${String(index + 1)}`).join(', ');
  lines.push('', `${varNames} >= 0`);
  return lines.join('\n');
}
