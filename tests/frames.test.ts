import { describe, expect, it } from 'vitest';
import { parseFrameSvg } from '../src/core/frames';
import { area, bounds } from '../src/core/geometry/clip';

describe('leitura de molduras SVG', () => {
  it('lê regiões, viewBox e nome', () => {
    const r = parseFrameSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 10 100 80" data-nome="Teste">
        <rect id="contorno" x="10" y="10" width="100" height="80" rx="5"/>
        <g id="janela" transform="translate(20 30)"><rect width="60" height="20"/></g>
        <circle id="furo" cx="60" cy="18" r="3"/>
      </svg>`,
      'teste',
    );
    expect(r.errors).toEqual([]);
    const f = r.frame!;
    expect(f.name).toBe('Teste');
    expect(bounds(f.contorno)).toMatchObject({ x: 0, y: 0, w: 100, h: 80 });
    // translate(20 30) no sistema do viewBox, que começa em (10, 10)
    expect(bounds(f.janela)).toMatchObject({ x: 10, y: 20, w: 60, h: 20 });
    expect(area(f.furo)).toBeCloseTo(Math.PI * 9, 0);
  });

  it('exige contorno e janela', () => {
    const r = parseFrameSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect id="contorno" width="10" height="10"/></svg>', 'x');
    expect(r.frame).toBeUndefined();
    expect(r.errors.join(' ')).toContain('janela');
  });

  it('recusa arquivos que não são SVG', () => {
    expect(parseFrameSvg('<html><body>oi</body></html>', 'x').errors.length).toBeGreaterThan(0);
  });

  it('ignora scripts e lê apenas geometria', () => {
    const r = parseFrameSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50"><script>alert(1)</script>
        <rect id="contorno" width="50" height="50" onclick="alert(2)"/><rect id="janela" x="10" y="10" width="30" height="10"/></svg>`,
      'x',
    );
    expect(r.errors).toEqual([]);
    expect(r.frame!.contorno).toHaveLength(1);
  });
});
