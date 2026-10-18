// Estimativa de tempo de máquina, custo e preço sugerido.

import type { Bounds, GeometryResult, Poly, Shape } from './types';
import type { Machine, Material, Pricing } from './settings';
import { bounds, islands, perimeter, union } from './geometry/clip';

export interface Estimate {
  cutLength: number; // mm
  cutCount: number; // contornos
  scoreLength: number; // mm
  engraveArea: { w: number; h: number };
  cutS: number;
  travelS: number;
  engraveS: number;
  scoreS: number;
  totalS: number; // já multiplicado pelo fator de calibração
  materialAreaMm2: number;
  materialCost: number;
  machineCost: number;
  fixedCost: number;
  cost: number;
  price: number;
}

function travelLength(polys: Poly[]): number {
  // Vizinho mais próximo entre os pontos iniciais, a partir da origem.
  const left = polys.map((p) => p[0]);
  let at = { x: 0, y: 0 };
  let total = 0;
  while (left.length) {
    let best = 0, bestD = Infinity;
    for (let i = 0; i < left.length; i++) {
      const d = Math.hypot(left[i].x - at.x, left[i].y - at.y);
      if (d < bestD) { bestD = d; best = i; }
    }
    total += bestD;
    at = left.splice(best, 1)[0];
  }
  return total;
}

/** Agrupa as ilhas de gravação em faixas horizontais que se sobrepõem em Y. */
function engraveBands(engrave: Shape): Bounds[] {
  const boxes = islands(engrave).map((g) => bounds(g)).sort((a, b) => a.y - b.y);
  const bands: Bounds[] = [];
  for (const b of boxes) {
    const last = bands[bands.length - 1];
    if (last && b.y <= last.y + last.h) {
      const x0 = Math.min(last.x, b.x), x1 = Math.max(last.x + last.w, b.x + b.w);
      const y1 = Math.max(last.y + last.h, b.y + b.h);
      Object.assign(last, { x: x0, w: x1 - x0, h: y1 - last.y });
    } else bands.push({ ...b });
  }
  return bands;
}

export function roundPrice(v: number): number {
  return Math.ceil(v * 2 - 1e-9) / 2;
}

export function estimate(
  result: GeometryResult,
  material: Material,
  machine: Machine,
  pricing: Pricing,
  opts: { includeFixed?: boolean } = {},
): Estimate {
  const cutPolys: Poly[] = result.parts.flatMap((p) => islands(p.solid).flat());
  const cutLength = cutPolys.reduce((a, p) => a + perimeter(p), 0);
  const scorePolys = result.parts.flatMap((p) => p.score ?? []);
  const scoreLength = scorePolys.reduce((a, p) => a + perimeter(p), 0);

  const engrave = union(...result.parts.map((p) => p.engrave ?? []));
  const eb = bounds(engrave);

  const cutS = cutLength / material.corteVel + cutPolys.length * machine.perfuracaoS;
  const scoreS = scoreLength / (material.corteVel * 2);
  // Gravação: a cabeça varre faixas horizontais; linhas vazias entre faixas são puladas.
  const engraveS = engraveBands(engrave).reduce(
    (acc, band) => acc + Math.ceil(band.h / material.intervalo) * (band.w / material.gravVel + machine.aceleracaoLinhaS),
    0,
  );
  const travelS = travelLength([...cutPolys, ...scorePolys]) / machine.deslocVel;
  const totalS = (cutS + scoreS + engraveS + travelS) * machine.fatorCalibracao;

  const sb = bounds(...result.parts.map((p) => p.solid));
  const materialAreaMm2 = sb.w * sb.h;
  const materialCost = materialAreaMm2 * (material.chapaPreco / (material.chapaW * material.chapaH)) * (1 + pricing.perda / 100);
  const machineCost = (totalS / 60) * machine.custoMinuto;
  const fixedCost = opts.includeFixed === false ? 0 : pricing.custoFixo;
  const cost = materialCost + machineCost + fixedCost;
  const price = roundPrice(cost * (1 + pricing.margem / 100));

  return {
    cutLength, cutCount: cutPolys.length, scoreLength, engraveArea: { w: eb.w, h: eb.h },
    cutS, travelS, engraveS, scoreS, totalS,
    materialAreaMm2, materialCost, machineCost, fixedCost, cost, price,
  };
}
