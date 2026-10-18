// Pontes automáticas: ligam ilhas soltas (acentos, pingos do i) ao corpo principal.

import type { Shape } from '../types';
import { area, bounds, islands, union, verticalHits } from './clip';
import { rect } from './path';

export interface BridgeResult {
  shape: Shape;
  /** Quantas pontes foram adicionadas. */
  added: number;
}

/**
 * Para cada ilha que não é a maior, desce (ou sobe) uma ponte vertical a partir do
 * centro da ilha até encontrar outra parte da forma. Repete até sobrar uma peça
 * ou não haver mais como ligar.
 */
export function connectIslands(shape: Shape, width: number, maxTries = 30): BridgeResult {
  let current = union(shape);
  let added = 0;
  for (let attempt = 0; attempt < maxTries; attempt++) {
    const groups = islands(current);
    if (groups.length <= 1) break;
    groups.sort((a, b) => area(b) - area(a));
    let progressed = false;
    for (const g of groups.slice(1)) {
      const b = bounds(g);
      const others = groups.filter((o) => o !== g).flat();
      // Tenta alguns pontos ao longo da largura da ilha, começando pelo centro.
      const xs = [0.5, 0.35, 0.65, 0.2, 0.8].map((t) => b.x + b.w * t);
      for (const cx of xs) {
        const own = verticalHits(g, cx);
        if (own.length === 0) continue;
        const ownBottom = own[own.length - 1];
        const ownTop = own[0];
        const hits = verticalHits(others, cx);
        const below = hits.find((y) => y > ownBottom);
        const above = [...hits].reverse().find((y) => y < ownTop);
        let bridge: Shape | null = null;
        if (below !== undefined) bridge = [rect(cx - width / 2, ownBottom - width / 2, width, below - ownBottom + width)];
        else if (above !== undefined) bridge = [rect(cx - width / 2, above - width / 2, width, ownTop - above + width)];
        if (bridge) {
          current = union(current, bridge);
          added++;
          progressed = true;
          break;
        }
      }
      if (progressed) break;
    }
    if (!progressed) break;
  }
  return { shape: current, added };
}
