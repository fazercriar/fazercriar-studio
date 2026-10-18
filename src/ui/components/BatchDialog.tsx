// Produção em lote: uma lista de nomes vira um ZIP com arquivos individuais ou chapas organizadas.

import { useMemo, useState } from 'react';
import JSZip from 'jszip';
import { CheckCircle2, Download, X, XCircle, AlertTriangle } from 'lucide-react';
import type { GenContext, ModelDefinition, Params } from '../../core/types';
import type { Material, Settings } from '../../core/settings';
import { runModel, type RunOutput } from '../../core/run';
import { estimate } from '../../core/estimate';
import { prepareForExport } from '../../core/export/prepare';
import { buildDxf } from '../../core/export/dxf';
import { buildSvg } from '../../core/export/svg';
import { buildStl, DEFAULT_RELIEF } from '../../core/export/stl';
import { arrangeOnSheets } from '../../core/export/sheet';
import { downloadBlob, slug } from '../storage';
import { fmtBrl, fmtDims, fmtTime } from '../format';

interface Props {
  model: ModelDefinition;
  params: Params;
  ctx: GenContext;
  material: Material;
  settings: Settings;
  onClose: () => void;
}

interface Row {
  name: string;
  out: RunOutput;
}

const nextFrame = () => new Promise((r) => setTimeout(r, 0));

export function BatchDialog({ model, params, ctx, material, settings, onClose }: Props) {
  const key = model.batchParam!;
  const [text, setText] = useState(String(params[key] ?? ''));
  const [rows, setRows] = useState<Row[] | null>(null);
  const [progress, setProgress] = useState(0);
  const [mode, setMode] = useState<'chapa' | 'individual'>('chapa');
  const [format, setFormat] = useState<'dxf' | 'svg' | 'stl'>('dxf');
  const [kerf, setKerf] = useState(false);

  const names = useMemo(() => text.split(/\r?\n|;|\t/).map((s) => s.trim()).filter(Boolean), [text]);

  const generate = async () => {
    const out: Row[] = [];
    setRows(null);
    for (let i = 0; i < names.length; i++) {
      out.push({ name: names[i], out: runModel(model, { ...params, [key]: names[i] }, ctx, material, settings.machine) });
      if (i % 5 === 4) {
        setProgress((i + 1) / names.length);
        await nextFrame();
      }
    }
    setProgress(1);
    setRows(out);
  };

  const ok = rows?.filter((r) => r.out.ok) ?? [];
  const sheets = useMemo(
    () => (mode === 'chapa' && ok.length ? arrangeOnSheets(ok.map((r) => ({ label: r.name, result: r.out.result })), settings.machine.areaW, settings.machine.areaH, settings.espacamentoLote) : []),
    [rows, mode, settings], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const totals = useMemo(() => {
    if (!ok.length) return null;
    const ests = ok.map((r) => estimate(r.out.result, material, settings.machine, settings.pricing, { includeFixed: false }));
    const seconds = ests.reduce((a, e) => a + e.totalS, 0);
    const cost = ests.reduce((a, e) => a + e.cost, 0) + settings.pricing.custoFixo;
    return { seconds, cost, price: Math.ceil(cost * (1 + settings.pricing.margem / 100) * 2) / 2 };
  }, [rows, material, settings]); // eslint-disable-line react-hooks/exhaustive-deps

  const download = async () => {
    const zip = new JSZip();
    const k = kerf ? material.kerf : 0;
    const build = (result: RunOutput['result'], comment: string) => {
      if (format === 'stl') return buildStl(result, { thickness: material.espessura, relief: DEFAULT_RELIEF }, comment);
      const f = prepareForExport(result, { kerf: k });
      return format === 'dxf' ? buildDxf(f, comment) : buildSvg(f, settings.colors, { modelo: model.id, lote: comment });
    };
    if (mode === 'chapa') {
      sheets.forEach((s, i) => zip.file(`chapa-${String(i + 1).padStart(2, '0')}.${format}`, build(s.result, `Chapa ${i + 1}: ${s.labels.join(', ')}`)));
      zip.file('lista-de-producao.txt', sheets.map((s, i) => `Chapa ${i + 1}: ${s.labels.join(', ')}`).join('\r\n'));
    } else {
      ok.forEach((r, i) => zip.file(`${String(i + 1).padStart(3, '0')}_${slug(r.name)}.${format}`, build(r.out.result, r.name)));
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, `lote_${model.id}_${ok.length}itens.zip`);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Produção em lote">
      <div className="modal">
        <header className="modal-head">
          <h2>Produção em lote</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </header>
        <div className="modal-body batch">
          <div className="batch-input">
            <label htmlFor="batch-names">Um nome por linha (pode colar uma coluna da planilha)</label>
            <textarea id="batch-names" className="input" rows={12} value={text} onChange={(e) => { setText(e.target.value); setRows(null); }} />
            <p className="help">{names.length} item(ns) · demais opções iguais às do estúdio · material: {material.nome}</p>
            <button className="btn btn-dark" disabled={!names.length} onClick={generate}>Gerar {names.length} item(ns)</button>
            {progress > 0 && progress < 1 && <progress value={progress} max={1} />}
          </div>
          <div className="batch-result">
            {!rows ? (
              <p className="muted">Clique em gerar para validar cada nome.</p>
            ) : (
              <>
                <table className="table">
                  <thead><tr><th>Nome</th><th>Medida</th><th>Status</th></tr></thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const err = r.out.issues.find((x) => x.level === 'error');
                      const warn = r.out.issues.find((x) => x.level === 'warning');
                      return (
                        <tr key={i}>
                          <td>{r.name}</td>
                          <td>{fmtDims(r.out.bounds.w, r.out.bounds.h)}</td>
                          <td className={err ? 'c-error' : warn ? 'c-warning' : 'c-ok'}>
                            {err ? <><XCircle size={14} /> {err.message}</> : warn ? <><AlertTriangle size={14} /> {warn.message}</> : <><CheckCircle2 size={14} /> OK</>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="batch-summary">
                  <p><strong>{ok.length}</strong> de {rows.length} prontos{rows.length - ok.length ? ` · ${rows.length - ok.length} com erro ficam de fora` : ''}.</p>
                  {totals && <p>Tempo total estimado: <strong>{fmtTime(totals.seconds)}</strong> · Preço sugerido do lote: <strong className="accent">{fmtBrl(totals.price)}</strong></p>}
                  <div className="seg">
                    <button className={mode === 'chapa' ? 'active' : ''} onClick={() => { setMode('chapa'); if (format === 'stl') setFormat('dxf'); }}>Chapas {settings.machine.areaW} × {settings.machine.areaH}</button>
                    <button className={mode === 'individual' ? 'active' : ''} onClick={() => setMode('individual')}>Um arquivo por nome</button>
                  </div>
                  <div className="seg">
                    <button className={format === 'dxf' ? 'active' : ''} onClick={() => setFormat('dxf')}>DXF</button>
                    <button className={format === 'svg' ? 'active' : ''} onClick={() => setFormat('svg')}>SVG</button>
                    <button className={format === 'stl' ? 'active' : ''} disabled={mode === 'chapa'} title={mode === 'chapa' ? 'STL só com um arquivo por nome' : undefined} onClick={() => setFormat('stl')}>STL</button>
                  </div>
                  <label className="check">
                    <input type="checkbox" checked={kerf} onChange={(e) => setKerf(e.target.checked)} /> Compensar kerf ({material.kerf.toLocaleString('pt-BR')} mm)
                  </label>
                  {mode === 'chapa' && <p className="help">{sheets.length} chapa(s), espaçamento de {settings.espacamentoLote} mm. Organização em grade (sem nesting).</p>}
                  <button className="btn btn-primary" disabled={!ok.length} onClick={download}><Download size={18} /> Baixar ZIP</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
