// Resumo de fabricação: material, medidas, validação, estimativa e exportação.

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, Info, XCircle } from 'lucide-react';
import type { Issue, ModelDefinition, Params, Pt } from '../../core/types';
import type { RunOutput } from '../../core/run';
import type { Material, Settings } from '../../core/settings';
import { estimate } from '../../core/estimate';
import { prepareForExport } from '../../core/export/prepare';
import { buildDxf } from '../../core/export/dxf';
import { buildSvg } from '../../core/export/svg';
import { buildStl, DEFAULT_RELIEF } from '../../core/export/stl';
import { renderMockup } from '../mockup';
import { downloadBlob, slug } from '../storage';
import { fmtBrl, fmtDims, fmtTime } from '../format';

type Format = 'dxf' | 'svg' | 'stl' | 'png';

interface Props {
  model: ModelDefinition;
  params: Params;
  out: RunOutput;
  settings: Settings;
  material: Material;
  onMaterial: (id: string) => void;
  onFocus: (p: Pt) => void;
}

const ICON = {
  error: <XCircle size={16} />,
  warning: <AlertTriangle size={16} />,
  info: <Info size={16} />,
};

export function FabPanel({ model, params, out, settings, material, onMaterial, onFocus }: Props) {
  const [format, setFormat] = useState<Format>('dxf');
  const [kerf, setKerf] = useState(false);
  const [ack, setAck] = useState(false);
  const [watermark, setWatermark] = useState(true);
  const [showDetail, setShowDetail] = useState(false);
  const [busy, setBusy] = useState(false);

  const est = useMemo(() => (out.result.parts.length ? estimate(out.result, material, settings.machine, settings.pricing) : null), [out, material, settings]);
  const errors = out.issues.filter((i) => i.level === 'error');
  const warnings = out.issues.filter((i) => i.level === 'warning');
  const label = String(params[model.batchParam ?? ''] ?? '').trim();
  const baseName = `${model.id}_${slug(label || 'modelo')}_${Math.round(out.bounds.w)}x${Math.round(out.bounds.h)}mm`;

  const blocked = format !== 'png' && (errors.length > 0 || (warnings.length > 0 && !ack));

  const [note, setNote] = useState<string | null>(null);
  const doExport = async () => {
    setBusy(true);
    setNote(null);
    try {
      const meta = { modelo: model.id, versao: model.version, parametros: params, material: material.nome, kerf: kerf ? material.kerf : 0, data: new Date().toISOString() };
      if (format === 'png') {
        const blob = await renderMockup(out.result, { title: label || model.name, dims: fmtDims(out.bounds.w, out.bounds.h), material, watermark });
        setNote(await downloadBlob(blob, `${baseName}_mockup.png`));
      } else if (format === 'stl') {
        const buf = buildStl(out.result, { thickness: material.espessura, relief: DEFAULT_RELIEF }, `FazerCriar Studio ${model.id}`);
        setNote(await downloadBlob(new Blob([buf], { type: 'model/stl' }), `${baseName}_${material.espessura}mm.stl`));
      } else {
        const file = prepareForExport(out.result, { kerf: kerf ? material.kerf : 0 });
        const text = format === 'dxf' ? buildDxf(file, `FazerCriar Studio | ${model.name} | ${JSON.stringify(params)}`) : buildSvg(file, settings.colors, meta);
        setNote(await downloadBlob(new Blob([text], { type: format === 'dxf' ? 'application/dxf' : 'image/svg+xml' }), `${baseName}.${format}`));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fab">
      <section className="card">
        <h3 className="card-title">Material</h3>
        <select className="input" value={material.id} onChange={(e) => onMaterial(e.target.value)} aria-label="Material">
          {settings.materials.map((m) => (
            <option key={m.id} value={m.id}>{m.nome}</option>
          ))}
        </select>
        <dl className="kv">
          <dt>Medida final</dt>
          <dd className="strong">{fmtDims(out.bounds.w, out.bounds.h)}</dd>
          <dt>Peças</dt>
          <dd>{out.result.parts.length}</dd>
          {est && (
            <>
              <dt>Corte</dt>
              <dd>{(est.cutLength / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m · {est.cutCount} contornos</dd>
            </>
          )}
        </dl>
      </section>

      <section className="card">
        <h3 className="card-title">Verificação</h3>
        {out.issues.length === 0 ? (
          <p className="status ok"><CheckCircle2 size={18} /> Pronto para corte</p>
        ) : (
          <>
            <p className={`status ${errors.length ? 'error' : 'warning'}`}>
              {errors.length ? <XCircle size={18} /> : <AlertTriangle size={18} />}
              {errors.length ? `${errors.length} erro(s) bloqueiam a exportação` : `${warnings.length} aviso(s) para revisar`}
            </p>
            <ul className="issues">
              {out.issues.map((i: Issue, k) => (
                <li key={k} className={`issue issue-${i.level}`}>
                  <button disabled={!i.where} onClick={() => i.where && onFocus({ ...i.where })}>
                    {ICON[i.level]}
                    <span>{i.message}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {est && (
        <section className="card">
          <h3 className="card-title">Orçamento estimado</h3>
          <div className="quote">
            <div>
              <span className="quote-label">Tempo de máquina</span>
              <span className="quote-value">{fmtTime(est.totalS)}</span>
            </div>
            <div>
              <span className="quote-label">Preço sugerido</span>
              <span className="quote-value accent">{fmtBrl(est.price)}</span>
            </div>
          </div>
          <button className="link-btn" onClick={() => setShowDetail(!showDetail)}>{showDetail ? 'Ocultar detalhes' : 'Ver detalhes'}</button>
          {showDetail && (
            <dl className="kv small">
              <dt>Corte + perfuração</dt><dd>{fmtTime(est.cutS)}</dd>
              <dt>Gravação</dt><dd>{fmtTime(est.engraveS)}</dd>
              <dt>Marcação</dt><dd>{fmtTime(est.scoreS)}</dd>
              <dt>Deslocamento</dt><dd>{fmtTime(est.travelS)}</dd>
              <dt>Fator de calibração</dt><dd>× {settings.machine.fatorCalibracao.toLocaleString('pt-BR')}</dd>
              <dt>Material</dt><dd>{fmtBrl(est.materialCost)}</dd>
              <dt>Máquina</dt><dd>{fmtBrl(est.machineCost)}</dd>
              <dt>Custo fixo</dt><dd>{fmtBrl(est.fixedCost)}</dd>
              <dt>Custo total</dt><dd className="strong">{fmtBrl(est.cost)}</dd>
              <dt>Margem</dt><dd>{settings.pricing.margem}%</dd>
            </dl>
          )}
          <p className="help">Estimativa. Ajuste velocidades e custos em Configurações.</p>
        </section>
      )}

      <section className="card export">
        <h3 className="card-title">Exportar</h3>
        <div className="seg" role="radiogroup" aria-label="Formato">
          {(['dxf', 'svg', 'stl', 'png'] as Format[]).map((f) => (
            <button key={f} role="radio" aria-checked={format === f} className={format === f ? 'active' : ''} onClick={() => setFormat(f)}>
              {f === 'png' ? 'Mockup' : f.toUpperCase()}
            </button>
          ))}
        </div>
        <p className="help">
          {format === 'dxf' && 'DXF para corte a laser, em milímetros. Camadas: CORTE (vermelho), GRAVACAO (preto), MARCACAO (azul).'}
          {format === 'svg' && 'SVG em escala 1:1 (mm), com grupos de corte, gravação e marcação.'}
          {format === 'stl' && `Peça 3D para impressão: ${material.espessura.toLocaleString('pt-BR')} mm de espessura (do material) e gravação em relevo de ${DEFAULT_RELIEF.toLocaleString('pt-BR')} mm.`}
          {format === 'png' && 'Imagem 1080 × 1080 com sua marca, para o cliente aprovar pelo WhatsApp.'}
        </p>
        {format === 'stl' ? null : format !== 'png' ? (
          <label className="check">
            <input type="checkbox" checked={kerf} onChange={(e) => setKerf(e.target.checked)} />
            Compensar kerf ({material.kerf.toLocaleString('pt-BR')} mm)
          </label>
        ) : (
          <label className="check">
            <input type="checkbox" checked={watermark} onChange={(e) => setWatermark(e.target.checked)} />
            Marca d'água "PRÉVIA"
          </label>
        )}
        {format !== 'png' && warnings.length > 0 && errors.length === 0 && (
          <label className="check warn">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
            Revisei os avisos
          </label>
        )}
        <button className="btn btn-primary btn-block" disabled={blocked || busy || !out.result.parts.length} onClick={doExport}>
          <Download size={18} /> {busy ? 'Gerando…' : `Baixar ${format === 'png' ? 'mockup' : format.toUpperCase()}`}
        </button>
        {note && <p className="help">{note}</p>}
      </section>
    </div>
  );
}
