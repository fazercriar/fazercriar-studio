import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, FileJson, Layers, Redo2, Save, Undo2 } from 'lucide-react';
import type { ParamValue, Params, Pt } from '../../core/types';
import { defaultParams, runModel } from '../../core/run';
import { getModel } from '../../models/registry';
import { useApp } from '../AppState';
import { ParamPanel } from '../components/ParamPanel';
import { Preview, type PreviewMode } from '../components/Preview';
import { FabPanel } from '../components/FabPanel';
import { BatchDialog } from '../components/BatchDialog';
import { downloadBlob, getProject, newId, saveProject, slug, touchRecentModel } from '../storage';
import { go } from '../router';

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function Studio({ modelId, projectId, initialParams = {} }: { modelId: string; projectId?: string; initialParams?: Params }) {
  const { ctx, settings, material: getMaterial } = useApp();
  const model = getModel(modelId)!;
  const project = projectId ? getProject(projectId) : undefined;

  const [params, setParams] = useState<Params>(() => ({ ...defaultParams(model), ...(project?.modelId === model.id ? project.params : {}), ...initialParams }));
  const [materialId, setMaterialId] = useState(project?.materialId ?? settings.materials[0].id);
  const [mode, setMode] = useState<PreviewMode>('produto');
  const [focus, setFocus] = useState<Pt | null>(null);
  const [batch, setBatch] = useState(false);
  const [projId, setProjId] = useState(project?.id);
  const [toast, setToast] = useState<string | null>(null);

  // Histórico para desfazer/refazer (alterações seguidas no mesmo campo viram um passo só).
  const past = useRef<Params[]>([]);
  const future = useRef<Params[]>([]);
  const last = useRef<{ id: string; t: number }>({ id: '', t: 0 });

  useEffect(() => touchRecentModel(model.id), [model.id]);

  const change = useCallback((id: string, value: ParamValue) => {
    setParams((prev) => {
      const now = Date.now();
      if (last.current.id !== id || now - last.current.t > 800) past.current.push(prev);
      last.current = { id, t: now };
      future.current = [];
      return { ...prev, [id]: value };
    });
  }, []);

  const undo = useCallback(() => {
    const p = past.current.pop();
    if (!p) return;
    setParams((cur) => {
      future.current.push(cur);
      return p;
    });
    last.current = { id: '', t: 0 };
  }, []);

  const redo = useCallback(() => {
    const n = future.current.pop();
    if (!n) return;
    setParams((cur) => {
      past.current.push(cur);
      return n;
    });
    last.current = { id: '', t: 0 };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const material = getMaterial(materialId);
  const debounced = useDebounced(params, 120);
  const out = useMemo(() => runModel(model, debounced, ctx, material, settings.machine), [model, debounced, ctx, material, settings.machine]);

  const label = String(params[model.batchParam ?? ''] ?? '').trim();

  const save = () => {
    const id = projId ?? newId();
    saveProject({ id, name: label ? `${model.name} · ${label}` : model.name, modelId: model.id, modelVersion: model.version, materialId, params, updatedAt: Date.now() });
    setProjId(id);
    if (!projId) history.replaceState(null, '', `#/estudio/${model.id}?projeto=${id}`);
    setToast('Projeto salvo neste navegador');
  };

  const exportProject = () => {
    const data = { formato: 'fazercriar-projeto', versao: 1, modelo: model.id, versaoModelo: model.version, material: materialId, parametros: params };
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `${model.id}_${slug(label || 'projeto')}.fazercriar.json`);
  };

  return (
    <div className="studio">
      <aside className="studio-left">
        <div className="studio-head">
          <button className="icon-btn" onClick={() => go('#/biblioteca')} title="Voltar à biblioteca" aria-label="Voltar"><ArrowLeft size={18} /></button>
          <div>
            <p className="eyebrow">Estúdio</p>
            <h1 className="studio-title">{model.name}</h1>
          </div>
        </div>
        <ParamPanel model={model} params={params} ctx={ctx} onChange={change} onReset={() => { past.current.push(params); setParams(defaultParams(model)); }} />
      </aside>

      <main className="studio-center">
        <div className="toolbar">
          <div className="seg seg-sm">
            <button className={mode === 'produto' ? 'active' : ''} onClick={() => setMode('produto')}>Produto</button>
            <button className={mode === 'operacoes' ? 'active' : ''} onClick={() => setMode('operacoes')}>Operações</button>
          </div>
          {mode === 'operacoes' && (
            <div className="legend">
              <span><i style={{ background: settings.colors.corte }} />Corte</span>
              <span><i style={{ background: settings.colors.gravacao }} />Gravação</span>
              <span><i style={{ background: settings.colors.marcacao }} />Marcação</span>
              <span><i className="dashed" />Guia</span>
            </div>
          )}
          <div className="toolbar-right">
            <button className="icon-btn" onClick={undo} title="Desfazer (Ctrl+Z)" aria-label="Desfazer"><Undo2 size={17} /></button>
            <button className="icon-btn" onClick={redo} title="Refazer (Ctrl+Y)" aria-label="Refazer"><Redo2 size={17} /></button>
            <button className="btn btn-ghost btn-sm" onClick={exportProject} title="Baixar o projeto para reabrir depois"><FileJson size={16} /> Projeto</button>
            <button className="btn btn-ghost btn-sm" onClick={save}><Save size={16} /> Salvar</button>
            {model.batchParam && <button className="btn btn-dark btn-sm" onClick={() => setBatch(true)}><Layers size={16} /> Lote</button>}
          </div>
        </div>
        <Preview result={out.result} bounds={out.bounds} issues={out.issues} material={material} colors={settings.colors} mode={mode} focus={focus} fitKey={model.id} />
        {toast && <div className="toast" role="status">{toast}</div>}
      </main>

      <aside className="studio-right">
        <FabPanel model={model} params={debounced} out={out} settings={settings} material={material} onMaterial={setMaterialId} onFocus={setFocus} />
      </aside>

      {batch && <BatchDialog model={model} params={params} ctx={ctx} material={material} settings={settings} onClose={() => setBatch(false)} />}
    </div>
  );
}
