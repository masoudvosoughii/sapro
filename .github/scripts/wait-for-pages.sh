#!/usr/bin/env bash
set -euo pipefail

PAGE_URL="${1%/}/"
MAX_ATTEMPTS=18
SLEEP_SECONDS=10

echo "Waiting for GitHub Pages propagation at ${PAGE_URL}"

for attempt in $(seq 1 "${MAX_ATTEMPTS}"); do
  if curl --fail --silent --show-error --location --max-time 20 "${PAGE_URL}" >/dev/null; then
    echo "Hosted root responded on attempt ${attempt}/${MAX_ATTEMPTS}"
    exit 0
  fi
  echo "Attempt ${attempt}/${MAX_ATTEMPTS} failed; retrying in ${SLEEP_SECONDS}s"
  sleep "${SLEEP_SECONDS}"
done

echo "Timed out waiting for ${PAGE_URL} (max $((MAX_ATTEMPTS * SLEEP_SECONDS))s)" >&2
exit 1
