export interface LpStep {
  readonly tableau: import('../tableau/Tableau.ts').Tableau;
  readonly enter: import('../algebra/Variable.ts').Variable | null;
  readonly leave: import('../algebra/Variable.ts').Variable | null;
}
