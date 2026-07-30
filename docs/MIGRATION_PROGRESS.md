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
| `npm run build` | pass (`base: /simplex-solver/` in production) |
| `git diff --check` | clean |

### Scope delivered

- Minimal `web/` Vite + Vanilla TypeScript scaffold (strict TS, Vitest, ESLint)
- GitHub Pages production base path `/simplex-solver/` configured at Vite build time
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

## Checkpoint 4 — UI port and in-memory solve wiring

**Status:** Complete (awaiting review; not committed)

### Baseline at start

| Item | Value |
| --- | --- |
| Branch | `feat/site-pwa` |
| Baseline commit | `fbcfeb4b8ec645a4c83b2178eee7b936ad8e7038` |
| Python tests | 211 passed |
| TypeScript tests (pre-UI) | 108 passed |

### Scope delivered

- Full HTML/CSS port from `src/sapro/index.html` and `static/style.css`
- Typed UI modules under `web/src/ui/` wired to in-memory `solveProblem()` (no fetch)
- All 9 built-in examples preserved with load + solve tests
- Problem preview, result summary, iteration panels, feasible-region SVG
- New Problem reset without page reload
- Vitest + jsdom UI/DOM integration tests (38 new tests; 146 total)
- Dual-repair regression test for `negative_rhs` example
- Fixture metadata: `source_commit` omitted from `_export_meta.json` to avoid commit-SHA noise

### Fixture metadata policy (Checkpoint 4)

`tools/export_parity_fixtures.py` no longer writes `source_commit` into
`web/fixtures/_export_meta.json`. The file remains informational (schema version,
Python/NumPy versions, fixture list) and is excluded from parity assertions.
Re-exporting fixtures on a new commit no longer rewrites metadata solely because
HEAD moved.

### Explicitly not in Checkpoint 4

- PWA (`vite-plugin-pwa`, service worker, manifest, icons)
- GitHub Pages deployment workflow
- Playwright e2e
- Changes to `src/sapro/`, `tests/`, packaging, or Windows workflow

### Recommended Checkpoint 5 scope

- Add `vite-plugin-pwa` with offline precache and safe update strategy
- Add GitHub Pages deploy workflow with `/simplex-solver/` base and SPA 404 fallback
- Add Playwright e2e for offline install, base path, and browser parity smoke tests

## Checkpoint 5 — PWA and Playwright browser verification

**Status:** Complete (awaiting review; not committed)

### Baseline at start

| Item | Value |
| --- | --- |
| Branch | `feat/site-pwa` |
| Baseline commit | `53a9e37d8ed03727dc5b46fdf955f0d87c9fb924` |
| Python tests | 211 passed |
| TypeScript tests (pre-PWA) | 147 passed |

### PWA architecture

- **Plugin:** `vite-plugin-pwa` v1.x with **`generateSW`** (Workbox)
- **Registration:** manual via `virtual:pwa-register` in `web/src/pwa/register.ts`
- **Update strategy:** `registerType: 'prompt'` — shows a small accessible banner;
  reload occurs only when the user clicks **Update** (no automatic `controllerchange` reload)
- **Offline guarantee:** after one online visit to `/simplex-solver/`, precached HTML/JS/CSS/manifest/icons
  allow full solver operation with `BrowserContext.setOffline(true)` — no HTTP API, no Python
- **Scope:** service worker, manifest, and assets are rooted at `/simplex-solver/`

### Manifest values

| Field | Value |
| --- | --- |
| `name` | Sapro Simplex Solver |
| `short_name` | Sapro |
| `description` | Offline linear programming solver using the Simplex method. |
| `display` | standalone |
| `orientation` | any |
| `theme_color` | `#245bdb` |
| `background_color` | `#f4f5f7` |
| `lang` | en |
| `dir` | ltr |
| `start_url` | `/simplex-solver/` |
| `scope` | `/simplex-solver/` |

### Icons

Deterministic PNG generation via `web/scripts/generate-icons.mjs` (uses `pngjs`, accent triangle motif):

| File | Dimensions |
| --- | --- |
| `public/icons/icon-192.png` | 192×192 |
| `public/icons/icon-512.png` | 512×512 |
| `public/icons/icon-512-maskable.png` | 512×512 (maskable safe zone) |
| `public/favicon.png` | 32×32 |

Vitest test `tests/pwa-icons.test.ts` verifies PNG signatures and dimensions.

### Playwright setup

- Config: `web/playwright.config.ts`
- Tests: `web/e2e/smoke.spec.ts` (Chromium via system Chrome, Firefox, WebKit) and
  `web/e2e/pwa/offline.spec.ts` (Chromium PWA/offline only)
- **Production server:** `npm run build && npm run preview -- --host 127.0.0.1 --port 4173`
- Scripts: `npm run test:e2e`, `npm run test:e2e:headed`

#### Local PWA testing

```bash
cd web
npm ci
npm run generate:icons   # only needed when icon script changes
npm run build
npx playwright install chromium firefox webkit
# If Playwright CDN is geo-blocked:
# PLAYWRIGHT_DOWNLOAD_HOST=https://npmmirror.com/mirrors/playwright/ npx playwright install chromium firefox webkit
npm run test:e2e
```

Chromium projects use **`channel: 'chrome'`** (system Google Chrome) when Playwright's
bundled Chromium CDN is unavailable.

### Browser limitations

- **Native install prompt** (`beforeinstallprompt`) is **not** asserted — only manifest,
  icons, service-worker registration, and offline functionality
- **No `404.html` SPA fallback** — single-page app with no client-side routing; only `/simplex-solver/` exists
- **No GitHub Pages deployment** in this checkpoint (deferred to Checkpoint 6)

### Explicitly not in Checkpoint 5

- GitHub Pages workflow or deployment
- `404.html` fallback
- `injectManifest` or custom service worker source
- UI redesign or solver changes

### Recommended Checkpoint 6 scope

- Add `.github/workflows/deploy-pages.yml` for GitHub Pages at `/simplex-solver/`
- CI browser installation (`playwright install`) with mirror fallback if needed
- Post-deploy smoke verification

## Checkpoint 6 — GitHub Pages CI/CD

**Status:** Complete (awaiting review; not committed)

### Baseline at start

| Item | Value |
| --- | --- |
| Branch | `feat/site-pwa` |
| Baseline commit | `ef0fa38f9accf781406407cbba8ad74e3c3dad07` |
| Python tests | 211 passed |
| TypeScript tests | 147 passed |
| Local Playwright | 50 passed |

### Workflow

| Item | Value |
| --- | --- |
| File | `.github/workflows/deploy-pages.yml` |
| Name | Deploy Sapro PWA to GitHub Pages |
| Trigger | **`workflow_dispatch` only** |
| Automatic push deployment | **Not enabled** (deferred until merge to `simplex-project`) |
| Concurrency | `group: pages`, `cancel-in-progress: false` |
| Artifact uploaded | **`web/dist` only** |
| Expected hosted URL | `https://masoudvosoughii.github.io/simplex-solver/` |

### Jobs

1. **build** — Python 3.13 + Node 22 tests, production build, artifact inspection,
   Playwright E2E, configure/upload Pages artifact
2. **deploy** — `actions/deploy-pages@v4` to `github-pages` environment
3. **post-deploy-smoke** — HTTP retries + `npm run test:e2e:deployed` against
   `${{ needs.deploy.outputs.page_url }}`

### Action versions

- `actions/checkout@v6`
- `actions/setup-python@v6`
- `actions/setup-node@v6`
- `actions/configure-pages@v5`
- `actions/upload-pages-artifact@v4`
- `actions/deploy-pages@v4`
- `actions/upload-artifact@v4` (Playwright diagnostics on failure, 7-day retention)

### Deployed Playwright smoke

- File: `web/e2e/deployed.spec.ts`
- Script: `npm run test:e2e:deployed`
- Env: `E2E_BASE_URL` (from deploy job output; no local preview server)
- Browser: Chromium only, one worker in CI, clean contexts

### Manual GitHub Pages enablement (required)

Cursor cannot change repository settings. After pushing the workflow:

1. **Settings → Pages → Build and deployment → Source → GitHub Actions**
2. **Actions → Deploy Sapro PWA to GitHub Pages → Run workflow → Branch: `feat/site-pwa`**

Deployment is not active until both steps are completed.

### Explicitly not in Checkpoint 6

- Merge of `feat/site-pwa` into `simplex-project`
- Automatic deployment on push
- `404.html` SPA fallback
- Changes to Python solver, packaging, or Windows workflow

### Recommended post-merge step (future)

After PWA acceptance and merge to `simplex-project`, add:

```yaml
on:
  workflow_dispatch:
  push:
    branches:
      - simplex-project
```

Only after explicit final acceptance.
