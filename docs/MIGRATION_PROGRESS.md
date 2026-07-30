# Static PWA Migration Progress

## Checkpoint baseline (before Checkpoint 1)

| Item | Value |
| --- | --- |
| Branch | `feat/site-pwa` |
| Baseline commit | `7c78a0906300b2852b23c8700ee264a4d99e80d2` |
| Working tree | clean |
| Python tests | `211 passed` via project venv (`python -m pytest -v --tb=short` requires dev deps installed) |

## Checkpoint 1 — Scaffold and parity fixtures

**Status:** Complete

### Verification (Checkpoint 1)

| Command | Result |
| --- | --- |
| `PATH=".venv/bin:$PATH" python -m pytest -v --tb=short` | 211 passed |
| `cd web && npm install` | success |
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| `npm test` | 13 passed |
| `npm run build` | pass (`base: /sapro/` in production) |
| `git diff --check` | clean |

### Scope delivered

- Minimal `web/` Vite + Vanilla TypeScript scaffold (strict TS, Vitest, ESLint)
- GitHub Pages production base path `/sapro/` configured at Vite build time
- `tools/export_parity_fixtures.py` exports Python solver reference fixtures
- Committed fixtures under `web/fixtures/`
- Vitest fixture schema validation tests
- `.gitignore` updates for Node/Vite/coverage/Playwright artifacts only

### Explicitly not in Checkpoint 1

- Simplex algorithm port
- UI connection to existing Python web UI
- Changes to `src/sapro/` runtime files
- Windows packaging workflow changes
- GitHub Pages deployment workflow
- PWA service worker / manifest
- Playwright e2e (script stub only)

### Parity policy (approved)

1. Compare parsed semantic JSON results, not byte-identical serialization
2. Tableau numeric cells use tolerance; formatted strings tested separately later
3. PWA will use `vite-plugin-pwa` `generateSW` when added
4. Installability acceptance does not assume native browser install prompt in Playwright
5. CI Python tests use `python -m pytest -v --tb=short`
6. No root npm workspaces; Node tooling stays in `web/`
7. No `404.html` SPA fallback unless client-side routing is introduced

## Checkpoint 2 — Mathematical foundation

**Status:** Complete

### Scope delivered

- Typed solver error model with separate transport mapping
- Algebra port (`Variable`, `Expression`, `Constraint`, normalization)
- Dense matrix implementation with Gauss-Jordan inversion (partial pivoting)
- Numerical helpers centralized around `DEFAULT_EPSILON = 1e-9`
- Tableau numeric storage with formatted `string[][]` output
- `ftoa` / `formatTable` display utilities
- Vitest parity comparison helpers
- Focused unit tests for all foundation components
- Iteration-limit fixture exported via `build_simplex_problem` + `max_iterations`
- Stable fixture export metadata in `web/fixtures/_export_meta.json`

### Explicitly not in Checkpoint 2

- Simplex solve loop, Phase I/II, pivot selection, ratio tests, dual repair
- UI connection
- PWA / GitHub Pages deployment
- Playwright e2e

### Deferred fixtures

- **Numerical failure:** not exported. Python tests trigger this via internal
  `_apply_pivot` with a constructed near-zero pivot matrix, which is not
  reachable deterministically through the public coefficient-table API or
  `solve_coefficient_request()` path without modifying runtime code.

## Checkpoint 3 — Simplex engine and solveProblem()

**Status:** Complete

### Scope delivered

- Full Simplex engine port with two-phase, dual repair, cycle detection, iteration limits
- `parseCoefficientRequest()` validation mirroring Python web UI
- `buildSimplexProblem()` with fresh slack generators per request
- `collectTaggedSteps()` orchestration with phase metadata
- `solveProblem()` wired to in-memory solver (no fetch/DOM)
- Fixture-driven parity tests for all committed oracle fixtures
- Validation, regression, mutation-safety, and numerical-failure tests

### Explicitly not in Checkpoint 3

- UI connection to `index.html` / legacy `app.js`
- PWA / GitHub Pages deployment
- Playwright e2e

### Recommended Checkpoint 4 scope

- Port legacy UI modules to TypeScript and connect to `solveProblem()`
- Preserve DOM structure, copy, and feasible-region SVG behavior
- Still no PWA/Pages until UI parity is proven
