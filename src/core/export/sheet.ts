// Organização simples em chapa (prateleiras). Não é nesting: as peças ficam em grade pelo retângulo envolvente.

import type { GeometryResult, Part } from '../types';
import { bounds, translate } from '../geometry/clip';

export interface SheetItem {
  label: string;
  result: GeometryResult;
}

export interface Sheet {
  result: GeometryResult;
  labels: string[];
}

export function arrangeOnSheets(items: SheetItem[], sheetW: number, sheetH: number, gap: number): Sheet[] {
  const sized = items.map((it) => ({ it, b: bounds(...it.result.parts.map((p) => p.solid)) }));
  const sheets: { parts: Part[]; labels: string[] }[] = [];
  let cur = { parts: [] as Part[], labels: [] as string[] };
  let x = 0, y = 0, rowH = 0;

  const place = (s: (typeof sized)[number], px: number, py: number) => {
    const dx = px - s.b.x, dy = py - s.b.y;
    const idx = cur.labels.length;
    for (const p of s.it.result.parts) {
      cur.parts.push({
        ...p,
        id: `${p.id}-${idx}`,
        name: `${s.it.label} · ${p.name}`,
        solid: translate(p.solid, dx, dy),
        engrave: p.engrave && translate(p.engrave, dx, dy),
        score: p.score && translate(p.score, dx, dy),
        guides: undefined,
      });
    }
    cur.labels.push(s.it.label);
  };

  for (const s of sized) {
    if (x > 0 && x + s.b.w > sheetW) {
      x = 0;
      y += rowH + gap;
      rowH = 0;
    }
    if (y > 0 && y + s.b.h > sheetH) {
      sheets.push(cur);
      cur = { parts: [], labels: [] };
      x = 0; y = 0; rowH = 0;
    }
    place(s, x, y);
    x += s.b.w + gap;
    rowH = Math.max(rowH, s.b.h);
  }
  if (cur.labels.length) sheets.push(cur);
  return sheets.map((s) => ({ result: { parts: s.parts, issues: [] }, labels: s.labels }));
}
