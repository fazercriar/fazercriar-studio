import { describe, expect, it } from 'vitest';
import { MODELS, getModel } from '../src/models/registry';
import { defaultParams, runModel } from '../src/core/run';
import { prepareForExport } from '../src/core/export/prepare';
import { buildSvg } from '../src/core/export/svg';
import { bounds } from '../src/core/geometry/clip';
import type { Params } from '../src/core/types';
import { COLORS, MACHINE, MDF3, testContext } from './helpers';

const ctx = testContext();
const run = (id: string, over: Params = {}) => {
  const m = getModel(id)!;
  return runModel(m, { ...defaultParams(m), ...over }, ctx, MDF3, MACHINE);
};
const errors = (o: ReturnType<typeof run>) => o.issues.filter((i) => i.level === 'error').map((i) => i.code);

describe('contrato dos modelos', () => {
  for (const model of MODELS) {
    describe(model.name, () => {
      it('gera sem erros com os valores padrão', () => {
        const o = run(model.id);
        expect(errors(o)).toEqual([]);
        expect(o.result.parts.length).toBeGreaterThan(0);
      });

      it('gera nos limites mínimo e máximo de cada número', () => {
        for (const p of model.params) {
          if (p.type !== 'number') continue;
          for (const v of [p.min, p.max]) {
            const o = run(model.id, { [p.id]: v });
            expect(o.result.parts.length, `${p.id}=${v}`).toBeGreaterThan(0);
            expect(errors(o).filter((c) => c !== 'OUT_OF_SHEET' && c !== 'DISCONNECTED_PART'), `${p.id}=${v}`).toEqual([]);
          }
        }
      });

      it('é determinístico (mesmos parâmetros → mesmo SVG)', () => {
        const svg = () => buildSvg(prepareForExport(run(model.id).result), COLORS);
        expect(svg()).toBe(svg());
      });

      it('declara categoria e parâmetros únicos', () => {
        const ids = model.params.map((p) => p.id);
        expect(new Set(ids).size).toBe(ids.length);
        if (model.batchParam) expect(ids).toContain(model.batchParam);
      });
    });
  }
});

describe('Enfeite de Natal', () => {
  const nomes = ['Ana', 'João', 'Cecília', 'Maria Eduarda', 'Zé', 'Heloísa'];
  const frames = ctx.frames.list().map((f) => f.id);

  it('carrega as 6 molduras originais', () => {
    expect(frames).toEqual(['bola', 'estrela', 'sino', 'arvore', 'floco', 'coracao']);
  });

  for (const moldura of frames) {
    it(`forma peça única na moldura "${moldura}" com nomes acentuados`, () => {
      for (const nome of nomes) {
        const o = run('enfeite-natal', { moldura, nome });
        expect(errors(o), `${moldura} / ${nome}`).toEqual([]);
      }
    });
  }

  it('respeita a largura pedida', () => {
    for (const largura of [50, 90, 200]) {
      expect(run('enfeite-natal', { largura }).bounds.w).toBeCloseTo(largura, 1);
    }
  });

  it('acusa erro para caractere fora da fonte', () => {
    expect(errors(run('enfeite-natal', { nome: 'Ana ☃' }))).toContain('MISSING_GLYPH');
  });

  it('sem pontes, acentos soltos viram erro de peça desconectada', () => {
    expect(errors(run('enfeite-natal', { nome: 'Lúcia', pontes: false, fonte: 'montserrat' }))).toContain('DISCONNECTED_PART');
  });

  it('funciona com todas as fontes', () => {
    for (const f of ctx.fonts.list()) {
      expect(errors(run('enfeite-natal', { fonte: f.id, nome: 'Júlia' })), f.id).toEqual([]);
    }
  });
});

describe('Chaveiro com nome', () => {
  it('altura das letras + bordas define a altura da peça', () => {
    const o = run('chaveiro-nome', { nome: 'HELENA', fonte: 'montserrat', altura: 14, borda: 3, argola: 'esquerda' });
    expect(o.bounds.h).toBeGreaterThanOrEqual(14 + 6 - 0.1);
    expect(o.bounds.h).toBeLessThan(14 + 6 + 2);
  });

  it('todas as posições de argola formam peça única', () => {
    for (const argola of ['esquerda', 'direita', 'topo', 'nenhuma']) {
      const o = run('chaveiro-nome', { argola, nome: 'Cecília' });
      expect(errors(o), argola).toEqual([]);
      expect(o.issues.map((i) => i.code), argola).not.toContain('HOLE_NEAR_EDGE');
    }
  });

  it('duas camadas gera base + letras separadas', () => {
    const o = run('chaveiro-nome', { acabamento: 'duas-camadas' });
    expect(o.result.parts.map((p) => p.id)).toEqual(['base', 'letras']);
    const [base, letras] = o.result.parts;
    expect(bounds(letras.solid).y).toBeGreaterThan(bounds(base.solid).y + bounds(base.solid).h);
  });

  it('modo gravado leva o nome para a camada de gravação', () => {
    const svg = buildSvg(prepareForExport(run('chaveiro-nome').result), COLORS);
    expect(svg).toMatch(/id="gravacao"[\s\S]*<path d="M/);
  });

  it('pede um nome quando vazio', () => {
    expect(errors(run('chaveiro-nome', { nome: '  ' }))).toContain('NO_TEXT');
  });
});
