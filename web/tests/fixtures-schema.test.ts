import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  assertParityFixture,
  assertRepeatedSolveFixture,
} from './fixture-schema.ts';

const FIXTURES_DIR = join(import.meta.dirname, '..', 'fixtures');

function loadJson(fileName: string): unknown {
  const raw = readFileSync(join(FIXTURES_DIR, fileName), 'utf8');
  return JSON.parse(raw) as unknown;
}

describe('parity fixture schema', () => {
  const fixtureFiles = readdirSync(FIXTURES_DIR)
    .filter((fileName) => fileName.endsWith('.json') && !fileName.startsWith('_'))
    .sort();

  it('exports at least the built-in example set', () => {
    expect(fixtureFiles.length).toBeGreaterThanOrEqual(9);
  });

  for (const fileName of fixtureFiles) {
    it(`validates ${fileName}`, () => {
      const payload = loadJson(fileName);
      if (fileName === 'repeated_solve_readme.json') {
        assertRepeatedSolveFixture(payload);
        return;
      }
      assertParityFixture(payload);
    });
  }
});

describe('readme oracle sanity', () => {
  it('matches the documented primary example solution', () => {
    const payload = loadJson('readme.json');
    assertParityFixture(payload);
    if (!payload.response.ok) {
      throw new Error('readme fixture must succeed');
    }
    expect(payload.response.objective_value).toBeCloseTo(7, 9);
    expect(payload.response.variable_values['x1']).toBeCloseTo(1, 9);
    expect(payload.response.variable_values['x2']).toBeCloseTo(3, 9);
    expect(payload.response.step_count).toBe(3);
  });
});

describe('repeated solve stability', () => {
  it('returns identical semantic results for repeated readme solves', () => {
    const payload = loadJson('repeated_solve_readme.json');
    assertRepeatedSolveFixture(payload);
    expect(payload.response_first).toEqual(payload.response_second);
  });
});
