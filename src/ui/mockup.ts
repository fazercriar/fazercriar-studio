// Mockup PNG 1080 × 1080 para aprovação do cliente (WhatsApp), com a identidade FazerCriar.

import type { GeometryResult, Shape } from '../core/types';
import type { Material } from '../core/settings';
import { bounds } from '../core/geometry/clip';
import { shapeToD } from '../core/geometry/path';
import { BRAND, SYMBOL_BASE_1, SYMBOL_BASE_2, SYMBOL_BASE_WIDTH, SYMBOL_BULB, SYMBOL_C, SYMBOL_C_WIDTH } from './brand';

const SIZE = 1080;
const FOOTER = 190;

export interface MockupInfo {
  title: string;
  dims: string;
  material: Material;
  watermark: boolean;
}

function drawSymbol(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.save();
  g.translate(x, y);
  g.scale(s / 100, s / 100);
  g.lineWidth = SYMBOL_C_WIDTH;
  g.strokeStyle = BRAND.branco;
  g.stroke(new Path2D(SYMBOL_C));
  const grad = g.createLinearGradient(40, 20, 80, 65);
  grad.addColorStop(0, BRAND.laranjaClaro);
  grad.addColorStop(1, BRAND.laranjaEscuro);
  g.fillStyle = grad;
  g.fill(new Path2D(SYMBOL_BULB));
  g.lineWidth = SYMBOL_BASE_WIDTH;
  g.lineCap = 'round';
  g.stroke(new Path2D(`${SYMBOL_BASE_1} ${SYMBOL_BASE_2}`));
  g.restore();
}

export async function renderMockup(result: GeometryResult, info: MockupInfo): Promise<Blob> {
  await Promise.all([document.fonts.load('800 60px Montserrat'), document.fonts.load('600 30px Montserrat')]).catch(() => undefined);
  const c = document.createElement('canvas');
  c.width = SIZE;
  c.height = SIZE;
  const g = c.getContext('2d')!;

  // Fundo grafite com faixas diagonais laranja (como na identidade).
  const bg = g.createLinearGradient(0, 0, SIZE, SIZE);
  bg.addColorStop(0, '#2A2A2A');
  bg.addColorStop(1, BRAND.grafite);
  g.fillStyle = bg;
  g.fillRect(0, 0, SIZE, SIZE);
  g.save();
  g.globalAlpha = 0.85;
  g.strokeStyle = BRAND.laranja;
  for (const [w, off] of [[6, 0], [2.5, 26], [1.5, 46]] as const) {
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(-20 + off, 150 + off);
    g.lineTo(150 + off, -20 + off);
    g.stroke();
    g.beginPath();
    g.moveTo(SIZE - 150 - off, SIZE - FOOTER + 20 - off);
    g.lineTo(SIZE + 20 - off, SIZE - FOOTER - 150 - off);
    g.stroke();
  }
  g.restore();

  // Produto centralizado.
  const solids: Shape[] = result.parts.map((p) => p.solid);
  const b = bounds(...solids);
  const areaW = SIZE - 200, areaH = SIZE - FOOTER - 160;
  const k = Math.min(areaW / b.w, areaH / b.h);
  g.save();
  g.translate(SIZE / 2 - (b.x + b.w / 2) * k, 80 + areaH / 2 + 40 - (b.y + b.h / 2) * k);
  g.scale(k, k);
  for (const p of result.parts) {
    const solid = new Path2D(shapeToD(p.solid));
    g.save();
    g.shadowColor = 'rgba(0,0,0,.55)';
    g.shadowBlur = 40;
    g.shadowOffsetY = 18;
    g.fillStyle = info.material.cor;
    g.fill(solid, 'evenodd');
    g.restore();
    if (p.engrave?.length) {
      g.fillStyle = info.material.corGravacao;
      g.fill(new Path2D(shapeToD(p.engrave)), 'evenodd');
    }
    if (p.score?.length) {
      g.strokeStyle = info.material.corGravacao;
      g.lineWidth = 1.5 / k;
      g.setLineDash([6 / k, 4 / k]);
      g.stroke(new Path2D(shapeToD(p.score)));
      g.setLineDash([]);
    }
  }
  g.restore();

  if (info.watermark) {
    g.save();
    g.translate(SIZE / 2, (SIZE - FOOTER) / 2 + 40);
    g.rotate(-Math.PI / 7);
    g.font = '800 150px Montserrat, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(255,255,255,.07)';
    g.fillText('PRÉVIA', 0, 0);
    g.restore();
  }

  // Rodapé com a marca.
  g.fillStyle = 'rgba(0,0,0,.35)';
  g.fillRect(0, SIZE - FOOTER, SIZE, FOOTER);
  g.fillStyle = BRAND.laranja;
  g.fillRect(0, SIZE - FOOTER, SIZE, 5);

  const baseY = SIZE - FOOTER / 2 + 4;
  g.textBaseline = 'alphabetic';
  g.font = '800 58px Montserrat, sans-serif';
  const fazerW = g.measureText('Fazer').width;
  const tg = g.createLinearGradient(60, 0, 60 + fazerW, 0);
  tg.addColorStop(0, BRAND.laranjaClaro);
  tg.addColorStop(1, BRAND.laranjaEscuro);
  g.fillStyle = tg;
  g.fillText('Fazer', 60, baseY + 4);
  drawSymbol(g, 60 + fazerW, baseY - 52, 68);
  g.fillStyle = BRAND.branco;
  g.fillText('riar', 60 + fazerW + 60, baseY + 4);
  g.font = '600 17px Montserrat, sans-serif';
  g.fillStyle = 'rgba(255,255,255,.75)';
  g.fillText('I D E I A S   G A N H A M   F O R M A .', 62, baseY + 44);

  g.textAlign = 'right';
  g.font = '800 34px Montserrat, sans-serif';
  g.fillStyle = BRAND.branco;
  g.fillText(info.title, SIZE - 60, baseY - 6);
  g.font = '600 24px Montserrat, sans-serif';
  g.fillStyle = 'rgba(255,255,255,.75)';
  g.fillText(`${info.dims} · ${info.material.nome}`, SIZE - 60, baseY + 32);

  return new Promise((resolve, reject) => c.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar a imagem'))), 'image/png'));
}
