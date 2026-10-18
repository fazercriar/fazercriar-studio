import fs from 'node:fs';
import path from 'node:path';
import { parse, type Font } from 'opentype.js';
import { FONT_CATALOG, createFontRegistry } from '../src/core/fonts';
import { createFrameRegistry } from '../src/core/frames';
import { loadBuiltInFrames } from '../src/models/enfeite-natal/frames';
import { DEFAULT_SETTINGS } from '../src/core/settings';
import type { GenContext } from '../src/core/types';

let cached: GenContext | null = null;

export function testContext(): GenContext {
  if (cached) return cached;
  const fonts = new Map<string, Font>();
  for (const f of FONT_CATALOG) {
    const buf = fs.readFileSync(path.resolve('node_modules', f.file));
    fonts.set(f.id, parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)));
  }
  const { frames, errors } = loadBuiltInFrames();
  if (errors.length) throw new Error(errors.join('\n'));
  cached = { fonts: createFontRegistry(fonts), frames: createFrameRegistry(frames) };
  return cached;
}

export const MDF3 = DEFAULT_SETTINGS.materials[0];
export const MACHINE = DEFAULT_SETTINGS.machine;
export const PRICING = DEFAULT_SETTINGS.pricing;
export const COLORS = DEFAULT_SETTINGS.colors;
