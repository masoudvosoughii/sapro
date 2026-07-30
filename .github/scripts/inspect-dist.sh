#!/usr/bin/env bash
set -euo pipefail

DIST_DIR="${1:-web/dist}"

require_file() {
  if [[ ! -f "$1" ]]; then
    echo "Missing required file: $1" >&2
    exit 1
  fi
}

require_dir() {
  if [[ ! -d "$1" ]]; then
    echo "Missing required directory: $1" >&2
    exit 1
  fi
}

echo "Inspecting production artifact at ${DIST_DIR}"

require_file "${DIST_DIR}/index.html"
require_file "${DIST_DIR}/manifest.webmanifest"
require_file "${DIST_DIR}/sw.js"
require_file "${DIST_DIR}/favicon.png"
require_file "${DIST_DIR}/icons/icon-192.png"
require_file "${DIST_DIR}/icons/icon-512.png"
require_file "${DIST_DIR}/icons/icon-512-maskable.png"

WORKBOX_COUNT="$(find "${DIST_DIR}" -maxdepth 1 -name 'workbox-*.js' | wc -l | tr -d ' ')"
if [[ "${WORKBOX_COUNT}" -lt 1 ]]; then
  echo "Missing Workbox runtime file in ${DIST_DIR}" >&2
  exit 1
fi

JS_COUNT="$(find "${DIST_DIR}/assets" -name '*.js' 2>/dev/null | wc -l | tr -d ' ')"
CSS_COUNT="$(find "${DIST_DIR}/assets" -name '*.css' 2>/dev/null | wc -l | tr -d ' ')"
if [[ "${JS_COUNT}" -lt 1 || "${CSS_COUNT}" -lt 1 ]]; then
  echo "Missing bundled JS/CSS assets under ${DIST_DIR}/assets" >&2
  exit 1
fi

if ! grep -q '/sapro/assets/' "${DIST_DIR}/index.html"; then
  echo "index.html does not reference /sapro/assets/" >&2
  exit 1
fi

MANIFEST="${DIST_DIR}/manifest.webmanifest"
if ! grep -q '"/sapro/"' "${MANIFEST}" && ! grep -q '"/sapro"' "${MANIFEST}"; then
  echo "manifest start_url/scope must use /sapro/" >&2
  exit 1
fi

if grep -qE 'https?://' "${DIST_DIR}/index.html" "${MANIFEST}"; then
  echo "Remote asset URL detected in production artifact" >&2
  exit 1
fi

if grep -qE '/Users/|C:\\\\Users' "${DIST_DIR}/index.html" "${DIST_DIR}/assets/"*.js 2>/dev/null; then
  echo "Developer-machine absolute path detected in artifact" >&2
  exit 1
fi

if grep -q '/api/solve' "${DIST_DIR}/assets/"*.js 2>/dev/null; then
  echo "/api/solve reference detected in production bundle" >&2
  exit 1
fi

if grep -q 'localhost' "${DIST_DIR}/assets/"*.js 2>/dev/null; then
  echo "localhost runtime dependency detected in production bundle" >&2
  exit 1
fi

if find "${DIST_DIR}" -name '*.py' | grep -q .; then
  echo "Python source file found in artifact" >&2
  exit 1
fi

if [[ -d "${DIST_DIR}/node_modules" ]]; then
  echo "node_modules must not be uploaded" >&2
  exit 1
fi

if find "${DIST_DIR}" -type d \( -name 'playwright-report' -o -name 'test-results' -o -name 'coverage' \) | grep -q .; then
  echo "Test or coverage output must not be uploaded" >&2
  exit 1
fi

# Guard against root-level /assets/ references in index.html (should be /sapro/assets/)
if grep -qE 'href="/assets/|src="/assets/' "${DIST_DIR}/index.html"; then
  echo "index.html references root-level /assets/ instead of /sapro/assets/" >&2
  exit 1
fi

echo "Production artifact inspection passed."
