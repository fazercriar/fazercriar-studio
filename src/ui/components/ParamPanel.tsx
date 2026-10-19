// Painel de propriedades gerado automaticamente a partir dos parâmetros do modelo.

import { useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronDown, Crosshair, RotateCcw } from 'lucide-react';
import type { GenContext, ModelDefinition, ParamDef, ParamValue, Params } from '../../core/types';
import { isVisible, selectOptions } from '../../core/run';
import { ShapeThumb } from './ShapeThumb';

interface Props {
  model: ModelDefinition;
  params: Params;
  ctx: GenContext;
  onChange: (id: string, value: ParamValue) => void;
  onReset: () => void;
}

export function ParamPanel({ model, params, ctx, onChange, onReset }: Props) {
  const groups: { name: string; defs: ParamDef[] }[] = [];
  for (const def of model.params) {
    if (!isVisible(model, def.id, params)) continue;
    const name = def.group ?? 'Geral';
    let g = groups.find((x) => x.name === name);
    if (!g) groups.push((g = { name, defs: [] }));
    g.defs.push(def);
  }
  const sample = String(params[model.batchParam ?? ''] ?? '') || 'Abc';

  return (
    <div className="params">
      {groups.map((g) => (
        <Group key={g.name} title={g.name}>
          <NudgePad defs={g.defs} params={params} onChange={onChange} />
          {g.defs.map((def) => (
            <Field key={def.id} def={def} value={params[def.id]} ctx={ctx} sample={sample} onChange={(v) => onChange(def.id, v)} />
          ))}
        </Group>
      ))}
      <button className="btn btn-ghost btn-sm params-reset" onClick={onReset}>
        <RotateCcw size={14} /> Restaurar padrão
      </button>
    </div>
  );
}

type NumberDef = ParamDef & { type: 'number' };

/** Setas para deslocar (1 mm por clique, 5 mm com Shift) e botão para centralizar. */
function NudgePad({ defs, params, onChange }: { defs: ParamDef[]; params: Params; onChange: (id: string, v: ParamValue) => void }) {
  const xd = defs.find((d): d is NumberDef => d.type === 'number' && d.pad === 'x');
  const yd = defs.find((d): d is NumberDef => d.type === 'number' && d.pad === 'y');
  // Guarda o valor mais recente para cliques rápidos seguidos não se perderem.
  const latest = useRef<Record<string, number>>({});
  if (!xd || !yd) return null;
  const x = Number(params[xd.id]), y = Number(params[yd.id]);
  latest.current = { [xd.id]: x, [yd.id]: y };
  const move = (def: NumberDef, _cur: number, dir: number) => (e: React.MouseEvent) => {
    const cur = latest.current[def.id] ?? 0;
    const v = Math.min(def.max, Math.max(def.min, Math.round((cur + dir * (e.shiftKey ? 5 : 1)) * 100) / 100));
    latest.current[def.id] = v;
    onChange(def.id, v);
  };
  const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (
    <div className="nudge">
      <div className="nudge-pad" role="group" aria-label="Mover o nome">
        <span />
        <button onClick={move(yd, y, 1)} aria-label="Mover para cima" title="Para cima (Shift: 5 mm)"><ArrowUp size={16} /></button>
        <span />
        <button onClick={move(xd, x, -1)} aria-label="Mover para a esquerda" title="Para a esquerda (Shift: 5 mm)"><ArrowLeft size={16} /></button>
        <button onClick={() => { onChange(xd.id, 0); onChange(yd.id, 0); }} aria-label="Centralizar" title="Voltar ao centro"><Crosshair size={16} /></button>
        <button onClick={move(xd, x, 1)} aria-label="Mover para a direita" title="Para a direita (Shift: 5 mm)"><ArrowRight size={16} /></button>
        <span />
        <button onClick={move(yd, y, -1)} aria-label="Mover para baixo" title="Para baixo (Shift: 5 mm)"><ArrowDown size={16} /></button>
        <span />
      </div>
      <div className="nudge-info">
        <span>Lados: <strong>{fmt(x)} mm</strong></span>
        <span>Altura: <strong>{fmt(y)} mm</strong></span>
        <span className="help">1 mm por clique · Shift + clique: 5 mm</span>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className={`pgroup ${open ? 'open' : ''}`}>
      <button className="pgroup-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>{title}</span>
        <ChevronDown size={16} />
      </button>
      {open && <div className="pgroup-body">{children}</div>}
    </section>
  );
}

function Field({ def, value, ctx, sample, onChange }: { def: ParamDef; value: ParamValue; ctx: GenContext; sample: string; onChange: (v: ParamValue) => void }) {
  const id = `p-${def.id}`;
  switch (def.type) {
    case 'text':
      return (
        <div className="field">
          <label htmlFor={id}>
            {def.label}
            {def.maxLength && <span className="field-hint">{String(value).length}/{def.maxLength}</span>}
          </label>
          <input id={id} className="input input-lg" value={String(value)} maxLength={def.maxLength} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value)} />
        </div>
      );
    case 'number':
      return (
        <div className="field">
          <label htmlFor={id}>{def.label}</label>
          <div className="num-row">
            <input type="range" min={def.min} max={def.max} step={def.step ?? 1} value={Number(value)} onChange={(e) => onChange(Number(e.target.value))} aria-label={def.label} />
            <span className="num-box">
              <input
                id={id}
                type="number"
                className="input"
                min={def.min}
                max={def.max}
                step={def.step ?? 1}
                value={Number(value)}
                onChange={(e) => e.target.value !== '' && onChange(Number(e.target.value))}
              />
              {def.unit && <span className="unit">{def.unit}</span>}
            </span>
          </div>
          {def.help && <p className="help">{def.help}</p>}
        </div>
      );
    case 'boolean':
      return (
        <label className="switch">
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
          <span className="switch-track" />
          <span>{def.label}</span>
        </label>
      );
    case 'select': {
      const opts = selectOptions(def, ctx);
      if (def.display === 'tiles') {
        return (
          <div className="field">
            <label>{def.label}</label>
            <div className="tiles" role="radiogroup" aria-label={def.label}>
              {opts.map((o) => (
                <button key={o.value} role="radio" aria-checked={value === o.value} className={`tile ${value === o.value ? 'active' : ''}`} onClick={() => onChange(o.value)} title={o.label}>
                  {o.preview && <ShapeThumb shape={o.preview} className="tile-img" />}
                  <span>{o.label}</span>
                </button>
              ))}
            </div>
          </div>
        );
      }
      if (def.display === 'buttons') {
        return (
          <div className="field">
            <label>{def.label}</label>
            <div className="seg" role="radiogroup" aria-label={def.label}>
              {opts.map((o) => (
                <button key={o.value} role="radio" aria-checked={value === o.value} className={value === o.value ? 'active' : ''} onClick={() => onChange(o.value)}>
                  {o.label}
                </button>
              ))}
            </div>
            {def.help && <p className="help">{def.help}</p>}
          </div>
        );
      }
      return (
        <div className="field">
          <label htmlFor={id}>{def.label}</label>
          <select id={id} className="input" value={String(value)} onChange={(e) => onChange(e.target.value)}>
            {opts.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      );
    }
    case 'font':
      return (
        <div className="field">
          <label>{def.label}</label>
          <div className="fonts" role="radiogroup" aria-label={def.label}>
            {ctx.fonts.list().map((f) => (
              <button key={f.id} role="radio" aria-checked={value === f.id} className={`font-opt ${value === f.id ? 'active' : ''}`} onClick={() => onChange(f.id)}>
                <span className="font-sample" style={{ fontFamily: `fc-${f.id}, Montserrat` }}>{sample.slice(0, 18)}</span>
                <span className="font-name">{f.label}</span>
              </button>
            ))}
          </div>
        </div>
      );
  }
}
