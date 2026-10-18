// Exportador SVG em escala 1:1 (1 unidade do viewBox = 1 mm).

import type { OpColors } from '../settings';
import type { PreparedFile } from './prepare';
import { shapeToD } from '../geometry/path';

const n = (v: number) => String(Number(v.toFixed(3)));

const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function buildSvg(file: PreparedFile, colors: OpColors, meta: Record<string, unknown> = {}): string {
  const W = n(file.w), H = n(file.h);
  const layer = (id: string, label: string, attrs: string, body: string) =>
    body ? `  <g id="${id}" inkscape:groupmode="layer" inkscape:label="${label}" ${attrs}>\n${body}  </g>\n` : '';

  const engrave = file.engrave.length ? `    <path d="${shapeToD(file.engrave)}"/>\n` : '';
  const score = file.score.map((p) => `    <path d="${shapeToD([p])}"/>\n`).join('');
  const cut = file.cut.map((p) => `    <path d="${shapeToD([p])}"/>\n`).join('');

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">\n` +
    `  <metadata>${escapeXml(JSON.stringify({ gerador: 'FazerCriar Studio', ...meta }))}</metadata>\n` +
    layer('gravacao', 'Gravação', `fill="${colors.gravacao}" fill-rule="evenodd" stroke="none"`, engrave) +
    layer('marcacao', 'Marcação', `fill="none" stroke="${colors.marcacao}" stroke-width="0.1"`, score) +
    layer('corte', 'Corte', `fill="none" stroke="${colors.corte}" stroke-width="0.1"`, cut) +
    `</svg>\n`
  );
}
