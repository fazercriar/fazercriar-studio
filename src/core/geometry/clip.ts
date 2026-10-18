// Operações booleanas e offset sobre `Shape`, usando Clipper (inteiros em micrômetros).

import * as ClipperNs from 'clipper-lib';
import type { Bounds, Poly, Pt, Shape } from '../types';

// clipper-lib é CommonJS: dependendo do empacotador ele chega como `default` ou como namespace.
const C: typeof ClipperNs = ((ClipperNs as unknown as { default?: typeof ClipperNs }).default ?? ClipperNs);

/** 1 mm = 1000 unidades inteiras (resolução de 1 µm). */
export const SCALE = 1000;

type IntPath = ClipperNs.IntPoint[];

const toPath = (p: Poly): IntPath => p.map((q) => ({ X: Math.round(q.x * SCALE), Y: Math.round(q.y * SCALE) }));
const toPaths = (s: Shape): IntPath[] => s.filter((p) => p.length >= 3).map(toPath);
const fromPath = (p: IntPath): Poly => p.map((q) => ({ x: q.X / SCALE, y: q.Y / SCALE }));
const fromPaths = (ps: IntPath[]): Shape => ps.filter((p) => p.length >= 3).map(fromPath);

export type FillRule = 'nonzero' | 'evenodd';

function fillType(rule: FillRule) {
  return rule === 'evenodd' ? C.PolyFillType.pftEvenOdd : C.PolyFillType.pftNonZero;
}

function exec(type: ClipperNs.ClipType, subj: Shape, clip: Shape | null, rule: FillRule = 'nonzero'): Shape {
  const c = new C.Clipper();
  c.AddPaths(toPaths(subj), C.PolyType.ptSubject, true);
  if (clip) c.AddPaths(toPaths(clip), C.PolyType.ptClip, true);
  const sol: IntPath[] = [];
  const ft = fillType(rule);
  c.Execute(type, sol, ft, ft);
  return fromPaths(sol);
}

/** União de todas as formas (regra nonzero por padrão, como em glifos TrueType). */
export function union(...shapes: Shape[]): Shape {
  return exec(C.ClipType.ctUnion, shapes.flat(), null);
}

/** Normaliza uma forma com a regra de preenchimento indicada. */
export function normalize(s: Shape, rule: FillRule = 'nonzero'): Shape {
  return exec(C.ClipType.ctUnion, s, null, rule);
}

export function difference(a: Shape, b: Shape): Shape {
  if (b.length === 0) return union(a);
  return exec(C.ClipType.ctDifference, a, b);
}

export function intersection(a: Shape, b: Shape): Shape {
  return exec(C.ClipType.ctIntersection, a, b);
}

/** Offset (positivo cresce, negativo encolhe). Cantos arredondados por padrão. */
export function offset(s: Shape, delta: number, join: 'round' | 'miter' = 'round'): Shape {
  const base = union(s);
  if (delta === 0 || base.length === 0) return base;
  const co = new C.ClipperOffset(2, 0.01 * SCALE);
  co.AddPaths(toPaths(base), join === 'round' ? C.JoinType.jtRound : C.JoinType.jtMiter, C.EndType.etClosedPolygon);
  const sol: IntPath[] = [];
  co.Execute(sol, delta * SCALE);
  return fromPaths(sol);
}

/**
 * Separa a forma em ilhas (peças independentes).
 * Cada ilha = [contorno externo, ...furos]. Ilhas dentro de furos viram ilhas próprias.
 */
export function islands(s: Shape): Shape[] {
  const c = new C.Clipper();
  c.AddPaths(toPaths(s), C.PolyType.ptSubject, true);
  const tree = new C.PolyTree();
  c.Execute(C.ClipType.ctUnion, tree, C.PolyFillType.pftNonZero, C.PolyFillType.pftNonZero);
  const out: Shape[] = [];
  const visit = (node: ClipperNs.PolyNode) => {
    for (const child of node.Childs()) {
      if (child.IsHole()) continue;
      const group: Shape = [fromPath(child.Contour())];
      for (const hole of child.Childs()) {
        group.push(fromPath(hole.Contour()));
        visit(hole);
      }
      out.push(group);
    }
  };
  visit(tree);
  return out;
}

/** Remove os furos: mantém apenas os contornos externos de cada ilha. */
export function fillHoles(s: Shape): Shape {
  return union(islands(s).map((g) => g[0]));
}

/** Preenche furos cuja menor dimensão é menor que `minSize` (bolsões que viram lascas no corte). */
export function fillSmallHoles(s: Shape, minSize: number): Shape {
  const small = islands(s).flatMap((g) => g.slice(1)).filter((h) => {
    const b = bounds([h]);
    return Math.min(b.w, b.h) < minSize;
  });
  return small.length ? union(s, small.map((h) => [...h].reverse())) : s;
}

// ---------- Medidas ----------

export function signedArea(p: Poly): number {
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j].x + p[i].x) * (p[j].y - p[i].y);
  return a / 2;
}

/** Área líquida de uma forma normalizada (externos menos furos). */
export function area(s: Shape): number {
  return islands(s).reduce((acc, g) => acc + Math.abs(signedArea(g[0])) - g.slice(1).reduce((h, p) => h + Math.abs(signedArea(p)), 0), 0);
}

export function perimeter(p: Poly): number {
  let l = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) l += Math.hypot(p[i].x - p[j].x, p[i].y - p[j].y);
  return l;
}

export function bounds(...shapes: Shape[]): Bounds {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of shapes) for (const p of s) for (const q of p) {
    if (q.x < x0) x0 = q.x;
    if (q.y < y0) y0 = q.y;
    if (q.x > x1) x1 = q.x;
    if (q.y > y1) y1 = q.y;
  }
  if (x0 === Infinity) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function centroid(p: Poly): Pt {
  const b = bounds([p]);
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

export function mapShape(s: Shape, f: (q: Pt) => Pt): Shape {
  return s.map((p) => p.map(f));
}

export function translate(s: Shape, dx: number, dy: number): Shape {
  return mapShape(s, (q) => ({ x: q.x + dx, y: q.y + dy }));
}

export function scale(s: Shape, sx: number, sy = sx, ox = 0, oy = 0): Shape {
  return mapShape(s, (q) => ({ x: ox + (q.x - ox) * sx, y: oy + (q.y - oy) * sy }));
}

export function pointInPoly(pt: Pt, p: Poly): boolean {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i], b = p[j];
    if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function segDist(pt: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / len2));
  return Math.hypot(pt.x - (a.x + t * dx), pt.y - (a.y + t * dy));
}

/** Menor distância entre um ponto e as arestas de uma forma. */
export function distanceToEdges(pt: Pt, s: Shape): number {
  let d = Infinity;
  for (const p of s) for (let i = 0, j = p.length - 1; i < p.length; j = i++) d = Math.min(d, segDist(pt, p[j], p[i]));
  return d;
}

/** Interseções de uma reta vertical x = cx com as arestas da forma (valores de y). */
export function verticalHits(s: Shape, cx: number): number[] {
  const ys: number[] = [];
  for (const p of s) for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[j], b = p[i];
    if ((a.x <= cx && b.x > cx) || (b.x <= cx && a.x > cx)) ys.push(a.y + ((cx - a.x) / (b.x - a.x)) * (b.y - a.y));
  }
  return ys.sort((m, n) => m - n);
}
