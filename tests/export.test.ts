import { describe, expect, it } from 'vitest';
import DxfParser from 'dxf-parser';
import type { GeometryResult } from '../src/core/types';
import { difference } from '../src/core/geometry/clip';
import { circle, rect } from '../src/core/geometry/path';
import { prepareForExport } from '../src/core/export/prepare';
import { buildSvg } from '../src/core/export/svg';
import { buildDxf } from '../src/core/export/dxf';
import { arrangeOnSheets } from '../src/core/export/sheet';
import { estimate } from '../src/core/estimate';
import { COLORS, MACHINE, MDF3, PRICING } from './helpers';

// Placa 100 × 50 mm com furo de 10 mm e uma área gravada de 20 × 10 mm.
const plate: GeometryResult = {
  parts: [
    {
      id: 'p',
      name: 'Placa',
      solid: difference([rect(10, 20, 100, 50)], [circle(20, 45, 5)]),
      engrave: [rect(50, 40, 20, 10)],
      singlePiece: true,
    },
  ],
  issues: [],
};

describe('SVG', () => {
  const file = prepareForExport(plate);
  const svg = buildSvg(file, COLORS, { modelo: 'teste' });

  it('usa milímetros reais e viewBox 1:1', () => {
    expect(svg).toContain('width="100mm"');
    expect(svg).toContain('height="50mm"');
    expect(svg).toContain('viewBox="0 0 100 50"');
  });

  it('separa as operações em camadas e não contém texto', () => {
    expect(svg).toContain('id="corte"');
    expect(svg).toContain('id="gravacao"');
    expect(svg).not.toContain('<text');
    expect(svg).not.toContain('<script');
  });

  it('é um XML válido que reabre com a mesma medida', () => {
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    expect(doc.documentElement.getAttribute('width')).toBe('100mm');
    expect(doc.querySelectorAll('#corte path')).toHaveLength(2); // furo + contorno
  });

  it('corta o furo antes do contorno externo', () => {
    expect(file.cut[0].length).toBeGreaterThan(30); // círculo primeiro
    expect(file.cut[1]).toHaveLength(4);
  });
});

describe('DXF R12', () => {
  const dxf = buildDxf(prepareForExport(plate));
  const parsed = new DxfParser().parseSync(dxf)!;

  it('declara a versão R12', () => {
    expect(dxf).toContain('AC1009');
  });

  it('cria camadas por operação com as cores ACI', () => {
    const layers = parsed.tables.layer.layers as Record<string, { colorIndex: number }>;
    expect(layers.CORTE.colorIndex).toBe(1);
    expect(layers.GRAVACAO.colorIndex).toBe(7);
  });

  it('exporta apenas polilinhas fechadas com a medida correta', () => {
    const ents = parsed.entities as unknown as { type: string; layer: string; shape?: boolean; vertices: { x: number; y: number }[] }[];
    expect(ents.every((e) => e.type === 'POLYLINE' && e.shape)).toBe(true);
    expect(ents.filter((e) => e.layer === 'CORTE')).toHaveLength(2);
    const xs = ents.flatMap((e) => e.vertices.map((v) => v.x));
    const ys = ents.flatMap((e) => e.vertices.map((v) => v.y));
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(100, 2);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(50, 2);
    expect(Math.min(...ys)).toBeCloseTo(0, 3);
  });

  it('inverte o eixo Y (DXF cresce para cima)', () => {
    const ents = parsed.entities as unknown as { layer: string; vertices: { y: number }[] }[];
    const engraveYs = ents.find((e) => e.layer === 'GRAVACAO')!.vertices.map((v) => v.y);
    // gravação estava entre y=20 e y=30 a partir do topo → 20..30 a partir da base
    expect(Math.min(...engraveYs)).toBeCloseTo(20, 3);
    expect(Math.max(...engraveYs)).toBeCloseTo(30, 3);
  });
});

describe('kerf', () => {
  it('contorno cresce kerf/2 e furo encolhe kerf/2', () => {
    const f = prepareForExport(plate, { kerf: 0.2 });
    expect(f.w).toBeCloseTo(100.2, 2);
    expect(f.h).toBeCloseTo(50.2, 2);
    const hole = f.cut[0];
    const hxs = hole.map((q) => q.x);
    expect(Math.max(...hxs) - Math.min(...hxs)).toBeCloseTo(9.8, 1);
  });
});

describe('estimativa', () => {
  it('calcula o tempo de corte a partir do comprimento e das perfurações', () => {
    const e = estimate(plate, MDF3, MACHINE, PRICING);
    const holeLen = 2 * Math.PI * 5;
    expect(e.cutLength).toBeCloseTo(300 + holeLen, 0);
    expect(e.cutCount).toBe(2);
    expect(e.cutS).toBeCloseTo((300 + holeLen) / MDF3.corteVel + 2 * MACHINE.perfuracaoS, 0);
    // gravação: 10 mm / 0,1 = 100 linhas de 20 mm
    expect(e.engraveS).toBeCloseTo(100 * (20 / MDF3.gravVel + MACHINE.aceleracaoLinhaS), 3);
    expect(e.price).toBeGreaterThan(e.cost);
    expect(e.price * 2).toBe(Math.round(e.price * 2)); // múltiplo de R$ 0,50
  });
});

describe('chapa do lote', () => {
  it('organiza em grade e abre nova chapa quando lota', () => {
    // Peça de 100 × 50 com 3 mm de espaço: 5 colunas × 7 linhas = 35 por chapa de 600 × 400.
    const items = Array.from({ length: 40 }, (_, i) => ({ label: `n${i}`, result: plate }));
    const sheets = arrangeOnSheets(items, 600, 400, 3);
    expect(sheets.map((s) => s.labels.length)).toEqual([35, 5]);
  });
});
