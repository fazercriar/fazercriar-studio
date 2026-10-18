// Prepara a geometria para qualquer exportador: aplica kerf, ordena e leva à origem (0,0).

import type { GeometryResult, Poly, Shape } from '../types';
import { bounds, islands, offset, translate, union } from '../geometry/clip';

export interface PreparedFile {
  /** Largura e altura totais do arquivo (mm). */
  w: number;
  h: number;
  /** Contornos de corte em ordem de execução: furos internos antes do contorno externo. */
  cut: Poly[];
  engrave: Shape;
  score: Shape;
}

export interface PrepareOptions {
  /** Largura total do corte (mm). O contorno cresce kerf/2 para fora e os furos encolhem kerf/2. */
  kerf?: number;
}

export function prepareForExport(result: GeometryResult, opts: PrepareOptions = {}): PreparedFile {
  const half = (opts.kerf ?? 0) / 2;
  const solids = result.parts.map((p) => (half > 0 ? offset(p.solid, half) : union(p.solid)));
  const engrave = union(...result.parts.map((p) => p.engrave ?? []));
  const score = result.parts.flatMap((p) => p.score ?? []);

  const b = bounds(...solids, engrave, score);
  const dx = -b.x, dy = -b.y;

  const cut: Poly[] = [];
  for (const s of solids) {
    for (const g of islands(translate(s, dx, dy))) {
      cut.push(...g.slice(1)); // furos primeiro
      cut.push(g[0]);
    }
  }
  return { w: b.w, h: b.h, cut, engrave: translate(engrave, dx, dy), score: translate(score, dx, dy) };
}
