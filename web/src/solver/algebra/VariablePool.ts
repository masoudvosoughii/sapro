import { Variable } from './Variable.ts';

/** Cache pool allowing reuse of created variables by name. */
export class VariablePool {
  private readonly cache = new Map<string, Variable>();

  get(name: string): Variable {
    const existing = this.cache.get(name);
    if (existing !== undefined) {
      return existing;
    }
    const created = new Variable(name);
    this.cache.set(name, created);
    return created;
  }
}
