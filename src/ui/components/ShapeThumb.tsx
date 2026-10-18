import { useMemo } from 'react';
import type { Shape } from '../../core/types';
import { bounds } from '../../core/geometry/clip';
import { shapeToD } from '../../core/geometry/path';

interface Props {
  shape: Shape;
  engrave?: Shape;
  fill?: string;
  engraveFill?: string;
  size?: number;
  className?: string;
}

/** Miniatura desenhada a partir da geometria real (não é uma imagem pronta). */
export function ShapeThumb({ shape, engrave, fill = 'var(--fc-grafite)', engraveFill = 'rgba(0,0,0,.35)', size, className }: Props) {
  const { vb, d, e } = useMemo(() => {
    const b = bounds(shape);
    const pad = Math.max(b.w, b.h) * 0.06 || 1;
    return {
      vb: `${b.x - pad} ${b.y - pad} ${b.w + 2 * pad} ${b.h + 2 * pad}`,
      d: shapeToD(shape, 2),
      e: engrave?.length ? shapeToD(engrave, 2) : '',
    };
  }, [shape, engrave]);
  return (
    <svg className={className} viewBox={vb} width={size} height={size} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <path d={d} fill={fill} fillRule="evenodd" />
      {e && <path d={e} fill={engraveFill} fillRule="evenodd" />}
    </svg>
  );
}
