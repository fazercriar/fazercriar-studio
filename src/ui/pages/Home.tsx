import { useEffect, useRef, useState } from 'react';
import { ConfirmButton } from '../components/ConfirmButton';
import { FolderOpen, Library, Plus, Trash2, Upload } from 'lucide-react';
import { MODELS, getModel } from '../../models/registry';
import { useApp } from '../AppState';
import { useModelThumbs } from '../thumbs';
import { ShapeThumb } from '../components/ShapeThumb';
import { deleteProject, listProjects, newId, saveProject } from '../storage';
import { go } from '../router';

export function Home() {
  const { settings, syncVersion } = useApp();
  const thumbs = useModelThumbs();
  const [projects, setProjects] = useState(listProjects);
  useEffect(() => setProjects(listProjects()), [syncVersion]);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const importProject = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      const model = getModel(data.modelo);
      if (data.formato !== 'fazercriar-projeto' || !model) throw new Error('Arquivo de projeto inválido.');
      const id = newId();
      saveProject({ id, name: `${model.name} (importado)`, modelId: model.id, modelVersion: data.versaoModelo ?? 1, materialId: data.material ?? settings.materials[0].id, params: data.parametros ?? {}, updatedAt: Date.now() });
      go(`#/estudio/${model.id}?projeto=${id}`);
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-lines" aria-hidden="true" />
        <div className="hero-inner">
          <p className="eyebrow light">FazerCriar Studio</p>
          <h1 className="hero-title">
            Da ideia<br /><span className="accent">ao produto.</span>
          </h1>
          <p className="hero-sub">Escolha um modelo, personalize e baixe o arquivo pronto para o laser — com verificação, orçamento e mockup para o cliente.</p>
          <div className="hero-actions">
            <button className="btn btn-primary btn-lg" onClick={() => go('#/biblioteca')}><Plus size={20} /> Criar novo produto</button>
            <button className="btn btn-outline-light btn-lg" onClick={() => fileRef.current?.click()}><Upload size={18} /> Abrir projeto</button>
            <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => e.target.files?.[0] && importProject(e.target.files[0])} />
          </div>
          {msg && <p className="hero-msg">{msg}</p>}
        </div>
      </section>

      <div className="page">
        <section>
          <div className="section-head">
            <h2>Modelos</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => go('#/biblioteca')}><Library size={16} /> Ver biblioteca</button>
          </div>
          <div className="cards">
            {MODELS.map((m) => (
              <button key={m.id} className="card model-card" onClick={() => go(`#/estudio/${m.id}`)}>
                <div className="model-thumb">{thumbs[m.id] && <ShapeThumb shape={thumbs[m.id].solid} engrave={thumbs[m.id].engrave} fill={settings.materials[0].cor} engraveFill={settings.materials[0].corGravacao} />}</div>
                <h3>{m.name}</h3>
                <p>{m.description}</p>
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="section-head">
            <h2>Projetos salvos</h2>
          </div>
          {projects.length === 0 ? (
            <p className="muted">Nenhum projeto salvo ainda. No estúdio, use "Salvar" para guardar a personalização neste navegador.</p>
          ) : (
            <ul className="project-list">
              {projects.slice(0, 12).map((p) => (
                <li key={p.id} className="card project">
                  <div>
                    <strong>{p.name}</strong>
                    <span className="muted small">{new Date(p.updatedAt).toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="project-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => go(`#/estudio/${p.modelId}?projeto=${p.id}`)}><FolderOpen size={16} /> Abrir</button>
                    <ConfirmButton aria-label="Excluir projeto" title="Excluir" confirmLabel="Excluir?" onConfirm={() => { deleteProject(p.id); setProjects(listProjects()); }}><Trash2 size={16} /></ConfirmButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
