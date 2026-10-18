// Texto → curvas (opentype.js) → polígonos unidos.

import type { Font } from 'opentype.js';
import type { Bounds, Shape } from '../types';
import { bounds, union, scale as scaleShape } from './clip';
import { flattenCommands, type PathCmd } from './path';

/** Caracteres (sem contar espaços) que não existem na fonte. */
export function missingChars(font: Font, text: string): string[] {
  const out = new Set<string>();
  for (const ch of text) {
    if (/\s/.test(ch)) continue;
    if (font.charToGlyphIndex(ch) === 0) out.add(ch);
  }
  return [...out];
}

/** Altura das maiúsculas em unidades da fonte. */
export function capHeightUnits(font: Font): number {
  const os2 = (font.tables as { os2?: { sCapHeight?: number } }).os2;
  if (os2?.sCapHeight && os2.sCapHeight > 0) return os2.sCapHeight;
  const h = font.charToGlyph('H').getBoundingBox();
  return h.y2 > 0 ? h.y2 : font.unitsPerEm * 0.7;
}

function glyphByGlyph(font: Font, text: string, fontSize: number, letterSpacing: number): PathCmd[] {
  const k = fontSize / font.unitsPerEm;
  const out: PathCmd[] = [];
  let x = 0;
  let prev: ReturnType<Font['charToGlyph']> | null = null;
  for (const ch of text) {
    const g = font.charToGlyph(ch);
    if (prev) x += font.getKerningValue(prev, g) * k;
    out.push(...(g.getPath(x, 0, fontSize).commands as PathCmd[]));
    x += (g.advanceWidth ?? 0) * k + letterSpacing * fontSize;
    prev = g;
  }
  return out;
}

export interface TextShapeOptions {
  font: Font;
  text: string;
  /** Altura das letras maiúsculas, em mm. */
  capHeight: number;
  /** Espaço extra entre letras, em mm (pode ser negativo). */
  letterSpacing?: number;
  /** Escala horizontal (condensar < 1 < expandir). */
  scaleX?: number;
}

export interface TextShape {
  /** Linha de base em y = 0; letras acima ficam com y negativo. Começa em x ≈ 0. */
  shape: Shape;
  bounds: Bounds;
  fontSize: number;
}

export function textToShape(o: TextShapeOptions): TextShape {
  const fontSize = (o.capHeight * o.font.unitsPerEm) / capHeightUnits(o.font);
  const text = o.text.replace(/\s+/g, ' ');
  if (!text.trim()) return { shape: [], bounds: { x: 0, y: 0, w: 0, h: 0 }, fontSize };
  const letterSpacing = (o.letterSpacing ?? 0) / fontSize;
  let commands: PathCmd[];
  try {
    commands = o.font.getPath(text, 0, 0, fontSize, { kerning: true, letterSpacing }).commands as PathCmd[];
  } catch {
    // Algumas fontes usam substituições OpenType que o opentype.js não suporta:
    // desenha glifo a glifo, sem substituições, mantendo o kerning.
    commands = glyphByGlyph(o.font, text, fontSize, letterSpacing);
  }
  let shape = union(flattenCommands(commands));
  if (o.scaleX && o.scaleX !== 1) shape = scaleShape(shape, o.scaleX, 1);
  return { shape, bounds: bounds(shape), fontSize };
}
