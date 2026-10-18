// Modelo 2 — Chaveiro com nome.
// A base é derivada do próprio texto (offset), com argola posicionada fora das letras.

import type { GeometryResult, Issue, ModelDefinition, Part, Shape } from '../../core/types';
import { bounds, difference, distanceToEdges, fillHoles, offset, translate, union } from '../../core/geometry/clip';
import { circle, rect } from '../../core/geometry/path';
import { missingChars, textToShape } from '../../core/geometry/text';

/** Folga mínima entre o furo e as letras (mm). */
const HOLE_GAP = 1.5;
/** Parede mínima entre o furo e a borda externa (mm). */
const MIN_EDGE = 1.5;
/** Distância entre a base e as letras soltas no modo duas camadas (mm). */
const PART_GAP = 5;

export const chaveiroNome: ModelDefinition = {
  id: 'chaveiro-nome',
  version: 1,
  name: 'Chaveiro com nome',
  description: 'Nome com borda contornando as letras e argola. Pode ser gravado, em duas camadas ou só a silhueta.',
  category: 'chaveiros',
  tags: ['Texto', 'Peça única', 'Brinde'],
  batchParam: 'nome',
  params: [
    { id: 'nome', type: 'text', label: 'Nome ou texto', group: 'Texto', default: 'Laura', maxLength: 20, placeholder: 'Digite o nome' },
    { id: 'fonte', type: 'font', label: 'Fonte', group: 'Texto', default: 'lobster' },
    { id: 'altura', type: 'number', label: 'Altura das letras', group: 'Texto', default: 14, min: 6, max: 40, step: 0.5, unit: 'mm' },
    { id: 'espacamento', type: 'number', label: 'Espaço entre letras', group: 'Texto', default: 0, min: -3, max: 5, step: 0.1, unit: 'mm' },
    {
      id: 'acabamento', type: 'select', label: 'Acabamento', group: 'Formato', default: 'gravado', display: 'buttons',
      options: [
        { value: 'gravado', label: 'Nome gravado' },
        { value: 'duas-camadas', label: 'Duas camadas' },
        { value: 'silhueta', label: 'Só silhueta' },
      ],
    },
    { id: 'borda', type: 'number', label: 'Borda ao redor', group: 'Formato', default: 3, min: 1.5, max: 8, step: 0.1, unit: 'mm' },
    {
      id: 'argola', type: 'select', label: 'Argola', group: 'Argola', default: 'esquerda', display: 'buttons',
      options: [
        { value: 'esquerda', label: 'Esquerda' },
        { value: 'topo', label: 'Topo' },
        { value: 'direita', label: 'Direita' },
        { value: 'nenhuma', label: 'Sem argola' },
      ],
    },
    { id: 'furo', type: 'number', label: 'Diâmetro do furo', group: 'Argola', default: 4, min: 2, max: 10, step: 0.1, unit: 'mm' },
  ],
  visibleWhen: {
    furo: (p) => p.argola !== 'nenhuma',
  },

  generate(p, ctx): GeometryResult {
    const issues: Issue[] = [];
    const font = ctx.fonts.get(String(p.fonte));
    const nome = String(p.nome).trim();
    if (!font) return { parts: [], issues: [{ level: 'error', code: 'FONT_NOT_FOUND', message: 'Fonte não encontrada.' }] };
    if (!nome) return { parts: [], issues: [{ level: 'error', code: 'NO_TEXT', message: 'Digite um nome para gerar o chaveiro.' }] };

    const missing = missingChars(font, nome);
    if (missing.length) issues.push({ level: 'error', code: 'MISSING_GLYPH', message: `A fonte escolhida não tem: ${missing.join(' ')}` });

    const cap = Number(p.altura);
    const borda = Number(p.borda);
    const text = textToShape({ font, text: nome, capHeight: cap, letterSpacing: Number(p.espacamento) });
    const tb = text.bounds;
    let base: Shape = fillHoles(offset(text.shape, borda));

    let hole: Shape = [];
    let holeCenter: { x: number; y: number } | null = null;
    const r = Number(p.furo) / 2;
    if (p.argola !== 'nenhuma') {
      const tabR = r + Math.max(borda, 2);
      let cx: number, cy: number, neck: Shape;
      if (p.argola === 'topo') {
        cx = tb.x + tb.w / 2;
        cy = tb.y - HOLE_GAP - r;
        neck = [rect(cx - tabR * 0.85, cy, tabR * 1.7, tb.y + borda - cy)];
      } else if (p.argola === 'direita') {
        cx = tb.x + tb.w + HOLE_GAP + r;
        cy = -cap / 2;
        neck = [rect(tb.x + tb.w - borda, cy - tabR * 0.85, cx - (tb.x + tb.w - borda), tabR * 1.7)];
      } else {
        cx = tb.x - HOLE_GAP - r;
        cy = -cap / 2;
        neck = [rect(cx, cy - tabR * 0.85, tb.x + borda - cx, tabR * 1.7)];
      }
      base = union(base, [circle(cx, cy, tabR)], neck);
      hole = [circle(cx, cy, r)];
      holeCenter = { x: cx, y: cy };
      const edge = distanceToEdges(holeCenter, base) - r;
      if (edge < MIN_EDGE) {
        issues.push({ level: 'warning', code: 'HOLE_NEAR_EDGE', message: `O furo está a ${edge.toFixed(1)} mm da borda (mínimo ${MIN_EDGE} mm).`, where: holeCenter });
      }
    }
    const solid = difference(base, hole);

    const parts: Part[] = [];
    if (p.acabamento === 'gravado') {
      parts.push({ id: 'base', name: 'Chaveiro', solid, engrave: text.shape, singlePiece: true });
    } else if (p.acabamento === 'duas-camadas') {
      parts.push({ id: 'base', name: 'Base', solid, score: text.shape, singlePiece: true });
      const bb = bounds(solid);
      const dy = bb.y + bb.h + PART_GAP - tb.y;
      parts.push({ id: 'letras', name: 'Letras', solid: translate(text.shape, 0, dy), singlePiece: false, stack3d: { dx: 0, dy: -dy } });
    } else {
      parts.push({ id: 'base', name: 'Chaveiro', solid, singlePiece: true });
    }
    return { parts, issues };
  },
};
