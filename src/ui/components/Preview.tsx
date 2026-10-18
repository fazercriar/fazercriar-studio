// Prévia 2D em milímetros, desenhada a partir do mesmo GeometryResult usado na exportação.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize, Minus, Plus } from 'lucide-react';
import type { Bounds, GeometryResult, Issue, Pt } from '../../core/types';
import type { Material, OpColors } from '../../core/settings';
import { shapeToD } from '../../core/geometry/path';
import { fmtMm } from '../format';

export type PreviewMode = 'produto' | 'operacoes';

interface Props {
  result: GeometryResult;
  bounds: Bounds;
  issues: Issue[];
  material: Material;
  colors: OpColors;
  mode: PreviewMode;
  focus: Pt | null;
  /** Muda quando o usuário troca de modelo: força reenquadrar. */
  fitKey: string;
}

interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

function fitView(b: Bounds, aspect: number): View {
  const pad = Math.max(b.w, b.h) * 0.18 + 6;
  let w = b.w + pad * 2, h = b.h + pad * 2;
  if (w / h > aspect) h = w / aspect;
  else w = h * aspect;
  return { x: b.x + b.w / 2 - w / 2, y: b.y + b.h / 2 - h / 2, w, h };
}

export function Preview({ result, bounds: b, issues, material, colors, mode, focus, fitKey }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [aspect, setAspect] = useState(1.4);
  const [auto, setAuto] = useState(true);
  const [view, setView] = useState<View>(() => fitView(b, aspect));
  const drag = useRef<{ x: number; y: number; v: View } | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAspect(Math.max(0.3, el.clientWidth / Math.max(1, el.clientHeight))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => setAuto(true), [fitKey]);
  useEffect(() => {
    if (auto && b.w > 0) setView(fitView(b, aspect));
  }, [auto, b.x, b.y, b.w, b.h, aspect]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!focus) return;
    setAuto(false);
    setView((v) => ({ ...v, x: focus.x - v.w / 2, y: focus.y - v.h / 2 }));
  }, [focus]);

  const toSvg = (cx: number, cy: number): Pt => {
    const r = svg.current!.getBoundingClientRect();
    return { x: view.x + ((cx - r.left) / r.width) * view.w, y: view.y + ((cy - r.top) / r.height) * view.h };
  };

  const zoom = (factor: number, at?: Pt) => {
    setAuto(false);
    setView((v) => {
      const c = at ?? { x: v.x + v.w / 2, y: v.y + v.h / 2 };
      const w = Math.min(5000, Math.max(5, v.w * factor));
      const h = (w / v.w) * v.h;
      return { x: c.x - ((c.x - v.x) / v.w) * w, y: c.y - ((c.y - v.y) / v.h) * h, w, h };
    });
  };

  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoom(e.deltaY > 0 ? 1.12 : 1 / 1.12, toSvg(e.clientX, e.clientY));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  const paths = useMemo(
    () =>
      result.parts.map((p) => ({
        id: p.id,
        solid: shapeToD(p.solid),
        engrave: p.engrave?.length ? shapeToD(p.engrave) : '',
        score: p.score?.length ? shapeToD(p.score) : '',
        guides: p.guides?.length ? shapeToD(p.guides) : '',
      })),
    [result],
  );

  const u = view.w / 100; // unidade relativa para textos e marcadores
  const grid = view.w > 400 ? 50 : 10;
  const produto = mode === 'produto';

  return (
    <div className="preview" ref={wrap}>
      <svg
        ref={svg}
        className="preview-svg"
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, v: view };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || !svg.current) return;
          const r = svg.current.getBoundingClientRect();
          const k = Math.max(d.v.w / r.width, d.v.h / r.height);
          if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 2) setAuto(false);
          setView({ ...d.v, x: d.v.x - (e.clientX - d.x) * k, y: d.v.y - (e.clientY - d.y) * k });
        }}
        onPointerUp={() => (drag.current = null)}
        role="img"
        aria-label={`Prévia do produto, ${fmtMm(b.w)} por ${fmtMm(b.h)}`}
      >
        <defs>
          <pattern id="grid" x="0" y="0" width={grid} height={grid} patternUnits="userSpaceOnUse">
            <path d={`M ${grid} 0 L 0 0 0 ${grid}`} fill="none" stroke="var(--grid)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          </pattern>
          <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy={u * 0.6} stdDeviation={u * 0.8} floodColor="#000" floodOpacity="0.22" />
          </filter>
        </defs>
        <rect x={view.x} y={view.y} width={view.w} height={view.h} fill="url(#grid)" />

        {paths.map((p) => (
          <g key={p.id}>
            <path
              d={p.solid}
              fillRule="evenodd"
              fill={produto ? material.cor : 'var(--op-solid)'}
              stroke={produto ? 'rgba(0,0,0,.35)' : colors.corte}
              strokeWidth={produto ? 0.8 : 1.4}
              vectorEffect="non-scaling-stroke"
              filter={produto ? 'url(#shadow)' : undefined}
            />
            {p.engrave && <path d={p.engrave} fillRule="evenodd" fill={produto ? material.corGravacao : colors.gravacao} opacity={produto ? 0.9 : 1} />}
            {p.score && <path d={p.score} fill="none" stroke={produto ? material.corGravacao : colors.marcacao} strokeWidth="1.2" strokeDasharray={produto ? '4 3' : undefined} vectorEffect="non-scaling-stroke" />}
            {!produto && p.guides && <path d={p.guides} fill="none" stroke="#00A3C4" strokeWidth="1" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />}
          </g>
        ))}

        {b.w > 0 && (
          <g className="dims" fontSize={u * 2.6}>
            <line x1={b.x} y1={b.y + b.h + u * 4} x2={b.x + b.w} y2={b.y + b.h + u * 4} vectorEffect="non-scaling-stroke" />
            <line x1={b.x} y1={b.y + b.h + u * 2.5} x2={b.x} y2={b.y + b.h + u * 5.5} vectorEffect="non-scaling-stroke" />
            <line x1={b.x + b.w} y1={b.y + b.h + u * 2.5} x2={b.x + b.w} y2={b.y + b.h + u * 5.5} vectorEffect="non-scaling-stroke" />
            <text x={b.x + b.w / 2} y={b.y + b.h + u * 8} textAnchor="middle">{fmtMm(b.w)}</text>
            <line x1={b.x + b.w + u * 4} y1={b.y} x2={b.x + b.w + u * 4} y2={b.y + b.h} vectorEffect="non-scaling-stroke" />
            <line x1={b.x + b.w + u * 2.5} y1={b.y} x2={b.x + b.w + u * 5.5} y2={b.y} vectorEffect="non-scaling-stroke" />
            <line x1={b.x + b.w + u * 2.5} y1={b.y + b.h} x2={b.x + b.w + u * 5.5} y2={b.y + b.h} vectorEffect="non-scaling-stroke" />
            <text x={b.x + b.w + u * 6.5} y={b.y + b.h / 2} dominantBaseline="middle">{fmtMm(b.h)}</text>
          </g>
        )}

        {issues.filter((i) => i.where).map((i, k) => (
          <circle key={k} cx={i.where!.x} cy={i.where!.y} r={u * 2.2} className={`marker marker-${i.level}`} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>

      <div className="preview-tools">
        <button className="icon-btn" onClick={() => zoom(1 / 1.25)} title="Aproximar" aria-label="Aproximar"><Plus size={16} /></button>
        <button className="icon-btn" onClick={() => zoom(1.25)} title="Afastar" aria-label="Afastar"><Minus size={16} /></button>
        <button className="icon-btn" onClick={() => setAuto(true)} title="Ajustar à tela" aria-label="Ajustar à tela"><Maximize size={16} /></button>
      </div>
      <div className="preview-hint">Arraste para mover · role para aproximar · grade de {grid} mm</div>
    </div>
  );
}
