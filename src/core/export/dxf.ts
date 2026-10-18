// Exportador DXF AutoCAD R12 (AC1009), o formato mais aceito pelo RDWorks / LaserCAD.
// Somente POLYLINE fechadas, uma camada por operação, cor ACI por camada e por entidade.

import type { Poly } from '../types';
import type { PreparedFile } from './prepare';

export const DXF_LAYERS = {
  corte: { name: 'CORTE', color: 1 }, // vermelho
  gravacao: { name: 'GRAVACAO', color: 7 }, // preto/branco
  marcacao: { name: 'MARCACAO', color: 5 }, // azul
} as const;

const n = (v: number) => String(Number(v.toFixed(4)));

export function buildDxf(file: PreparedFile, comment = 'FazerCriar Studio'): string {
  const out: string[] = [];
  const g = (code: number, value: string | number) => out.push(String(code), String(value));
  const H = file.h;

  g(999, comment.replace(/[\r\n]+/g, ' '));

  g(0, 'SECTION'); g(2, 'HEADER');
  g(9, '$ACADVER'); g(1, 'AC1009');
  g(9, '$EXTMIN'); g(10, 0); g(20, 0);
  g(9, '$EXTMAX'); g(10, n(file.w)); g(20, n(file.h));
  g(0, 'ENDSEC');

  g(0, 'SECTION'); g(2, 'TABLES');
  g(0, 'TABLE'); g(2, 'LTYPE'); g(70, 1);
  g(0, 'LTYPE'); g(2, 'CONTINUOUS'); g(70, 0); g(3, 'Solid line'); g(72, 65); g(73, 0); g(40, 0);
  g(0, 'ENDTAB');
  const layers = Object.values(DXF_LAYERS);
  g(0, 'TABLE'); g(2, 'LAYER'); g(70, layers.length);
  for (const l of layers) {
    g(0, 'LAYER'); g(2, l.name); g(70, 0); g(62, l.color); g(6, 'CONTINUOUS');
  }
  g(0, 'ENDTAB');
  g(0, 'ENDSEC');

  g(0, 'SECTION'); g(2, 'ENTITIES');
  const poly = (p: Poly, layer: { name: string; color: number }) => {
    g(0, 'POLYLINE'); g(8, layer.name); g(62, layer.color); g(66, 1); g(70, 1);
    g(10, 0); g(20, 0); g(30, 0);
    for (const q of p) {
      g(0, 'VERTEX'); g(8, layer.name); g(10, n(q.x)); g(20, n(H - q.y)); g(30, 0);
    }
    g(0, 'SEQEND'); g(8, layer.name);
  };
  // Ordem sugerida de execução: gravação → marcação → corte (furos antes do contorno).
  for (const p of file.engrave) poly(p, DXF_LAYERS.gravacao);
  for (const p of file.score) poly(p, DXF_LAYERS.marcacao);
  for (const p of file.cut) poly(p, DXF_LAYERS.corte);
  g(0, 'ENDSEC');
  g(0, 'EOF');
  return out.join('\r\n') + '\r\n';
}
