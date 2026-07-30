import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const PUBLIC_DIR = join(import.meta.dirname, '../public');

function readPngDimensions(filePath: string): { width: number; height: number } {
  const buffer = readFileSync(filePath);
  expect(buffer[0]).toBe(0x89);
  expect(buffer[1]).toBe(0x50);
  expect(buffer[2]).toBe(0x4e);
  expect(buffer[3]).toBe(0x47);
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return { width, height };
}

describe('PWA icon assets', () => {
  it('provides committed icons with valid PNG signatures and dimensions', () => {
    const cases = [
      { path: join(PUBLIC_DIR, 'icons', 'icon-192.png'), width: 192, height: 192 },
      { path: join(PUBLIC_DIR, 'icons', 'icon-512.png'), width: 512, height: 512 },
      { path: join(PUBLIC_DIR, 'icons', 'icon-512-maskable.png'), width: 512, height: 512 },
      { path: join(PUBLIC_DIR, 'favicon.png'), width: 32, height: 32 },
    ];

    for (const icon of cases) {
      const dimensions = readPngDimensions(icon.path);
      expect(dimensions.width).toBe(icon.width);
      expect(dimensions.height).toBe(icon.height);
    }
  });
});
