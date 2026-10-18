import { describe, expect, it } from 'vitest';
import type { GeometryResult } from '../src/core/types';
import { area, difference } from '../src/core/geometry/clip';
import { circle, rect } from '../src/core/geometry/path';
import { buildStl, stlTriangles, type Tri } from '../src/core/export/stl';
import { getModel } from '../src/models/registry';
import { defaultParams, runModel } from '../src/core/run';
import { MACHINE, MDF3, testContext } from './helpers';

const plate: GeometryResult = {
  parts: [{ id: 'p', name: 'Placa', solid: difference([rect(0, 0, 100, 50)], [circle(20, 25, 5)]), engrave: [rect(50, 20, 20, 10)], singlePiece: true }],
  issues: [],
};

/** Malha fechada: toda aresta orientada tem a aresta oposta. */
function isWatertight(tris: Tri[]): boolean {
  const key = (v: number[]) => v.map((n) => n.toFixed(4)).join(',');
  const edges = new Map<string, number>();
  for (const t of tris) {
    for (let i = 0; i < 3; i++) {
      const k = `${key(t[i])}>${key(t[(i + 1) % 3])}`;
      edges.set(k, (edges.get(k) ?? 0) + 1);
    }
  }
  for (const [k, n] of edges) {
    const [a, b] = k.split('>');
    if (edges.get(`${b}>${a}`) !== n) return false;
  }
  return true;
}

/** Volume pelo teorema da divergência: só bate com o esperado se a malha for fechada. */
const volume = (tris: Tri[]) =>
  tris.reduce((acc, [a, b, c]) => acc + (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6, 0);

const zRange = (tris: Tri[]) => {
  const zs = tris.flat().map((v) => v[2]);
  return [Math.min(...zs), Math.max(...zs)];
};

describe('STL', () => {
  it('extruda com a espessura do material e relevo de 0,6 mm', () => {
    const tris = stlTriangles(plate, { thickness: 3 });
    expect(zRange(tris)).toEqual([0, 3.6]);
    const xs = tris.flat().map((v) => v[0]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(100, 3);
  });

  it('sem relevo fica só a peça', () => {
    expect(zRange(stlTriangles(plate, { thickness: 3, relief: 0 }))).toEqual([0, 3]);
  });

  it('gera malhas fechadas (sem buracos)', () => {
    expect(isWatertight(stlTriangles(plate, { thickness: 3 }))).toBe(true);
  });

  it('arquivo binário tem o tamanho correto', () => {
    const n = stlTriangles(plate, { thickness: 3 }).length;
    const buf = buildStl(plate, { thickness: 3 });
    expect(buf.byteLength).toBe(84 + 50 * n);
    expect(new DataView(buf).getUint32(80, true)).toBe(n);
  });

  it('modelos reais: volume da malha = área × espessura (malha fechada e bem orientada)', () => {
    const ctx = testContext();
    for (const [id, over] of [['enfeite-natal', { nome: 'Cecília' }], ['chaveiro-nome', { acabamento: 'duas-camadas' }]] as const) {
      const m = getModel(id)!;
      const out = runModel(m, { ...defaultParams(m), ...over }, ctx, MDF3, MACHINE);
      const tris = stlTriangles(out.result, { thickness: 3, relief: 0 });
      const expected = out.result.parts.reduce((a, p) => a + area(p.solid), 0) * 3;
      expect(volume(tris), id).toBeCloseTo(expected, 0);
      if (id === 'chaveiro-nome') expect(zRange(tris)).toEqual([0, 6]);
    }
  });
});
