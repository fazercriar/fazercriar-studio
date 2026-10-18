// Importação de desenhos (SVG ou DXF) como "linhas" selecionáveis, e montagem de uma
// moldura a partir das funções atribuídas a cada linha.

import DxfParser from 'dxf-parser';
import type { Bounds, Poly, Pt } from '../types';
import { bounds, signedArea } from '../geometry/clip';
import { flattenSubpaths, shapeToD, svgPathToCommands } from '../geometry/path';
import { elementToD, parseFrameSvg, transformChain, type FrameParseResult } from '../frames';

export type Role = 'contorno' | 'janela' | 'furo' | 'recortes' | 'gravacao' | 'apagar';

export const ROLES: { id: Role; label: string; color: string; key: string; help: string }[] = [
  { id: 'contorno', label: 'Contorno', color: '#1E1E1E', key: 'C', help: 'Forma externa da peça' },
  { id: 'janela', label: 'Janela', color: '#00A3C4', key: 'J', help: 'Onde o nome entra. Várias linhas = envoltória delas' },
  { id: 'furo', label: 'Furo', color: '#7B3FE4', key: 'F', help: 'Furo para pendurar' },
  { id: 'recortes', label: 'Recortes', color: '#FF6A00', key: 'R', help: 'Furos decorativos vazados' },
  { id: 'gravacao', label: 'Gravação', color: '#8B5A2B', key: 'G', help: 'Desenhos gravados (preenchidos)' },
  { id: 'apagar', label: 'Apagar', color: '#B0B0B0', key: 'Del', help: 'Ignorar (ex.: letras antigas)' },
];

export interface Contour {
  id: string;
  label: string;
  poly: Poly;
  closed: boolean;
  /** Função que o próprio arquivo já indicava (ids de uma moldura preparada). */
  role?: Role;
}

export interface ImportResult {
  contours: Contour[];
  warnings: string[];
}

const ROLE_IDS = new Set<string>(ROLES.map((r) => r.id));
const CHAIN_TOL = 0.05;

// ---------- SVG ----------

const UNIT_MM: Record<string, number> = { mm: 1, cm: 10, in: 25.4, pt: 25.4 / 72, pc: 25.4 / 6, px: 25.4 / 96, '': 25.4 / 96 };

function lengthMm(v: string | null): number | null {
  const m = v?.trim().match(/^([\d.]+)\s*(mm|cm|in|pt|pc|px)?$/i);
  return m ? parseFloat(m[1]) * UNIT_MM[(m[2] ?? '').toLowerCase()] : null;
}

export function importSvg(text: string): ImportResult {
  const warnings: string[] = [];
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.localName.toLowerCase() !== 'svg' || doc.getElementsByTagName('parsererror').length) {
    throw new Error('O arquivo não é um SVG válido.');
  }
  const vb = (root.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number);
  const hasVb = vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0;
  const wMm = lengthMm(root.getAttribute('width'));
  let k = 1;
  if (hasVb && wMm) k = wMm / vb[2];
  else if (!hasVb && wMm) k = wMm / parseFloat(root.getAttribute('width')!);
  else warnings.push('O SVG não informa a unidade; considerei 1 unidade = 1 mm.');
  const [ox, oy] = hasVb ? [vb[0], vb[1]] : [0, 0];

  const skip = (el: Element) => !!el.closest('defs, clipPath, mask, symbol, pattern, marker, metadata');
  const els = [...root.querySelectorAll('path, rect, circle, ellipse, polygon, polyline, line')].filter((e) => !skip(e));
  const contours: Contour[] = [];
  const counter: Record<string, number> = {};

  els.forEach((el, i) => {
    const tag = el.localName.toLowerCase();
    let d: string | null;
    if (tag === 'line') d = `M${el.getAttribute('x1') ?? 0} ${el.getAttribute('y1') ?? 0}L${el.getAttribute('x2') ?? 0} ${el.getAttribute('y2') ?? 0}`;
    else if (tag === 'polyline') d = (elementToD(el) ?? '').replace(/Z$/, '');
    else d = elementToD(el);
    if (!d) return;

    let role: Role | undefined;
    for (let e: Element | null = el; e && e !== root; e = e.parentElement) {
      const id = e.getAttribute('id');
      if (id && ROLE_IDS.has(id)) {
        role = id as Role;
        break;
      }
    }
    const tf = transformChain(el, root);
    const subs = flattenSubpaths(svgPathToCommands(d, tf || undefined));
    counter[tag] = (counter[tag] ?? 0) + 1;
    const base = el.getAttribute('id') || `${tag} ${counter[tag]}`;
    subs.forEach((s, j) => {
      contours.push({
        id: `s${i}-${j}`,
        label: subs.length > 1 ? `${base} · parte ${j + 1}` : base,
        poly: s.poly.map((q) => ({ x: (q.x - ox) * k, y: (q.y - oy) * k })),
        closed: s.closed,
        role,
      });
    });
  });
  return { contours: chainOpen(contours), warnings };
}

// ---------- DXF ----------

interface DxfV { x: number; y: number; bulge?: number }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DxfEntity = any;

const INSUNITS_MM: Record<number, number> = { 1: 25.4, 2: 304.8, 4: 1, 5: 10, 6: 1000 };

function arcPoints(cx: number, cy: number, r: number, a0: number, a1: number, seg = 0.25): Pt[] {
  let sweep = a1 - a0;
  while (sweep <= 0) sweep += Math.PI * 2;
  const n = Math.max(4, Math.min(360, Math.ceil((r * sweep) / seg)));
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + (sweep * i) / n;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
}

/** Segmento com "bulge" (arco) entre dois vértices de polilinha. */
function bulgePoints(p: DxfV, q: DxfV): Pt[] {
  const b = p.bulge ?? 0;
  if (!b) return [{ x: p.x, y: p.y }];
  // Ângulo do arco = 4·atan(bulge); positivo = anti-horário (Y para cima, como no DXF).
  const theta = 4 * Math.atan(b);
  const chord = Math.hypot(q.x - p.x, q.y - p.y);
  if (chord === 0) return [{ x: p.x, y: p.y }];
  const h = chord / (2 * Math.tan(theta / 2));
  const nx = -(q.y - p.y) / chord, ny = (q.x - p.x) / chord;
  const cx = (p.x + q.x) / 2 + nx * h, cy = (p.y + q.y) / 2 + ny * h;
  const r = Math.hypot(p.x - cx, p.y - cy);
  const a0 = Math.atan2(p.y - cy, p.x - cx);
  const n = Math.max(4, Math.ceil((r * Math.abs(theta)) / 0.25));
  return Array.from({ length: n }, (_, i) => ({ x: cx + r * Math.cos(a0 + (theta * i) / n), y: cy + r * Math.sin(a0 + (theta * i) / n) }));
}

function splinePoints(e: DxfEntity): Pt[] {
  const cps: DxfV[] = e.controlPoints ?? [];
  const deg: number = e.degreeOfSplineCurve ?? 3;
  const knots: number[] = e.knotValues ?? [];
  if (cps.length < 2 || knots.length !== cps.length + deg + 1) return (e.fitPoints ?? cps).map((v: DxfV) => ({ x: v.x, y: v.y }));
  const t0 = knots[deg], t1 = knots[knots.length - deg - 1];
  const n = Math.max(16, cps.length * 12);
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = Math.min(t0 + ((t1 - t0) * i) / n, t1 - 1e-9 * (t1 - t0));
    let s = deg;
    while (s < knots.length - deg - 2 && t >= knots[s + 1]) s++;
    const d = Array.from({ length: deg + 1 }, (_, j) => ({ ...cps[j + s - deg] }));
    for (let r = 1; r <= deg; r++) {
      for (let j = deg; j >= r; j--) {
        const den = knots[j + 1 + s - r] - knots[j + s - deg];
        const a = den === 0 ? 0 : (t - knots[j + s - deg]) / den;
        d[j] = { x: (1 - a) * d[j - 1].x + a * d[j].x, y: (1 - a) * d[j - 1].y + a * d[j].y };
      }
    }
    out.push({ x: d[deg].x, y: d[deg].y });
  }
  return out;
}

export function importDxf(text: string): ImportResult {
  const warnings: string[] = [];
  let dxf: DxfEntity;
  try {
    dxf = new DxfParser().parseSync(text);
  } catch (e) {
    throw new Error(`Não foi possível ler o DXF: ${(e as Error).message}`);
  }
  if (!dxf?.entities) throw new Error('O DXF não tem entidades de desenho.');
  const units = dxf.header?.$INSUNITS as number | undefined;
  const k = units && INSUNITS_MM[units] ? INSUNITS_MM[units] : 1;
  if (!units || !INSUNITS_MM[units]) warnings.push('O DXF não informa a unidade; considerei milímetros.');

  const contours: Contour[] = [];
  const ignored = new Set<string>();
  let n = 0;

  type Xf = (p: Pt) => Pt;
  const walk = (ents: DxfEntity[], xf: Xf, depth: number) => {
    for (const e of ents) {
      const push = (pts: Pt[], closed: boolean, label: string) => {
        if (pts.length < 2) return;
        n++;
        contours.push({ id: `d${n}`, label: `${label} ${n}${e.layer ? ` (${e.layer})` : ''}`, poly: pts.map(xf), closed: closed && pts.length >= 3 });
      };
      switch (e.type) {
        case 'LINE':
          push(e.vertices.map((v: DxfV) => ({ x: v.x, y: v.y })), false, 'Linha');
          break;
        case 'LWPOLYLINE':
        case 'POLYLINE': {
          const vs: DxfV[] = e.vertices ?? [];
          const pts: Pt[] = [];
          for (let i = 0; i < vs.length; i++) {
            const next = vs[i + 1] ?? (e.shape ? vs[0] : undefined);
            pts.push(...(next ? bulgePoints(vs[i], next) : [{ x: vs[i].x, y: vs[i].y }]));
          }
          push(pts, !!e.shape, 'Polilinha');
          break;
        }
        case 'CIRCLE':
          push(arcPoints(e.center.x, e.center.y, e.radius, 0, Math.PI * 2).slice(0, -1), true, 'Círculo');
          break;
        case 'ARC':
          push(arcPoints(e.center.x, e.center.y, e.radius, e.startAngle, e.endAngle), false, 'Arco');
          break;
        case 'ELLIPSE': {
          const mx = e.majorAxisEndPoint.x, my = e.majorAxisEndPoint.y;
          const a = Math.hypot(mx, my), rot = Math.atan2(my, mx), b = a * e.axisRatio;
          let s0 = e.startAngle ?? 0, s1 = e.endAngle ?? Math.PI * 2;
          if (s1 <= s0) s1 += Math.PI * 2;
          const full = Math.abs(s1 - s0 - Math.PI * 2) < 1e-6;
          const steps = Math.max(24, Math.ceil(((a + b) * (s1 - s0)) / 0.5));
          const pts = Array.from({ length: steps + 1 }, (_, i) => {
            const t = s0 + ((s1 - s0) * i) / steps;
            const x = a * Math.cos(t), y = b * Math.sin(t);
            return { x: e.center.x + x * Math.cos(rot) - y * Math.sin(rot), y: e.center.y + x * Math.sin(rot) + y * Math.cos(rot) };
          });
          push(full ? pts.slice(0, -1) : pts, full, 'Elipse');
          break;
        }
        case 'SPLINE': {
          const pts = splinePoints(e);
          const a = pts[0], b = pts[pts.length - 1];
          const closed = !!e.closed || (a && b && Math.hypot(a.x - b.x, a.y - b.y) < CHAIN_TOL);
          push(closed && pts.length > 3 ? pts.slice(0, -1) : pts, closed, 'Curva');
          break;
        }
        case 'INSERT': {
          const blk = dxf.blocks?.[e.name];
          if (!blk?.entities || depth > 4) break;
          const px = e.position?.x ?? 0, py = e.position?.y ?? 0;
          const sx = e.xScale ?? 1, sy = e.yScale ?? 1;
          const r = ((e.rotation ?? 0) * Math.PI) / 180;
          const bx = blk.position?.x ?? 0, by = blk.position?.y ?? 0;
          walk(blk.entities, (p) => {
            const x = (p.x - bx) * sx, y = (p.y - by) * sy;
            return xf({ x: px + x * Math.cos(r) - y * Math.sin(r), y: py + x * Math.sin(r) + y * Math.cos(r) });
          }, depth + 1);
          break;
        }
        default:
          ignored.add(e.type);
      }
    }
  };
  // DXF tem Y para cima: espelha para a convenção da tela.
  walk(dxf.entities, (p) => ({ x: p.x * k, y: -p.y * k }), 0);
  if (ignored.size) warnings.push(`Ignorado (não é geometria de corte): ${[...ignored].join(', ')}.`);
  return { contours: chainOpen(contours), warnings };
}

export function importDrawing(fileName: string, text: string): ImportResult {
  return /\.dxf$/i.test(fileName) || /^\s*0\s*[\r\n]+\s*SECTION/.test(text) ? importDxf(text) : importSvg(text);
}

// ---------- Utilidades ----------

/** Junta trechos abertos cujas pontas se encontram (linhas e arcos soltos de um DXF, por exemplo). */
export function chainOpen(list: Contour[], tol = CHAIN_TOL): Contour[] {
  const closed = list.filter((c) => c.closed);
  const open = list.filter((c) => !c.closed).map((c) => ({ ...c, poly: [...c.poly] }));
  const near = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y) < tol;
  const out: Contour[] = [];
  while (open.length) {
    const cur = open.shift()!;
    let joined = 1;
    for (let grew = true; grew; ) {
      grew = false;
      if (near(cur.poly[0], cur.poly[cur.poly.length - 1]) && cur.poly.length > 2) break;
      for (let i = 0; i < open.length; i++) {
        const o = open[i].poly;
        const end = cur.poly[cur.poly.length - 1], start = cur.poly[0];
        let add: Pt[] | null = null, front = false;
        if (near(end, o[0])) add = o.slice(1);
        else if (near(end, o[o.length - 1])) add = [...o].reverse().slice(1);
        else if (near(start, o[o.length - 1])) { add = o.slice(0, -1); front = true; }
        else if (near(start, o[0])) { add = [...o].reverse().slice(0, -1); front = true; }
        if (add) {
          cur.poly = front ? [...add, ...cur.poly] : [...cur.poly, ...add];
          open.splice(i, 1);
          joined++;
          grew = true;
          break;
        }
      }
    }
    const isClosed = cur.poly.length > 2 && near(cur.poly[0], cur.poly[cur.poly.length - 1]);
    out.push({ ...cur, poly: isClosed ? cur.poly.slice(0, -1) : cur.poly, closed: isClosed, label: joined > 1 ? `${cur.label} + ${joined - 1} unidas` : cur.label });
  }
  return [...closed, ...out];
}

export function convexHull(points: Pt[]): Poly {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (p.length < 3) return p;
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Pt[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: Pt[] = [];
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Sugere funções: maior linha fechada = contorno; círculo pequeno no topo = furo; o resto dentro = recortes. */
export function autoAssign(contours: Contour[]): Record<string, Role> {
  const out: Record<string, Role> = {};
  const closed = contours.filter((c) => c.closed);
  if (!closed.length) return out;
  const box = (c: Contour) => bounds([c.poly]);
  const outer = closed.reduce((a, c) => (box(c).w * box(c).h > box(a).w * box(a).h ? c : a));
  out[outer.id] = 'contorno';
  const ob = box(outer);
  let furo: Contour | null = null;
  for (const c of closed) {
    if (c === outer) continue;
    const b = box(c);
    const d = (b.w + b.h) / 2;
    const round = Math.abs(b.w - b.h) < 0.1 * d && Math.abs(Math.abs(signedArea(c.poly)) / (Math.PI * (d / 2) ** 2) - 1) < 0.1;
    const top = b.y + b.h / 2 < ob.y + ob.h * 0.3;
    if (round && top && d < ob.w * 0.2 && (!furo || b.y < box(furo).y)) furo = c;
  }
  if (furo) out[furo.id] = 'furo';
  for (const c of closed) if (!out[c.id]) out[c.id] = 'recortes';
  return out;
}

// ---------- Montagem da moldura ----------

export interface BuildResult extends FrameParseResult {
  svg?: string;
  janela?: Poly;
}

export function buildFrameSvg(contours: Contour[], roles: Record<string, Role | undefined>, name: string, id = 'previa'): BuildResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const by = (r: Role) => contours.filter((c) => roles[c.id] === r);
  const closedOf = (r: Role) => by(r).filter((c) => c.closed);

  const openWithRole = contours.filter((c) => !c.closed && roles[c.id] && roles[c.id] !== 'apagar');
  if (openWithRole.length) warnings.push(`${openWithRole.length} linha(s) aberta(s) com função foram ignoradas: só linhas fechadas funcionam.`);

  const cont = closedOf('contorno');
  const jan = closedOf('janela');
  if (!cont.length) errors.push('Marque o contorno (forma externa da peça).');
  if (!jan.length) errors.push('Marque a janela (linha onde o nome entra).');
  if (errors.length) return { errors, warnings };

  const janela = jan.length === 1 ? jan[0].poly : convexHull(jan.flatMap((c) => c.poly));
  const jb = bounds([janela]);
  const bottom = janela.filter((q) => q.y > jb.y + jb.h - Math.max(0.2, jb.h * 0.02));
  const flat = bottom.length ? bounds([bottom]).w / jb.w : 0;
  if (flat < 0.4) warnings.push('A base da janela não é reta: as letras podem não encostar nela.');

  const b: Bounds = bounds(cont.map((c) => c.poly));
  const group = (rid: string, list: Contour[]) =>
    list.length ? `  <g id="${rid}">\n${list.map((c) => `    <path d="${shapeToD([c.poly])}"/>`).join('\n')}\n  </g>\n` : '';
  const esc = (s: string) => s.replace(/[<>&"]/g, (ch) => `&#${ch.charCodeAt(0)};`);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x} ${b.y} ${b.w} ${b.h}" data-nome="${esc(name)}">\n` +
    `  <title>${esc(name)}</title>\n` +
    group('contorno', cont) +
    `  <path id="janela" d="${shapeToD([janela])}"/>\n` +
    group('recortes', closedOf('recortes')) +
    group('gravacao', closedOf('gravacao')) +
    group('furo', closedOf('furo')) +
    `</svg>\n`;

  const r = parseFrameSvg(svg, id, false);
  return { ...r, errors: [...errors, ...r.errors], warnings: [...warnings, ...r.warnings], svg, janela };
}
