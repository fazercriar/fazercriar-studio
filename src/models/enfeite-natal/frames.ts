// Molduras incluídas no app. Qualquer arquivo .svg colocado em ./molduras é carregado automaticamente.

import type { FrameDef } from '../../core/types';
import { parseFrameSvg } from '../../core/frames';

const files = import.meta.glob('./molduras/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** Ordem de exibição das molduras originais; as demais entram em ordem alfabética. */
const ORDER = ['bola', 'estrela', 'sino', 'arvore', 'floco', 'coracao'];

export function loadBuiltInFrames(): { frames: FrameDef[]; errors: string[] } {
  const frames: FrameDef[] = [];
  const errors: string[] = [];
  const entries = Object.entries(files)
    .map(([path, svg]) => ({ id: path.split('/').pop()!.replace(/\.svg$/i, ''), svg }))
    .sort((a, b) => {
      const ia = ORDER.indexOf(a.id), ib = ORDER.indexOf(b.id);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.id.localeCompare(b.id);
    });
  for (const { id, svg } of entries) {
    const r = parseFrameSvg(svg, id, true);
    if (r.frame) frames.push(r.frame);
    else errors.push(`${id}.svg: ${r.errors.join(' ')}`);
  }
  return { frames, errors };
}
