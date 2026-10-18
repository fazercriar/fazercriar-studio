import { useState } from 'react';
import { Download, PenTool, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { go } from '../router';
import { ConfirmButton } from '../components/ConfirmButton';
import { DEFAULT_SETTINGS, type Material, type Settings } from '../../core/settings';
import { framePreview } from '../../core/frames';
import { useApp } from '../AppState';
import { ShapeThumb } from '../components/ShapeThumb';
import { downloadBlob, newId } from '../storage';
import bolaSvg from '../../models/enfeite-natal/molduras/bola.svg?raw';

type NumKeys<T> = { [K in keyof T]: T[K] extends number ? K : never }[keyof T];

function Num<T>({ label, obj, k, onChange, unit, step = 0.01 }: { label: string; obj: T; k: NumKeys<T>; onChange: (o: T) => void; unit?: string; step?: number }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="num-box">
        <input type="number" className="input" step={step} value={obj[k] as number} onChange={(e) => e.target.value !== '' && onChange({ ...obj, [k]: Number(e.target.value) })} />
        {unit && <span className="unit">{unit}</span>}
      </span>
    </label>
  );
}

const MAT_COLS: { k: NumKeys<Material>; label: string; unit: string }[] = [
  { k: 'espessura', label: 'Espessura', unit: 'mm' },
  { k: 'kerf', label: 'Kerf', unit: 'mm' },
  { k: 'ponteMin', label: 'Ponte mín.', unit: 'mm' },
  { k: 'detalheMin', label: 'Detalhe mín.', unit: 'mm' },
  { k: 'corteVel', label: 'Corte vel.', unit: 'mm/s' },
  { k: 'cortePot', label: 'Corte pot.', unit: '%' },
  { k: 'gravVel', label: 'Grav. vel.', unit: 'mm/s' },
  { k: 'gravPot', label: 'Grav. pot.', unit: '%' },
  { k: 'intervalo', label: 'Intervalo', unit: 'mm' },
  { k: 'chapaPreco', label: 'Chapa', unit: 'R$' },
  { k: 'chapaW', label: 'Chapa larg.', unit: 'mm' },
  { k: 'chapaH', label: 'Chapa alt.', unit: 'mm' },
];

export function SettingsPage() {
  const { settings, setSettings, resetSettings, ctx, userFrames, removeUserFrame, frameErrors } = useApp();
  const [s, setS] = useState<Settings>(settings);
  const dirty = JSON.stringify(s) !== JSON.stringify(settings);

  const setMat = (i: number, m: Material) => setS({ ...s, materials: s.materials.map((x, j) => (j === i ? m : x)) });

  return (
    <div className="page settings">
      <div className="section-head">
        <div>
          <p className="eyebrow">Configurações</p>
          <h1>Máquina, materiais e custos</h1>
          <p className="muted">Os valores iniciais são exemplos. Ajuste com os dados reais da sua máquina e dos seus fornecedores.</p>
        </div>
        <div className="row-gap">
          <ConfirmButton className="btn btn-ghost" confirmLabel="Clique de novo para restaurar" onConfirm={() => { resetSettings(); setS(DEFAULT_SETTINGS); }}><RotateCcw size={16} /> Restaurar exemplos</ConfirmButton>
          <button className="btn btn-primary" disabled={!dirty} onClick={() => setSettings(s)}>{dirty ? 'Salvar alterações' : 'Salvo'}</button>
        </div>
      </div>

      <section className="card">
        <h2 className="card-title">Máquina</h2>
        <div className="form-grid">
          <label className="field">
            <span className="field-label">Nome</span>
            <input className="input" value={s.machine.nome} onChange={(e) => setS({ ...s, machine: { ...s.machine, nome: e.target.value } })} />
          </label>
          <Num label="Área útil — largura" obj={s.machine} k="areaW" unit="mm" step={1} onChange={(machine) => setS({ ...s, machine })} />
          <Num label="Área útil — altura" obj={s.machine} k="areaH" unit="mm" step={1} onChange={(machine) => setS({ ...s, machine })} />
          <Num label="Deslocamento em vazio" obj={s.machine} k="deslocVel" unit="mm/s" step={1} onChange={(machine) => setS({ ...s, machine })} />
          <Num label="Tempo por perfuração" obj={s.machine} k="perfuracaoS" unit="s" onChange={(machine) => setS({ ...s, machine })} />
          <Num label="Aceleração por linha de gravação" obj={s.machine} k="aceleracaoLinhaS" unit="s" onChange={(machine) => setS({ ...s, machine })} />
          <Num label="Fator de calibração do tempo" obj={s.machine} k="fatorCalibracao" unit="×" onChange={(machine) => setS({ ...s, machine })} />
          <Num label="Custo da máquina" obj={s.machine} k="custoMinuto" unit="R$/min" onChange={(machine) => setS({ ...s, machine })} />
        </div>
        <p className="help">Dica: corte uma peça, compare o tempo real do RDWorks com a estimativa e ajuste o fator de calibração.</p>
      </section>

      <section className="card">
        <h2 className="card-title">Preço</h2>
        <div className="form-grid">
          <Num label="Custo fixo por pedido" obj={s.pricing} k="custoFixo" unit="R$" onChange={(pricing) => setS({ ...s, pricing })} />
          <Num label="Margem" obj={s.pricing} k="margem" unit="%" step={1} onChange={(pricing) => setS({ ...s, pricing })} />
          <Num label="Perda de material" obj={s.pricing} k="perda" unit="%" step={1} onChange={(pricing) => setS({ ...s, pricing })} />
          <Num label="Espaço entre peças no lote" obj={s} k="espacamentoLote" unit="mm" step={0.5} onChange={setS} />
        </div>
      </section>

      <section className="card">
        <div className="section-head tight">
          <h2 className="card-title">Materiais</h2>
          <button className="btn btn-ghost btn-sm" onClick={() => setS({ ...s, materials: [...s.materials, { ...s.materials[0], id: newId(), nome: 'Novo material' }] })}><Plus size={16} /> Material</button>
        </div>
        <div className="table-wrap">
          <table className="table mat-table">
            <thead>
              <tr>
                <th>Nome</th>
                {MAT_COLS.map((c) => <th key={c.k}>{c.label}<br /><span className="muted small">{c.unit}</span></th>)}
                <th>Cor</th>
                <th>Gravação</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {s.materials.map((m, i) => (
                <tr key={m.id}>
                  <td><input className="input" value={m.nome} onChange={(e) => setMat(i, { ...m, nome: e.target.value })} /></td>
                  {MAT_COLS.map((c) => (
                    <td key={c.k}><input className="input" type="number" step="0.01" value={m[c.k]} onChange={(e) => e.target.value !== '' && setMat(i, { ...m, [c.k]: Number(e.target.value) })} /></td>
                  ))}
                  <td><input type="color" value={m.cor} onChange={(e) => setMat(i, { ...m, cor: e.target.value })} aria-label="Cor da prévia" /></td>
                  <td><input type="color" value={m.corGravacao} onChange={(e) => setMat(i, { ...m, corGravacao: e.target.value })} aria-label="Cor da gravação" /></td>
                  <td><button className="icon-btn" disabled={s.materials.length < 2} onClick={() => setS({ ...s, materials: s.materials.filter((_, j) => j !== i) })} aria-label="Remover material"><Trash2 size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Cores das operações no SVG</h2>
        <div className="form-grid">
          {(['corte', 'gravacao', 'marcacao'] as const).map((k) => (
            <label key={k} className="field">
              <span className="field-label">{{ corte: 'Corte', gravacao: 'Gravação', marcacao: 'Marcação' }[k]}</span>
              <input type="color" value={s.colors[k]} onChange={(e) => setS({ ...s, colors: { ...s.colors, [k]: e.target.value } })} />
            </label>
          ))}
        </div>
        <p className="help">No DXF as camadas usam cores fixas do padrão AutoCAD: CORTE = 1 (vermelho), GRAVACAO = 7 (preto), MARCACAO = 5 (azul).</p>
      </section>

      <section className="card">
        <div className="section-head tight">
          <h2 className="card-title">Molduras do enfeite</h2>
          <div className="row-gap">
            <button className="btn btn-ghost btn-sm" onClick={() => downloadBlob(new Blob([bolaSvg], { type: 'image/svg+xml' }), 'modelo-moldura.svg')}><Download size={16} /> Baixar modelo de exemplo</button>
            <button className="btn btn-primary btn-sm" onClick={() => go('#/molduras/nova')}><PenTool size={16} /> Preparar nova moldura</button>
          </div>
        </div>
        <p className="help">
          Carregue um SVG ou DXF (por exemplo, um enfeite pronto), clique nas linhas e diga o que cada uma é: contorno, janela do nome, furo, recortes, gravação ou apagar.
        </p>
        {frameErrors.length > 0 && <p className="notice error">{frameErrors.join(' ')}</p>}
        <div className="frames">
          {ctx.frames.list().map((f) => (
            <div key={f.id} className="frame-item">
              <ShapeThumb shape={framePreview(f)} engrave={f.gravacao} fill="var(--fc-grafite)" engraveFill="rgba(255,106,0,.8)" />
              <span>{f.name}</span>
              {f.builtIn ? (
                <span className="tag tag-soft">Original</span>
              ) : (
                <span className="row-gap">
                  <button className="icon-btn" onClick={() => go(`#/molduras/editar/${f.id}`)} aria-label={`Editar ${f.name}`} title="Editar"><Pencil size={15} /></button>
                  <ConfirmButton onConfirm={() => removeUserFrame(f.id)} aria-label={`Remover ${f.name}`} title="Remover" confirmLabel="Remover?"><Trash2 size={15} /></ConfirmButton>
                </span>
              )}
            </div>
          ))}
        </div>
        {userFrames.length === 0 && <p className="muted small">Nenhuma moldura sua ainda. As molduras adicionadas aqui ficam salvas neste navegador.</p>}
      </section>
    </div>
  );
}
