// Pipeline comum: parâmetros → gerador → validação. Usado pela interface, pelo lote e pelos testes.

import type { Bounds, GenContext, GeometryResult, Issue, ModelDefinition, Params, ParamDef } from './types';
import type { Machine, Material } from './settings';
import { bounds } from './geometry/clip';
import { hasErrors, validateGeometry } from './validate';

export function defaultParams(model: ModelDefinition): Params {
  return Object.fromEntries(model.params.map((p) => [p.id, p.default]));
}

export function selectOptions(def: ParamDef & { type: 'select' }, ctx: GenContext) {
  return def.source ? def.source(ctx) : def.options ?? [];
}

/** Garante tipos e limites. Valores desconhecidos voltam ao padrão. */
export function sanitizeParams(model: ModelDefinition, input: Params, ctx: GenContext): Params {
  const out: Params = {};
  for (const def of model.params) {
    const v = input[def.id];
    switch (def.type) {
      case 'text': {
        const s = typeof v === 'string' ? v : def.default;
        out[def.id] = def.maxLength ? s.slice(0, def.maxLength) : s;
        break;
      }
      case 'number': {
        const n = typeof v === 'number' && Number.isFinite(v) ? v : def.default;
        out[def.id] = Math.min(def.max, Math.max(def.min, n));
        break;
      }
      case 'boolean':
        out[def.id] = typeof v === 'boolean' ? v : def.default;
        break;
      case 'select': {
        const opts = selectOptions(def, ctx);
        out[def.id] = typeof v === 'string' && opts.some((o) => o.value === v) ? v : def.default;
        break;
      }
      case 'font':
        out[def.id] = typeof v === 'string' && ctx.fonts.get(v) ? v : def.default;
        break;
    }
  }
  return out;
}

export function isVisible(model: ModelDefinition, id: string, p: Params): boolean {
  const f = model.visibleWhen?.[id];
  return f ? f(p) : true;
}

export interface RunOutput {
  result: GeometryResult;
  issues: Issue[];
  bounds: Bounds;
  ok: boolean;
}

export function runModel(model: ModelDefinition, params: Params, ctx: GenContext, material: Material, machine: Machine): RunOutput {
  let result: GeometryResult;
  try {
    result = model.generate(sanitizeParams(model, params, ctx), ctx);
  } catch (e) {
    result = { parts: [], issues: [{ level: 'error', code: 'GENERATOR_FAILED', message: `Falha ao gerar o modelo: ${(e as Error).message}` }] };
  }
  const issues = [...result.issues, ...validateGeometry(result, material, machine)];
  return { result, issues, bounds: bounds(...result.parts.map((p) => p.solid)), ok: !hasErrors(issues) };
}
