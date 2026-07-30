/**
 * Deterministic local PWA icon generator (no external artwork).
 * Run: node scripts/generate-icons.mjs
 */
import { createWriteStream } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ICONS_DIR = join(ROOT, 'public', 'icons');

/** Accent --accent (#245bdb) */
const ACCENT = { r: 36, g: 91, b: 219, a: 255 };
/** Page background --bg (#f4f5f7) for favicon ring */
const BG = { r: 244, g: 245, b: 247, a: 255 };
const WHITE = { r: 255, g: 255, b: 255, a: 255 };

function setPixel(png, x, y, color) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) {
    return;
  }
  const idx = (png.width * y + x) << 2;
  png.data[idx] = color.r;
  png.data[idx + 1] = color.g;
  png.data[idx + 2] = color.b;
  png.data[idx + 3] = color.a;
}

function fill(png, color) {
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      setPixel(png, x, y, color);
    }
  }
}

function drawFilledCircle(png, cx, cy, radius, color) {
  const r2 = radius * radius;
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) {
        setPixel(png, x, y, color);
      }
    }
  }
}

function drawSimplexTriangle(png, cx, cy, size, color) {
  const h = size * 0.866;
  const top = { x: cx, y: cy - (h * 2) / 3 };
  const left = { x: cx - size / 2, y: cy + h / 3 };
  const right = { x: cx + size / 2, y: cy + h / 3 };

  const minY = Math.floor(Math.min(top.y, left.y, right.y));
  const maxY = Math.ceil(Math.max(top.y, left.y, right.y));
  const minX = Math.floor(Math.min(top.x, left.x, right.x));
  const maxX = Math.ceil(Math.max(top.x, left.x, right.x));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (pointInTriangle(x + 0.5, y + 0.5, top, left, right)) {
        setPixel(png, x, y, color);
      }
    }
  }
}

function pointInTriangle(px, py, a, b, c) {
  const denom = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
  if (denom === 0) {
    return false;
  }
  const alpha = ((b.y - c.y) * (px - c.x) + (c.x - b.x) * (py - c.y)) / denom;
  const beta = ((c.y - a.y) * (px - c.x) + (a.x - c.x) * (py - c.y)) / denom;
  const gamma = 1 - alpha - beta;
  return alpha >= 0 && beta >= 0 && gamma >= 0;
}

function createIcon(size, maskable) {
  const png = new PNG({ width: size, height: size });
  fill(png, ACCENT);

  const safeFraction = maskable ? 0.72 : 0.82;
  const emblemRadius = (size * safeFraction) / 2;
  drawFilledCircle(png, size / 2, size / 2, emblemRadius, WHITE);
  drawSimplexTriangle(png, size / 2, size / 2, emblemRadius * 1.05, ACCENT);

  return png;
}

function createFavicon(size) {
  const png = new PNG({ width: size, height: size });
  fill(png, BG);
  drawFilledCircle(png, size / 2, size / 2, size * 0.42, ACCENT);
  drawSimplexTriangle(png, size / 2, size / 2, size * 0.38, WHITE);
  return png;
}

async function writePng(png, filePath) {
  await new Promise((resolve, reject) => {
    png
      .pack()
      .pipe(createWriteStream(filePath))
      .on('finish', resolve)
      .on('error', reject);
  });
}

async function main() {
  const { mkdir } = await import('node:fs/promises');
  await mkdir(ICONS_DIR, { recursive: true });

  await writePng(createIcon(192, false), join(ICONS_DIR, 'icon-192.png'));
  await writePng(createIcon(512, false), join(ICONS_DIR, 'icon-512.png'));
  await writePng(createIcon(512, true), join(ICONS_DIR, 'icon-512-maskable.png'));
  await writePng(createFavicon(32), join(ROOT, 'public', 'favicon.png'));

  console.log('Generated PWA icons in public/icons/ and public/favicon.png');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
