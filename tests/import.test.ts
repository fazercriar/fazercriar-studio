import { describe, expect, it } from 'vitest';
import { autoAssign, buildFrameSvg, chainOpen, convexHull, importDxf, importSvg, type Role } from '../src/core/import/contours';
import { area, bounds, difference, signedArea } from '../src/core/geometry/clip';
import { circle, rect } from '../src/core/geometry/path';
import { prepareForExport } from '../src/core/export/prepare';
import { buildDxf } from '../src/core/export/dxf';
import { createFrameRegistry } from '../src/core/frames';
import { defaultParams, runModel } from '../src/core/run';
import { enfeiteNatal } from '../src/models/enfeite-natal';
import { MACHINE, MDF3, testContext } from './helpers';

// Enfeite já pronto com um nome recortado na faixa central (mesma estrutura de arquivos de outros geradores).
const READY_ORNAMENT = `<svg xmlns="http://www.w3.org/2000/svg" width="50mm" height="62mm" viewBox="0 0 50 62">
  <g id="CUT" fill="none" stroke="#f00">
    <path id="OUTER" d="M0 37 A25 25 0 1 0 50 37 A25 25 0 1 0 0 37 Z"/>
    <circle id="HOLE" cx="25" cy="6" r="2"/>
    <path d="M25 2 Z"/>
    <rect id="CAP" x="20" y="9" width="10" height="2"/>
    <circle id="DECO_1" cx="15" cy="24" r="2.5"/>
    <circle id="DECO_2" cx="35" cy="24" r="2.5"/>
    <rect id="BAND_L" x="5" y="33" width="5" height="9"/>
    <rect id="LETTER_1" x="12" y="33" width="5" height="9"/>
    <rect id="LETTER_2" x="20" y="33" width="5" height="9"/>
    <rect id="LETTER_3" x="28" y="33" width="5" height="9"/>
    <rect id="BAND_R" x="40" y="33" width="5" height="9"/>
  </g>
</svg>`;

describe('importar SVG', () => {
  const r = importSvg(READY_ORNAMENT);

  it('lê cada linha fechada como item selecionável, em mm', () => {
    const ids = r.contours.map((c) => c.label);
    expect(ids).toContain('OUTER');
    expect(ids).toContain('LETTER_2');
    const outer = r.contours.find((c) => c.label === 'OUTER')!;
    expect(bounds([outer.poly]).w).toBeCloseTo(50, 1);
    expect(outer.closed).toBe(true);
  });

  it('sugere contorno, furo e recortes automaticamente', () => {
    const roles = autoAssign(r.contours);
    const role = (label: string) => roles[r.contours.find((c) => c.label === label)!.id];
    expect(role('OUTER')).toBe('contorno');
    expect(role('HOLE')).toBe('furo');
    expect(role('DECO_1')).toBe('recortes');
  });

  it('monta a moldura: várias linhas como janela viram a envoltória, e o enfeite gera sem erros', () => {
    const roles: Record<string, Role> = autoAssign(r.contours);
    for (const c of r.contours) if (/BAND|LETTER/.test(c.label)) roles[c.id] = 'janela';
    const built = buildFrameSvg(r.contours, roles, 'Bola teste');
    expect(built.errors).toEqual([]);
    expect(bounds([built.janela!])).toMatchObject({ x: 5, y: 33, w: 40, h: 9 });
    expect(built.svg).toContain('id="janela"');

    const ctx = { ...testContext(), frames: createFrameRegistry([built.frame!]) };
    const out = runModel(enfeiteNatal, { ...defaultParams(enfeiteNatal), moldura: 'previa', nome: 'Felipe', largura: 90 }, ctx, MDF3, MACHINE);
    expect(out.issues.filter((i) => i.level === 'error')).toEqual([]);
    expect(out.bounds.w).toBeCloseTo(90, 1);
  });

  it('reabre uma moldura preparada com as funções já marcadas', () => {
    const roles = autoAssign(r.contours);
    for (const c of r.contours) if (/BAND|LETTER/.test(c.label)) roles[c.id] = 'janela';
    const again = importSvg(buildFrameSvg(r.contours, roles, 'x').svg!);
    const count = (role: Role) => again.contours.filter((c) => c.role === role).length;
    expect(count('contorno')).toBe(1);
    expect(count('janela')).toBe(1);
    expect(count('furo')).toBe(1);
    expect(count('recortes')).toBe(3);
  });

  it('exige contorno e janela', () => {
    expect(buildFrameSvg(r.contours, {}, 'x').errors).toHaveLength(2);
  });
});

describe('importar DXF', () => {
  const dxf = [
    '0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', '4', '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES',
    // círculo de diâmetro 10 feito com dois arcos (bulge = 1)
    '0', 'LWPOLYLINE', '8', '0', '90', '2', '70', '1', '10', '0', '20', '0', '42', '1', '10', '10', '20', '0', '42', '1',
    // quadrado feito com 4 linhas soltas
    '0', 'LINE', '8', '0', '10', '20', '20', '0', '30', '0', '11', '30', '21', '0', '31', '0',
    '0', 'LINE', '8', '0', '10', '30', '20', '10', '30', '0', '11', '30', '21', '0', '31', '0',
    '0', 'LINE', '8', '0', '10', '30', '20', '10', '30', '0', '11', '20', '21', '10', '31', '0',
    '0', 'LINE', '8', '0', '10', '20', '20', '0', '30', '0', '11', '20', '21', '10', '31', '0',
    '0', 'CIRCLE', '8', '0', '10', '50', '20', '5', '30', '0', '40', '3',
    '0', 'ENDSEC', '0', 'EOF',
  ].join('\n');
  const r = importDxf(dxf);

  it('converte polilinha com arco (bulge) em círculo', () => {
    const c = r.contours.find((x) => x.label.startsWith('Polilinha'))!;
    expect(c.closed).toBe(true);
    expect(Math.abs(signedArea(c.poly))).toBeCloseTo(Math.PI * 25, 0);
  });

  it('une linhas soltas em um contorno fechado', () => {
    const sq = r.contours.find((x) => x.label.includes('unidas'))!;
    expect(sq.closed).toBe(true);
    expect(Math.abs(signedArea(sq.poly))).toBeCloseTo(100, 3);
  });

  it('lê círculos e espelha o Y', () => {
    const c = r.contours.find((x) => x.label.startsWith('Círculo'))!;
    const b = bounds([c.poly]);
    expect(b.w).toBeCloseTo(6, 2);
    expect(b.y + b.h / 2).toBeCloseTo(-5, 2);
  });

  it('reabre um DXF exportado pelo próprio app', () => {
    const plate = { parts: [{ id: 'p', name: 'p', solid: difference([rect(0, 0, 100, 50)], [circle(20, 25, 5)]), singlePiece: true }], issues: [] };
    const back = importDxf(buildDxf(prepareForExport(plate)));
    expect(back.contours.filter((c) => c.closed)).toHaveLength(2);
    expect(bounds(back.contours.map((c) => c.poly))).toMatchObject({ w: expect.closeTo(100, 2), h: expect.closeTo(50, 2) });
    expect(area(back.contours.map((c) => c.poly))).toBeGreaterThan(0);
  });
});

describe('utilidades', () => {
  it('envoltória convexa', () => {
    const h = convexHull([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 1 }, { x: 4, y: 3 }, { x: 0, y: 3 }]);
    expect(h).toHaveLength(4);
  });

  it('chainOpen mantém trechos que não fecham como abertos', () => {
    const out = chainOpen([{ id: 'a', label: 'a', closed: false, poly: [{ x: 0, y: 0 }, { x: 5, y: 0 }] }]);
    expect(out[0].closed).toBe(false);
  });
});
