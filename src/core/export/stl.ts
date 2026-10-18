// Exportador STL binário: extrusão das peças com a espessura do material
// e gravação em relevo por cima (para impressão 3D).

import earcut from 'earcut';
import type { GeometryResult, Poly, Shape } from '../types';
import { intersection, islands, translate } from '../geometry/clip';

export type V3 = [number, number, number];
export type Tri = [V3, V3, V3];

export interface StlOptions {
  /** Espessura da peça (mm). */
  thickness: number;
  /** Altura do relevo da gravação (mm). 0 = sem relevo. */
  relief?: number;
}

export const DEFAULT_RELIEF = 0.6;

/** Área com sinal na convenção matemática (positiva = anti-horário com Y para cima). */
function area2(p: Poly): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[(i + 1) % p.length];
    a += p[i].x * q.y - q.x * p[i].y;
  }
  return a;
}

/**
 * Remove pontos colineares: o triangulador criaria triângulos degenerados
 * e a malha ficaria com junções em "T" (não fechada).
 */
function removeCollinear(p: Poly): Poly {
  let pts = p;
  for (let changed = true; changed && pts.length > 3; ) {
    changed = false;
    const out: Poly = [];
    for (let i = 0; i < pts.length; i++) {
      const a = out.length ? out[out.length - 1] : pts[(i - 1 + pts.length) % pts.length];
      const b = pts[i], c = pts[(i + 1) % pts.length];
      const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      if (Math.abs(cross) < 1e-7) changed = true;
      else out.push(b);
    }
    pts = out.length >= 3 ? out : pts;
    if (out.length < 3) break;
  }
  return pts;
}

/** Extruda uma ilha (contorno externo + furos) entre zb e zt. */
function extrude(island: Shape, zb: number, zt: number, out: Tri[]) {
  // Espelha Y: no arquivo o Y cresce para baixo, no STL para cima.
  const rings = island.map((p) => removeCollinear(p).map((q) => ({ x: q.x, y: -q.y })));
  rings.forEach((r, i) => {
    const ccw = area2(r) > 0;
    if ((i === 0) !== ccw) r.reverse(); // externo anti-horário, furos horário
  });

  const flat: number[] = [];
  const holes: number[] = [];
  const verts: { x: number; y: number }[] = [];
  rings.forEach((r, i) => {
    if (i > 0) holes.push(verts.length);
    for (const q of r) {
      flat.push(q.x, q.y);
      verts.push(q);
    }
  });
  const idx = earcut(flat, holes, 2);
  for (let i = 0; i < idx.length; i += 3) {
    let a = verts[idx[i]], b = verts[idx[i + 1]], c = verts[idx[i + 2]];
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if (Math.abs(cross) < 1e-9) continue; // triângulo degenerado (pontos alinhados de anéis diferentes)
    if (cross < 0) [b, c] = [c, b];
    out.push([[a.x, a.y, zt], [b.x, b.y, zt], [c.x, c.y, zt]]); // topo (+z)
    out.push([[a.x, a.y, zb], [c.x, c.y, zb], [b.x, b.y, zb]]); // base (-z)
  }

  for (const r of rings) {
    for (let i = 0; i < r.length; i++) {
      const a = r[i], b = r[(i + 1) % r.length];
      out.push([[a.x, a.y, zb], [b.x, b.y, zb], [b.x, b.y, zt]]);
      out.push([[a.x, a.y, zb], [b.x, b.y, zt], [a.x, a.y, zt]]);
    }
  }
}

export function stlTriangles(result: GeometryResult, opts: StlOptions): Tri[] {
  const t = opts.thickness;
  const relief = opts.relief ?? DEFAULT_RELIEF;
  const tris: Tri[] = [];
  for (const part of result.parts) {
    const z0 = part.stack3d ? t : 0;
    const move = (s: Shape) => (part.stack3d ? translate(s, part.stack3d.dx, part.stack3d.dy) : s);
    const solid = move(part.solid);
    for (const isl of islands(solid)) extrude(isl, z0, z0 + t, tris);
    if (relief > 0 && part.engrave?.length) {
      for (const isl of islands(intersection(move(part.engrave), solid))) extrude(isl, z0 + t, z0 + t + relief, tris);
    }
  }
  return tris;
}

export function buildStl(result: GeometryResult, opts: StlOptions, header = 'FazerCriar Studio'): ArrayBuffer {
  const tris = stlTriangles(result, opts);
  const buf = new ArrayBuffer(84 + tris.length * 50);
  const dv = new DataView(buf);
  const head = new TextEncoder().encode(header.slice(0, 80));
  new Uint8Array(buf, 0, head.length).set(head);
  dv.setUint32(80, tris.length, true);
  let o = 84;
  for (const [a, b, c] of tris) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    for (const v of [nx, ny, nz, ...a, ...b, ...c]) {
      dv.setFloat32(o, v, true);
      o += 4;
    }
    dv.setUint16(o, 0, true);
    o += 2;
  }
  return buf;
}
