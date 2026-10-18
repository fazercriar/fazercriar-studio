// Validações globais, aplicadas a qualquer modelo.

import type { GeometryResult, Issue } from './types';
import type { Machine, Material } from './settings';
import { area, bounds, centroid, difference, islands, offset } from './geometry/clip';

export function validateGeometry(result: GeometryResult, material: Material, machine: Machine): Issue[] {
  const issues: Issue[] = [];
  const all = result.parts.flatMap((p) => p.solid);

  if (all.length === 0) {
    issues.push({ level: 'error', code: 'EMPTY', message: 'O modelo não gerou nenhuma peça.' });
    return issues;
  }

  for (const v of all.flat()) {
    if (!Number.isFinite(v.x) || !Number.isFinite(v.y)) {
      issues.push({ level: 'error', code: 'INVALID_GEOMETRY', message: 'A geometria contém pontos inválidos.' });
      return issues;
    }
  }

  const b = bounds(...result.parts.map((p) => p.solid));
  const fits = (b.w <= machine.areaW && b.h <= machine.areaH) || (b.h <= machine.areaW && b.w <= machine.areaH);
  if (!fits) {
    issues.push({ level: 'error', code: 'OUT_OF_SHEET', message: `O produto (${b.w.toFixed(1)} × ${b.h.toFixed(1)} mm) não cabe na área da máquina (${machine.areaW} × ${machine.areaH} mm).` });
  }

  for (const part of result.parts) {
    const groups = islands(part.solid);

    if (part.singlePiece && groups.length > 1) {
      const sorted = [...groups].sort((a, c) => area(c) - area(a));
      const loose = sorted[1];
      issues.push({
        level: 'error',
        code: 'DISCONNECTED_PART',
        message: `"${part.name}" tem ${groups.length} pedaços soltos. Todas as partes precisam estar ligadas para formar uma peça única.`,
        where: centroid(loose[0]),
      });
    }

    // Ponte fina: uma "abertura" morfológica (encolhe e cresce) separa a peça em mais pedaços.
    const r = material.ponteMin / 2;
    const opened = offset(offset(part.solid, -r), r);
    const openedGroups = islands(opened);
    if (openedGroups.length > groups.length || (groups.length > 0 && openedGroups.length === 0)) {
      const lost = difference(part.solid, opened).sort((a, c) => Math.abs(area([c])) - Math.abs(area([a])));
      issues.push({
        level: 'warning',
        code: 'THIN_BRIDGE',
        message: `"${part.name}" tem ligações mais finas que ${material.ponteMin} mm (ponte mínima de ${material.nome}). Elas podem quebrar.`,
        where: lost[0] ? centroid(lost[0]) : undefined,
      });
    }

    // Detalhes pequenos: furos menores que o mínimo do material.
    for (const g of groups) {
      for (const hole of g.slice(1)) {
        const hb = bounds([hole]);
        if (Math.min(hb.w, hb.h) < material.detalheMin) {
          issues.push({
            level: 'warning',
            code: 'SMALL_DETAIL',
            message: `Recorte de ${Math.min(hb.w, hb.h).toFixed(2)} mm em "${part.name}" é menor que o detalhe mínimo (${material.detalheMin} mm).`,
            where: centroid(hole),
          });
          break;
        }
      }
    }
  }
  return issues;
}

export function hasErrors(issues: Issue[]): boolean {
  return issues.some((i) => i.level === 'error');
}
