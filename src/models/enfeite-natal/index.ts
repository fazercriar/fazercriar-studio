// Modelo 1 — Enfeite de Natal com nome.
// A moldura é um dado (SVG com regiões). O nome fica em pé sobre a base da janela
// e é unido à moldura, formando uma peça única.

import type { GeometryResult, Issue, ModelDefinition, Shape } from '../../core/types';
import { bounds, difference, fillSmallHoles, intersection, offset, scale, translate, union } from '../../core/geometry/clip';
import { connectIslands } from '../../core/geometry/bridges';
import { missingChars, textToShape } from '../../core/geometry/text';
import { framePreview } from '../../core/frames';

/** Quanto as letras entram na base da janela para garantir a ligação (mm). */
const FLOOR_OVERLAP = 1.0;
/** Quanto o texto pode avançar além da janela quando encosta nas laterais (mm). */
const SIDE_OVERLAP = 1.0;
/** No modo "em cima e embaixo", quanto as letras entram na moldura acima e abaixo da faixa (mm). */
const FILL_OVERLAP = 1.0;
const MIN_SCALE_X = 0.65;
/** Abaixo disso o modo "em cima e embaixo" avisa que as letras ficaram estreitas. */
const MIN_SCALE_X_FILL = 0.5;
/** Limite absoluto de estreitamento; além dele o nome passa das laterais e é cortado pela janela. */
const MIN_SCALE_X_FILL_ABS = 0.2;
const MAX_SCALE_X = 1.6;
const MIN_CAP = 4;
/** Recortes internos menores que isso são preenchidos (mm). */
const SMALL_POCKET = 1.5;

export const enfeiteNatal: ModelDefinition = {
  id: 'enfeite-natal',
  version: 1,
  name: 'Enfeite de Natal com nome',
  description: 'Moldura natalina com o nome vazado e unido à peça. Escolha entre as molduras ou cadastre as suas.',
  category: 'decoracao',
  tags: ['Texto', 'Peça única', 'Natal'],
  batchParam: 'nome',
  params: [
    {
      id: 'moldura', type: 'select', label: 'Moldura', group: 'Desenho', default: 'bola', display: 'tiles',
      source: (ctx) => ctx.frames.list().map((f) => ({ value: f.id, label: f.name, preview: framePreview(f) })),
    },
    { id: 'nome', type: 'text', label: 'Nome ou texto', group: 'Texto', default: 'Helena', maxLength: 24, placeholder: 'Digite o nome' },
    { id: 'maiusculas', type: 'boolean', label: 'Tudo em MAIÚSCULAS', group: 'Texto', default: false },
    { id: 'fonte', type: 'font', label: 'Fonte', group: 'Texto', default: 'lilita' },
    {
      id: 'ligacao', type: 'select', label: 'Como o nome se liga à moldura', group: 'Ligação do nome', default: 'base', display: 'buttons',
      help: 'Em cima e embaixo: as letras ocupam toda a altura da faixa (fica melhor em MAIÚSCULAS).',
      options: [
        { value: 'base', label: 'Na base (hastes)' },
        { value: 'cima-baixo', label: 'Em cima e embaixo' },
        { value: 'todos', label: 'Cima, embaixo e laterais' },
      ],
    },
    {
      id: 'ajuste', type: 'select', label: 'Encaixe do nome', group: 'Ligação do nome', default: 'centro', display: 'buttons',
      options: [
        { value: 'centro', label: 'Centralizado' },
        { value: 'laterais', label: 'Encostar nas laterais' },
      ],
    },
    { id: 'alturaTexto', type: 'number', label: 'Altura das letras', group: 'Ligação do nome', default: 80, min: 40, max: 100, step: 1, unit: '% da janela' },
    { id: 'espacamento', type: 'number', label: 'Espaço entre letras', group: 'Texto', default: 0, min: -3, max: 5, step: 0.1, unit: 'mm' },
    { id: 'deslocX', type: 'number', label: 'Mover para os lados', group: 'Posição do nome', default: 0, min: -40, max: 40, step: 0.5, unit: 'mm', pad: 'x', help: 'Positivo vai para a direita.' },
    { id: 'deslocY', type: 'number', label: 'Mover para cima/baixo', group: 'Posição do nome', default: 0, min: -40, max: 40, step: 0.5, unit: 'mm', pad: 'y', help: 'Positivo sobe. Se o nome sair da base, as pontes ligam as letras.' },
    { id: 'largura', type: 'number', label: 'Largura final', group: 'Dimensões', default: 90, min: 50, max: 300, step: 1, unit: 'mm', help: 'A altura acompanha proporcionalmente.' },
    { id: 'furo', type: 'boolean', label: 'Furo para pendurar', group: 'Detalhes', default: true },
    { id: 'pontes', type: 'boolean', label: 'Ligar acentos e pingos automaticamente', group: 'Detalhes', default: true },
    { id: 'larguraPonte', type: 'number', label: 'Largura das pontes', group: 'Detalhes', default: 1.8, min: 1, max: 4, step: 0.1, unit: 'mm' },
  ],
  visibleWhen: {
    larguraPonte: (p) => p.pontes === true,
    ajuste: (p) => p.ligacao === 'base',
    alturaTexto: (p) => p.ligacao === 'base',
  },

  generate(p, ctx): GeometryResult {
    const issues: Issue[] = [];
    const frame = ctx.frames.get(String(p.moldura));
    if (!frame) return { parts: [], issues: [{ level: 'error', code: 'FRAME_NOT_FOUND', message: `Moldura "${p.moldura}" não encontrada.` }] };

    // Escala a moldura para a largura pedida (medida pelo contorno real).
    const cb = bounds(frame.contorno);
    const k = Number(p.largura) / cb.w;
    const fit = (s: Shape) => translate(scale(s, k), -cb.x * k, -cb.y * k);
    const contorno = fit(frame.contorno);
    const janela = fit(frame.janela);
    const recortes = fit(frame.recortes);
    const furo = fit(frame.furo);
    const gravacao = fit(frame.gravacao);
    const jb = bounds(janela);

    const ring = difference(contorno, union(janela, recortes));
    let text: Shape = [];
    const nome = p.maiusculas ? String(p.nome).trim().toLocaleUpperCase('pt-BR') : String(p.nome).trim();
    const font = ctx.fonts.get(String(p.fonte));

    if (!font) {
      issues.push({ level: 'error', code: 'FONT_NOT_FOUND', message: 'Fonte não encontrada.' });
    } else if (!nome) {
      issues.push({ level: 'info', code: 'NO_TEXT', message: 'Sem nome: apenas a moldura será gerada.' });
    } else {
      const missing = missingChars(font, nome);
      if (missing.length) {
        issues.push({ level: 'error', code: 'MISSING_GLYPH', message: `A fonte escolhida não tem: ${missing.join(' ')}` });
      }
      // Ligação: "base" = letras em pé na base da janela; "cima-baixo"/"todos" = letras com a
      // altura da faixa inteira, entrando um pouco na moldura em cima e embaixo.
      const fill = p.ligacao === 'cima-baixo' || p.ligacao === 'todos';
      const capWanted = fill ? jb.h + 2 * FILL_OVERLAP : (jb.h * Number(p.alturaTexto)) / 100;
      let cap = capWanted;
      const spacing = Number(p.espacamento);
      const natural = textToShape({ font, text: nome, capHeight: cap, letterSpacing: spacing }).bounds.w;
      const lateral = p.ligacao === 'todos' || (!fill && p.ajuste === 'laterais');
      const avail = lateral ? jb.w + 2 * SIDE_OVERLAP : jb.w - 4;
      let sx = lateral ? avail / natural : Math.min(1, avail / natural);
      if (fill) {
        // A altura fica presa à faixa (é ela que liga o nome em cima e embaixo):
        // se não couber, as letras ficam mais estreitas, nunca mais baixas.
        if (sx < MIN_SCALE_X_FILL) {
          issues.push({ level: 'warning', code: 'TEXT_TOO_LONG', message: `As letras ficaram estreitas (${Math.round(sx * 100)}% da largura normal) para caber com a altura toda. Para letras mais largas, aumente a largura do enfeite ou use uma fonte estreita (Anton, Bebas Neue).` });
        }
        sx = Math.max(sx, MIN_SCALE_X_FILL_ABS);
      } else if (sx < MIN_SCALE_X) {
        // Nem condensando cabe: reduz a altura.
        cap *= avail / (natural * MIN_SCALE_X);
        sx = MIN_SCALE_X;
      }
      sx = Math.min(sx, MAX_SCALE_X);
      if (cap < MIN_CAP) {
        issues.push({ level: 'warning', code: 'TEXT_TOO_SMALL', message: `O texto ficou com ${cap.toFixed(1)} mm de altura. Use um nome menor ou aumente a largura.` });
      }
      const t = textToShape({ font, text: nome, capHeight: cap, letterSpacing: spacing * (cap / capWanted), scaleX: sx });
      // Deslocamento manual: X positivo para a direita, Y positivo para cima (Y da tela cresce para baixo).
      const x = jb.x + (jb.w - t.bounds.w) / 2 - t.bounds.x + Number(p.deslocX);
      const baseline = jb.y + jb.h + (fill ? FILL_OVERLAP : FLOOR_OVERLAP) - Number(p.deslocY);
      text = intersection(translate(t.shape, x, baseline), offset(janela, SIDE_OVERLAP));
    }

    // Bolsões minúsculos entre as letras e a base viram lascas no corte: são preenchidos.
    let solid = fillSmallHoles(union(ring, text), SMALL_POCKET);
    if (p.pontes) solid = connectIslands(solid, Number(p.larguraPonte)).shape;
    if (p.furo && furo.length) solid = difference(solid, furo);

    return {
      parts: [
        {
          id: 'enfeite',
          name: 'Enfeite',
          solid,
          engrave: intersection(gravacao, offset(solid, -0.3)),
          guides: janela,
          singlePiece: true,
        },
      ],
      issues,
    };
  },
};
