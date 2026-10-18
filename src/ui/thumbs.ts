import { useMemo } from 'react';
import type { Shape } from '../core/types';
import { defaultParams, runModel } from '../core/run';
import { union } from '../core/geometry/clip';
import { MODELS } from '../models/registry';
import { useApp } from './AppState';

/** Miniaturas geradas pelo próprio modelo com os valores padrão. */
export function useModelThumbs(): Record<string, { solid: Shape; engrave: Shape }> {
  const { ctx, ready, settings } = useApp();
  return useMemo(() => {
    if (!ready) return {};
    const out: Record<string, { solid: Shape; engrave: Shape }> = {};
    for (const m of MODELS) {
      const r = runModel(m, defaultParams(m), ctx, settings.materials[0], settings.machine).result;
      out[m.id] = { solid: union(...r.parts.map((p) => p.solid)), engrave: union(...r.parts.map((p) => p.engrave ?? [])) };
    }
    return out;
  }, [ctx, ready, settings]);
}
