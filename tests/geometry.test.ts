import { describe, expect, it } from 'vitest';
import { area, bounds, difference, fillHoles, islands, offset, union } from '../src/core/geometry/clip';
import { circle, flattenCommands, rect, svgPathToCommands } from '../src/core/geometry/path';
import { connectIslands } from '../src/core/geometry/bridges';
import { missingChars, textToShape } from '../src/core/geometry/text';
import { testContext } from './helpers';

const sq = (x: number, y: number, s: number) => [rect(x, y, s, s)];

describe('operações booleanas', () => {
  it('une quadrados sobrepostos em uma ilha', () => {
    const u = union(sq(0, 0, 10), sq(5, 0, 10));
    expect(islands(u)).toHaveLength(1);
    expect(area(u)).toBeCloseTo(150, 3);
  });

  it('mantém quadrados separados como ilhas distintas', () => {
    expect(islands(union(sq(0, 0, 10), sq(20, 0, 10)))).toHaveLength(2);
  });

  it('diferença cria furo e fillHoles remove', () => {
    const d = difference(sq(0, 0, 20), sq(5, 5, 10));
    expect(area(d)).toBeCloseTo(300, 3);
    expect(islands(d)[0]).toHaveLength(2);
    expect(area(fillHoles(d))).toBeCloseTo(400, 3);
  });

  it('offset em esquadria cresce exatamente o valor pedido', () => {
    const b = bounds(offset(sq(0, 0, 10), 1, 'miter'));
    expect(b.w).toBeCloseTo(12, 3);
    expect(b.h).toBeCloseTo(12, 3);
  });

  it('círculo tem área próxima de πr²', () => {
    expect(area([circle(0, 0, 10)])).toBeCloseTo(Math.PI * 100, 0);
  });
});

describe('caminhos SVG', () => {
  it('converte arco e transformação', () => {
    const s = flattenCommands(svgPathToCommands('M0 0 H10 V10 H0 Z', 'translate(5 5) scale(2)'));
    const b = bounds(s);
    expect(b).toMatchObject({ x: 5, y: 5, w: 20, h: 20 });
  });
});

describe('pontes automáticas', () => {
  it('liga uma ilha acima ao corpo principal', () => {
    const shape = union(sq(0, 10, 20), sq(8, 0, 4)); // "pingo" 6 mm acima
    expect(islands(shape)).toHaveLength(2);
    const r = connectIslands(shape, 1.5);
    expect(r.added).toBe(1);
    expect(islands(r.shape)).toHaveLength(1);
  });
});

describe('texto em curvas', () => {
  const ctx = testContext();
  const font = ctx.fonts.get('montserrat')!;

  it('aceita acentos do português', () => {
    expect(missingChars(font, 'Ação Cecília João Ângela Lúcia ü')).toEqual([]);
  });

  it('acusa caracteres ausentes', () => {
    expect(missingChars(font, 'Ana 漢')).toEqual(['漢']);
  });

  it('gera maiúsculas com a altura pedida', () => {
    const t = textToShape({ font, text: 'HELENA', capHeight: 20 });
    expect(t.bounds.h).toBeCloseTo(20, 1);
    expect(t.bounds.y).toBeCloseTo(-20, 1);
  });

  it('condensa horizontalmente', () => {
    const a = textToShape({ font, text: 'Helena', capHeight: 10 });
    const b = textToShape({ font, text: 'Helena', capHeight: 10, scaleX: 0.5 });
    expect(b.bounds.w).toBeCloseTo(a.bounds.w * 0.5, 1);
  });
});
