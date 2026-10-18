// Molduras como dados: um SVG com regiões nomeadas por id.
//   contorno  (obrigatório) forma externa da peça
//   janela    (obrigatório) abertura onde o nome é encaixado — base reta
//   gravacao  (opcional)    desenhos gravados
//   recortes  (opcional)    recortes decorativos vazados
//   furo      (opcional)    furo para pendurar
// O SVG nunca é inserido na página: apenas lemos a geometria.

import type { FrameDef, FrameRegistry, Shape } from './types';
import { area, bounds, difference, intersection, normalize, translate, union, type FillRule } from './geometry/clip';
import { flattenCommands, svgPathToCommands } from './geometry/path';

const REGIONS = ['contorno', 'janela', 'gravacao', 'recortes', 'furo'] as const;
type Region = (typeof REGIONS)[number];
const SHAPE_TAGS = new Set(['path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline']);

const num = (el: Element, a: string, d = 0) => {
  const v = parseFloat(el.getAttribute(a) ?? '');
  return Number.isFinite(v) ? v : d;
};

export function elementToD(el: Element): string | null {
  const tag = el.localName.toLowerCase();
  switch (tag) {
    case 'path':
      return el.getAttribute('d');
    case 'rect': {
      const x = num(el, 'x'), y = num(el, 'y'), w = num(el, 'width'), h = num(el, 'height');
      let rx = num(el, 'rx', NaN), ry = num(el, 'ry', NaN);
      if (Number.isNaN(rx)) rx = Number.isNaN(ry) ? 0 : ry;
      if (Number.isNaN(ry)) ry = rx;
      rx = Math.min(rx, w / 2);
      ry = Math.min(ry, h / 2);
      if (w <= 0 || h <= 0) return null;
      if (!rx || !ry) return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
      return `M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}V${y + h - ry}A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`;
    }
    case 'circle':
    case 'ellipse': {
      const cx = num(el, 'cx'), cy = num(el, 'cy');
      const rx = tag === 'circle' ? num(el, 'r') : num(el, 'rx');
      const ry = tag === 'circle' ? rx : num(el, 'ry');
      if (rx <= 0 || ry <= 0) return null;
      return `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;
    }
    case 'polygon':
    case 'polyline': {
      const pts = (el.getAttribute('points') ?? '').trim().split(/[\s,]+/).map(Number);
      if (pts.length < 6 || pts.some((v) => !Number.isFinite(v))) return null;
      let d = `M${pts[0]} ${pts[1]}`;
      for (let i = 2; i + 1 < pts.length; i += 2) d += `L${pts[i]} ${pts[i + 1]}`;
      return d + 'Z';
    }
  }
  return null;
}

function inherited(el: Element, root: Element, attr: string): string | null {
  for (let e: Element | null = el; e && e !== root; e = e.parentElement) {
    const v = e.getAttribute(attr);
    if (v) return v;
  }
  return null;
}

export function transformChain(el: Element, root: Element): string {
  const parts: string[] = [];
  for (let e: Element | null = el; e && e !== root; e = e.parentElement) {
    const t = e.getAttribute('transform');
    if (t) parts.unshift(t);
  }
  return parts.join(' ');
}

function regionShape(regionEl: Element, root: Element): Shape {
  const els = SHAPE_TAGS.has(regionEl.localName.toLowerCase())
    ? [regionEl]
    : [...regionEl.querySelectorAll('*')].filter((e) => SHAPE_TAGS.has(e.localName.toLowerCase()));
  const shapes: Shape[] = [];
  for (const el of els) {
    const d = elementToD(el);
    if (!d) continue;
    const rule: FillRule = inherited(el, root, 'fill-rule') === 'evenodd' ? 'evenodd' : 'nonzero';
    const tf = transformChain(el, root);
    shapes.push(normalize(flattenCommands(svgPathToCommands(d, tf || undefined)), rule));
  }
  return union(...shapes);
}

export interface FrameParseResult {
  frame?: FrameDef;
  errors: string[];
  warnings: string[];
}

export function parseFrameSvg(svg: string, id: string, builtIn = false): FrameParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  } catch {
    return { errors: ['Não foi possível ler o arquivo SVG.'], warnings };
  }
  const root = doc.documentElement;
  if (!root || root.localName.toLowerCase() !== 'svg' || doc.getElementsByTagName('parsererror').length) {
    return { errors: ['O arquivo não é um SVG válido.'], warnings };
  }

  const vb = (root.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number);
  let [minX, minY, w, h] = vb.length === 4 && vb.every(Number.isFinite) ? vb : [0, 0, num(root, 'width'), num(root, 'height')];
  const titleEl = root.querySelector('title');
  const name = root.getAttribute('data-nome') || titleEl?.textContent?.trim() || id;

  const regions = {} as Record<Region, Shape>;
  for (const r of REGIONS) {
    const el = root.querySelector(`[id="${r}"]`);
    regions[r] = el ? translate(regionShape(el, root), -minX, -minY) : [];
  }

  if (!regions.contorno.length) errors.push('Falta a região "contorno" (forma externa da peça).');
  if (!regions.janela.length) errors.push('Falta a região "janela" (abertura onde o nome entra).');
  if (errors.length) return { errors, warnings };

  const outside = difference(regions.janela, regions.contorno);
  if (area(outside) > 0.01 * area(regions.janela)) warnings.push('Parte da janela está fora do contorno.');
  if (regions.furo.length && area(intersection(regions.furo, regions.janela)) > 0) warnings.push('O furo encosta na janela.');

  if (!(w > 0 && h > 0)) {
    const b = bounds(regions.contorno);
    w = b.x + b.w;
    h = b.y + b.h;
  }

  return { frame: { id, name, w, h, ...regions, builtIn }, errors, warnings };
}

/** Forma de miniatura: moldura vazada, sem texto. */
export function framePreview(f: FrameDef): Shape {
  return difference(f.contorno, union(f.janela, f.recortes, f.furo));
}

export function createFrameRegistry(frames: FrameDef[]): FrameRegistry {
  return { list: () => frames, get: (id) => frames.find((f) => f.id === id) };
}
