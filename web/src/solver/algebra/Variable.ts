/** A decision, slack, surplus, or artificial variable in an LP model. */
export class Variable {
  readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  equals(other: Variable): boolean {
    return this.name === other.name;
  }

  /** Deep-clone this variable (new instance, same name). */
  clone(): Variable {
    return new Variable(this.name);
  }
}

/** Yield variables ``prefix{start}``, ``prefix{start+1}``, ... */
export function* variableSequence(
  prefix: string,
  limit?: number,
  start = 1,
): Generator<Variable, void, undefined> {
  let value = start;
  while (limit === undefined || value < start + limit) {
    yield new Variable(`${prefix}${String(value)}`);
    value += 1;
  }
}
