#!/usr/bin/env bash
set -euo pipefail

PAGE_URL="${1%/}/"

check_url() {
  local path="$1"
  local url="${PAGE_URL}${path#/}"
  echo "GET ${url}"
  curl --fail --silent --show-error --location --max-time 20 "${url}" >/dev/null
}

check_url "/"
check_url "manifest.webmanifest"
check_url "sw.js"
check_url "favicon.png"
check_url "icons/icon-192.png"
check_url "icons/icon-512.png"
check_url "icons/icon-512-maskable.png"

HTML="$(curl --fail --silent --show-error --location --max-time 20 "${PAGE_URL}")"
if ! grep -q '/simplex-solver/assets/' <<<"${HTML}" && ! grep -q 'assets/' <<<"${HTML}"; then
  echo "Hosted index HTML missing bundled asset references" >&2
  exit 1
fi

MANIFEST="$(curl --fail --silent --show-error --location --max-time 20 "${PAGE_URL}manifest.webmanifest")"
if ! grep -q '"/simplex-solver/"' <<<"${MANIFEST}" && ! grep -q '/simplex-solver/' <<<"${MANIFEST}"; then
  echo "Hosted manifest missing /simplex-solver/ start_url or scope" >&2
  exit 1
fi

if grep -qE 'https?://' <<<"${HTML}${MANIFEST}"; then
  echo "External runtime asset reference detected on hosted site" >&2
  exit 1
fi

echo "Hosted static asset verification passed."
