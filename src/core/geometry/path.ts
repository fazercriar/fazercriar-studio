// Conversão de caminhos (opentype e SVG) em polígonos, e formas básicas.

import svgpath from 'svgpath';
import type { Poly, Shape } from '../types';

export type PathCmd =
  | { type: 'M'; x: number; y: number }
  | { type: 'L'; x: number; y: number }
  | { type: 'Q'; x1: number; y1: number; x: number; y: number }
  | { type: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { type: 'Z' };

/** Comprimento alvo de cada segmento ao achatar curvas (mm). */
export const SEGMENT_MM = 0.25;

function steps(len: number, seg: number): number {
  return Math.max(2, Math.min(64, Math.ceil(len / seg)));
}

/** Achata curvas Bézier em segmentos retos. Cada subcaminho vira um polígono fechado. */
export function flattenCommands(cmds: PathCmd[], seg = SEGMENT_MM): Shape {
  const out: Shape = [];
  let cur: Poly = [];
  let x = 0, y = 0, sx = 0, sy = 0;
  const close = () => {
    const clean = cur.filter((q, i) => i === 0 || Math.abs(q.x - cur[i - 1].x) > 1e-9 || Math.abs(q.y - cur[i - 1].y) > 1e-9);
    if (clean.length >= 3) out.push(clean);
    cur = [];
  };
  for (const c of cmds) {
    switch (c.type) {
      case 'M':
        close();
        x = sx = c.x;
        y = sy = c.y;
        cur.push({ x, y });
        break;
      case 'L':
        x = c.x;
        y = c.y;
        cur.push({ x, y });
        break;
      case 'Q': {
        const n = steps(Math.hypot(c.x1 - x, c.y1 - y) + Math.hypot(c.x - c.x1, c.y - c.y1), seg);
        for (let i = 1; i <= n; i++) {
          const t = i / n, u = 1 - t;
          cur.push({ x: u * u * x + 2 * u * t * c.x1 + t * t * c.x, y: u * u * y + 2 * u * t * c.y1 + t * t * c.y });
        }
        x = c.x;
        y = c.y;
        break;
      }
      case 'C': {
        const n = steps(Math.hypot(c.x1 - x, c.y1 - y) + Math.hypot(c.x2 - c.x1, c.y2 - c.y1) + Math.hypot(c.x - c.x2, c.y - c.y2), seg);
        for (let i = 1; i <= n; i++) {
          const t = i / n, u = 1 - t;
          cur.push({
            x: u * u * u * x + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x,
            y: u * u * u * y + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y,
          });
        }
        x = c.x;
        y = c.y;
        break;
      }
      case 'Z':
        close();
        x = sx;
        y = sy;
        break;
    }
  }
  close();
  return out;
}

/** Como flattenCommands, mas mantém subcaminhos abertos e informa se cada um é fechado. */
export function flattenSubpaths(cmds: PathCmd[], seg = SEGMENT_MM, tol = 0.01): { poly: Poly; closed: boolean }[] {
  const out: { poly: Poly; closed: boolean }[] = [];
  let cur: PathCmd[] = [];
  let explicit = false;
  const flush = () => {
    const pts = flattenCommands(cur, seg)[0] ?? (cur.length === 2 && cur[1].type === 'L' && cur[0].type === 'M' ? [cur[0], cur[1]].map((c) => ({ x: (c as { x: number }).x, y: (c as { y: number }).y })) : null);
    if (pts && pts.length >= 2) {
      const a = pts[0], b = pts[pts.length - 1];
      const closed = explicit || Math.hypot(a.x - b.x, a.y - b.y) < tol;
      out.push({ poly: closed && Math.hypot(a.x - b.x, a.y - b.y) < tol && pts.length > 3 ? pts.slice(0, -1) : pts, closed: closed && pts.length >= 3 });
    }
    cur = [];
    explicit = false;
  };
  for (const c of cmds) {
    if (c.type === 'M' && cur.length) flush();
    if (c.type === 'Z') {
      explicit = true;
      flush();
      continue;
    }
    cur.push(c);
  }
  if (cur.length) flush();
  return out;
}

/** Converte o atributo `d` de um caminho SVG (com transformação opcional) em comandos absolutos. */
export function svgPathToCommands(d: string, transform?: string): PathCmd[] {
  let p = svgpath(d).abs().unarc().unshort();
  if (transform) p = p.transform(transform).abs().unarc().unshort();
  const cmds: PathCmd[] = [];
  let x = 0, y = 0;
  p.iterate((s: (string | number)[]) => {
    const t = s[0] as string;
    const n = s.slice(1) as number[];
    switch (t) {
      case 'M': x = n[0]; y = n[1]; cmds.push({ type: 'M', x, y }); break;
      case 'L': x = n[0]; y = n[1]; cmds.push({ type: 'L', x, y }); break;
      case 'H': x = n[0]; cmds.push({ type: 'L', x, y }); break;
      case 'V': y = n[0]; cmds.push({ type: 'L', x, y }); break;
      case 'Q': cmds.push({ type: 'Q', x1: n[0], y1: n[1], x: n[2], y: n[3] }); x = n[2]; y = n[3]; break;
      case 'C': cmds.push({ type: 'C', x1: n[0], y1: n[1], x2: n[2], y2: n[3], x: n[4], y: n[5] }); x = n[4]; y = n[5]; break;
      case 'Z': case 'z': cmds.push({ type: 'Z' }); break;
    }
  });
  return cmds;
}

// ---------- Formas básicas ----------

export function circle(cx: number, cy: number, r: number, seg = 0.2): Poly {
  const n = Math.max(32, Math.min(360, Math.ceil((2 * Math.PI * r) / seg)));
  const out: Poly = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return out;
}

export function rect(x: number, y: number, w: number, h: number): Poly {
  return [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
}

export function roundedRect(x: number, y: number, w: number, h: number, r: number, seg = 0.2): Poly {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  if (r === 0) return rect(x, y, w, h);
  const n = Math.max(6, Math.ceil((Math.PI * r) / 2 / seg));
  const out: Poly = [];
  const corner = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i <= n; i++) {
      const a = a0 + (i / n) * (Math.PI / 2);
      out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
  };
  corner(x + w - r, y + r, -Math.PI / 2);
  corner(x + w - r, y + h - r, 0);
  corner(x + r, y + h - r, Math.PI / 2);
  corner(x + r, y + r, Math.PI);
  return out;
}

/** Converte polígonos em `d` de SVG (usado pela prévia e pelo exportador). */
export function shapeToD(s: Shape, digits = 3): string {
  const f = (n: number) => {
    const v = Number(n.toFixed(digits));
    return Object.is(v, -0) ? '0' : String(v);
  };
  return s
    .filter((p) => p.length >= 3)
    .map((p) => 'M' + p.map((q) => `${f(q.x)} ${f(q.y)}`).join('L') + 'Z')
    .join('');
}
