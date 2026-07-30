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

### Recommended Checkpoint 2 scope

- Port algebra, constraint normalization, linear algebra helpers, and tableau formatting
- Begin Simplex engine port with fixture-driven Vitest parity tests (semantic + numeric tolerance)
- Still no UI wiring, PWA, or GitHub Pages deployment
