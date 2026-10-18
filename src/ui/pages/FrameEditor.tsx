// Preparar moldura: carregar um SVG/DXF, passar o mouse nas linhas, selecionar e dizer a função de cada uma.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, FileUp, Maximize, Minus, Plus, Save, Sparkles, Undo2, Wand2, XCircle } from 'lucide-react';
import type { Pt } from '../../core/types';
import { bounds } from '../../core/geometry/clip';
import { shapeToD } from '../../core/geometry/path';
import { autoAssign, buildFrameSvg, importDrawing, importSvg, ROLES, type Contour, type Role } from '../../core/import/contours';
import { createFrameRegistry } from '../../core/frames';
import { defaultParams, runModel } from '../../core/run';
import { enfeiteNatal } from '../../models/enfeite-natal';
import { useApp } from '../AppState';
import { ShapeThumb } from '../components/ShapeThumb';
import { downloadBlob, slug } from '../storage';
import { go } from '../router';

type Roles = Record<string, Role | undefined>;
interface View { x: number; y: number; w: number; h: number }

const ROLE_BY_ID = Object.fromEntries(ROLES.map((r) => [r.id, r]));
const KEY_ROLE: Record<string, Role> = { c: 'contorno', j: 'janela', f: 'furo', r: 'recortes', g: 'gravacao', delete: 'apagar', backspace: 'apagar' };

export function FrameEditor({ editId }: { editId?: string }) {
  const { ctx, settings, userFrames, saveUserFrame } = useApp();
  const editing = editId ? userFrames.find((f) => f.id === editId) : undefined;

  const [contours, setContours] = useState<Contour[]>([]);
  const [roles, setRoles] = useState<Roles>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<string | null>(null);
  const [tip, setTip] = useState<Pt | null>(null);
  const [fileName, setFileName] = useState('');
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [savedId, setSavedId] = useState<string | undefined>(editId);
  const [toast, setToast] = useState<string | null>(null);
  const [testName, setTestName] = useState('Felipe');
  const [testFont, setTestFont] = useState('lilita');
  const [showList, setShowList] = useState(false);
  const history = useRef<Roles[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback((text: string, file: string, keepRoles = false) => {
    try {
      const r = keepRoles ? importSvg(text) : importDrawing(file, text);
      if (!r.contours.length) throw new Error('Nenhuma linha encontrada no arquivo.');
      setContours(r.contours);
      const fromFile = Object.fromEntries(r.contours.filter((c) => c.role).map((c) => [c.id, c.role]));
      setRoles(Object.keys(fromFile).length ? fromFile : {});
      setSelected(new Set());
      setImportWarnings(r.warnings);
      setFileName(file);
      setLoadError(null);
      history.current = [];
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      load(editing.svg, `${editing.name}.svg`, true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const openFile = async (f: File) => {
    if (f.size > 5_000_000) return setLoadError('Arquivo maior que 5 MB.');
    const text = await f.text();
    if (!name) setName(f.name.replace(/\.(svg|dxf)$/i, '').replace(/[-_]+/g, ' '));
    load(text, f.name);
  };

  const setRolesWithHistory = (next: Roles) => {
    history.current.push(roles);
    setRoles(next);
  };
  const assign = (role: Role | undefined, ids: Iterable<string> = selected) => {
    const next = { ...roles };
    for (const id of ids) next[id] = role;
    setRolesWithHistory(next);
  };
  const undo = () => {
    const prev = history.current.pop();
    if (prev) setRoles(prev);
  };

  // ---------- Atalhos ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof Element && t.closest('input, textarea, select')) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); undo(); return; }
      if ((e.ctrlKey || e.metaKey) && k === 'a') { e.preventDefault(); setSelected(new Set(contours.map((c) => c.id))); return; }
      if (k === 'escape') { setSelected(new Set()); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (k === 'u' && selected.size) { assign(undefined); return; }
      const role = KEY_ROLE[k];
      if (role && selected.size) { e.preventDefault(); assign(role); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ---------- Visualização ----------
  const all = useMemo(() => bounds(contours.map((c) => c.poly)), [contours]);
  const wrap = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [aspect, setAspect] = useState(1.3);
  const [view, setView] = useState<View>({ x: 0, y: 0, w: 100, h: 80 });
  const fit = useCallback(() => {
    const b = all;
    const pad = Math.max(b.w, b.h) * 0.08 + 2;
    let w = b.w + pad * 2, h = b.h + pad * 2;
    if (w / h > aspect) h = w / aspect;
    else w = h * aspect;
    setView({ x: b.x + b.w / 2 - w / 2, y: b.y + b.h / 2 - h / 2, w, h });
  }, [all, aspect]);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAspect(Math.max(0.3, el.clientWidth / Math.max(1, el.clientHeight))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [contours.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (contours.length) fit(); }, [contours, aspect]); // eslint-disable-line react-hooks/exhaustive-deps

  const toSvg = (cx: number, cy: number): Pt => {
    const r = svg.current!.getBoundingClientRect();
    const k = Math.max(view.w / r.width, view.h / r.height);
    const ox = (r.width - view.w / k) / 2, oy = (r.height - view.h / k) / 2;
    return { x: view.x + (cx - r.left - ox) * k, y: view.y + (cy - r.top - oy) * k };
  };
  const zoom = (f: number, at?: Pt) =>
    setView((v) => {
      const c = at ?? { x: v.x + v.w / 2, y: v.y + v.h / 2 };
      const w = Math.min(10000, Math.max(1, v.w * f)), h = (w / v.w) * v.h;
      return { x: c.x - ((c.x - v.x) / v.w) * w, y: c.y - ((c.y - v.y) / v.h) * h, w, h };
    });
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15, toSvg(e.clientX, e.clientY)); };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  const drag = useRef<{ sx: number; sy: number; v: View; box: boolean; moved: boolean; start: Pt } | null>(null);
  const [box, setBox] = useState<{ a: Pt; b: Pt } | null>(null);

  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const p = toSvg(e.clientX, e.clientY);
    drag.current = { sx: e.clientX, sy: e.clientY, v: view, box: e.shiftKey && !(e.target as Element).getAttribute('data-hit'), moved: false, start: p };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 3) d.moved = true;
    if (!d.moved) return;
    if (d.box) setBox({ a: d.start, b: toSvg(e.clientX, e.clientY) });
    else {
      const r = svg.current!.getBoundingClientRect();
      const k = Math.max(d.v.w / r.width, d.v.h / r.height);
      setView({ ...d.v, x: d.v.x - (e.clientX - d.sx) * k, y: d.v.y - (e.clientY - d.sy) * k });
    }
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.box && box) {
      const x0 = Math.min(box.a.x, box.b.x), x1 = Math.max(box.a.x, box.b.x), y0 = Math.min(box.a.y, box.b.y), y1 = Math.max(box.a.y, box.b.y);
      const inside = contours.filter((c) => { const b = bounds([c.poly]); return b.x >= x0 && b.y >= y0 && b.x + b.w <= x1 && b.y + b.h <= y1; });
      setSelected(new Set([...selected, ...inside.map((c) => c.id)]));
      setBox(null);
      return;
    }
    setBox(null);
    if (!d.moved && !(e.target as Element).getAttribute('data-hit')) setSelected(new Set());
  };

  const clickContour = (e: React.MouseEvent, id: string) => {
    if (drag.current?.moved) return;
    const multi = e.shiftKey || e.ctrlKey || e.metaKey;
    setSelected((prev) => {
      const next = new Set(multi ? prev : []);
      if (multi && next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Linhas maiores embaixo, menores por cima (mais fáceis de pegar).
  const drawn = useMemo(
    () => [...contours].map((c) => ({ c, d: shapeToD([c.poly]), d2: c.closed ? '' : 'M' + c.poly.map((q) => `${q.x.toFixed(3)} ${q.y.toFixed(3)}`).join('L'), a: (() => { const b = bounds([c.poly]); return b.w * b.h; })() })).sort((p, q) => q.a - p.a),
    [contours],
  );

  // ---------- Resultado ----------
  const built = useMemo(() => (contours.length ? buildFrameSvg(contours, roles, name.trim() || 'Moldura', 'previa') : null), [contours, roles, name]);
  const test = useMemo(() => {
    if (!built?.frame) return null;
    const testCtx = { ...ctx, frames: createFrameRegistry([built.frame]) };
    return runModel(enfeiteNatal, { ...defaultParams(enfeiteNatal), moldura: 'previa', nome: testName, fonte: testFont }, testCtx, settings.materials[0], settings.machine);
  }, [built, ctx, testName, testFont, settings]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const x of contours) { const r = roles[x.id] ?? 'none'; c[r] = (c[r] ?? 0) + 1; }
    return c;
  }, [contours, roles]);
  const openCount = contours.filter((c) => !c.closed).length;
  const janelaHull = built?.janela && (counts.janela ?? 0) > 1 ? shapeToD([built.janela]) : '';
  const canSave = !!built?.frame && built.errors.length === 0 && name.trim().length > 0;

  const doSave = () => {
    if (!built?.svg || !canSave) return;
    const r = saveUserFrame(built.svg, name.trim(), savedId);
    if (r.frame) {
      setSavedId(r.id);
      setToast('Moldura salva. Ela já aparece no Enfeite de Natal.');
    } else setToast(r.errors.join(' '));
  };

  const hovered = hover ? contours.find((c) => c.id === hover) : undefined;
  const u = view.w / 100;

  return (
    <div className="fe">
      <main className="fe-canvas">
        <div className="toolbar">
          <button className="icon-btn" onClick={() => go('#/config')} title="Voltar às configurações" aria-label="Voltar"><ArrowLeft size={18} /></button>
          <div>
            <p className="eyebrow">Molduras do enfeite</p>
            <strong>{editing ? `Editar: ${editing.name}` : 'Preparar nova moldura'}</strong>
          </div>
          <div className="toolbar-right">
            <button className="btn btn-dark btn-sm" onClick={() => fileRef.current?.click()}><FileUp size={16} /> Carregar SVG ou DXF</button>
            <input ref={fileRef} type="file" accept=".svg,.dxf,image/svg+xml" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) openFile(f); e.target.value = ''; }} />
          </div>
        </div>

        {!contours.length ? (
          <div
            className="dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) openFile(f); }}
          >
            <FileUp size={40} />
            <h2>Carregue o desenho da moldura</h2>
            <p className="muted">Arraste um arquivo SVG ou DXF para cá, ou</p>
            <button className="btn btn-primary btn-lg" onClick={() => fileRef.current?.click()}>Escolher arquivo</button>
            {loadError && <p className="notice error">{loadError}</p>}
          </div>
        ) : (
          <div className="preview fe-view" ref={wrap}>
            <svg
              ref={svg}
              className="preview-svg fe-svg"
              viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
              preserveAspectRatio="xMidYMid meet"
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerLeave={() => { drag.current = null; setBox(null); }}
            >
              <rect x={view.x} y={view.y} width={view.w} height={view.h} fill="#fff" />
              {janelaHull && <path d={janelaHull} fill="rgba(0,163,196,.14)" stroke="#00A3C4" strokeWidth={2} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" pointerEvents="none" />}
              {drawn.map(({ c, d, d2 }) => {
                const role = roles[c.id];
                const sel = selected.has(c.id);
                const hov = hover === c.id;
                const color = role ? ROLE_BY_ID[role].color : '#9A9A9A';
                const fill = sel ? 'rgba(255,106,0,.14)' : role === 'gravacao' ? 'rgba(139,90,43,.35)' : role === 'janela' && (counts.janela ?? 0) === 1 ? 'rgba(0,163,196,.14)' : 'none';
                const path = c.closed ? d : d2;
                return (
                  <g key={c.id}>
                    <path d={path} fill={c.closed ? fill : 'none'} fillRule="evenodd" stroke={hov ? '#FF6A00' : sel ? '#E05A00' : color} strokeWidth={hov ? 3.5 : sel ? 2.8 : role ? 1.8 : 1.2} strokeDasharray={!c.closed ? '3 3' : role === 'apagar' ? '2 3' : undefined} vectorEffect="non-scaling-stroke" pointerEvents="none" />
                    <path
                      d={path}
                      data-hit="1"
                      fill="none"
                      stroke="transparent"
                      strokeWidth={12}
                      vectorEffect="non-scaling-stroke"
                      pointerEvents="stroke"
                      style={{ cursor: 'pointer' }}
                      onPointerEnter={(e) => { setHover(c.id); setTip({ x: e.clientX, y: e.clientY }); }}
                      onPointerMove={(e) => setTip({ x: e.clientX, y: e.clientY })}
                      onPointerLeave={() => { setHover((h) => (h === c.id ? null : h)); setTip(null); }}
                      onClick={(e) => clickContour(e, c.id)}
                    />
                  </g>
                );
              })}
              {box && <rect x={Math.min(box.a.x, box.b.x)} y={Math.min(box.a.y, box.b.y)} width={Math.abs(box.a.x - box.b.x)} height={Math.abs(box.a.y - box.b.y)} fill="rgba(255,106,0,.08)" stroke="#FF6A00" strokeDasharray="4 3" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
              <text x={all.x} y={all.y + all.h + u * 4} fontSize={u * 2.4} fill="#6b6b6b" fontFamily="Montserrat">{all.w.toFixed(1)} × {all.h.toFixed(1)} mm</text>
            </svg>
            {hovered && tip && (
              <div className="fe-tip" style={{ left: tip.x + 14, top: tip.y + 14 }}>
                <strong>{hovered.label}</strong>
                <span>{roles[hovered.id] ? ROLE_BY_ID[roles[hovered.id]!].label : hovered.closed ? 'Sem função' : 'Linha aberta'}</span>
              </div>
            )}
            <div className="preview-tools">
              <button className="icon-btn" onClick={() => zoom(1 / 1.25)} aria-label="Aproximar"><Plus size={16} /></button>
              <button className="icon-btn" onClick={() => zoom(1.25)} aria-label="Afastar"><Minus size={16} /></button>
              <button className="icon-btn" onClick={fit} aria-label="Ajustar à tela"><Maximize size={16} /></button>
            </div>
            <div className="preview-hint">Clique numa linha para selecionar · Shift/Ctrl+clique soma · Shift+arrastar seleciona por área · arraste para mover · role para aproximar</div>
          </div>
        )}
        {toast && <div className="toast" role="status">{toast}</div>}
      </main>

      <aside className="fe-panel">
        {contours.length > 0 && (
          <>
            <section className="card">
              <h3 className="card-title">Arquivo</h3>
              <p className="small"><strong>{fileName}</strong></p>
              <p className="muted small">{contours.length} linhas{openCount ? ` · ${openCount} abertas (tracejadas, não usadas)` : ''}</p>
              {importWarnings.map((w) => <p key={w} className="help">{w}</p>)}
              {loadError && <p className="notice error">{loadError}</p>}
              <button className="btn btn-ghost btn-sm fe-auto" onClick={() => setRolesWithHistory(autoAssign(contours))}><Wand2 size={15} /> Detectar automaticamente</button>
            </section>

            <section className="card">
              <div className="section-head tight">
                <h3 className="card-title">Função das linhas</h3>
                <button className="icon-btn" onClick={undo} title="Desfazer (Ctrl+Z)" aria-label="Desfazer"><Undo2 size={15} /></button>
              </div>
              <p className="small">{selected.size ? <><strong>{selected.size}</strong> linha(s) selecionada(s)</> : <span className="muted">Passe o mouse e clique nas linhas do desenho.</span>}</p>
              <div className="role-grid">
                {ROLES.map((r) => (
                  <button key={r.id} className="role-btn" disabled={!selected.size} onClick={() => assign(r.id)} title={`${r.help} (tecla ${r.key})`}>
                    <i style={{ background: r.color }} />
                    <span>{r.label}</span>
                    <kbd>{r.key}</kbd>
                    <em>{counts[r.id] ?? 0}</em>
                  </button>
                ))}
                <button className="role-btn" disabled={!selected.size} onClick={() => assign(undefined)} title="Remover a função (tecla U)">
                  <i style={{ background: '#fff', border: '1px solid #bbb' }} />
                  <span>Sem função</span>
                  <kbd>U</kbd>
                  <em>{counts.none ?? 0}</em>
                </button>
              </div>
              <p className="help">Janela: selecione a linha da faixa do nome. Se forem várias (ex.: letras antigas), o app usa a envoltória delas.</p>
              <button className="link-btn" onClick={() => setShowList(!showList)}>{showList ? 'Ocultar lista de linhas' : 'Ver lista de linhas'}</button>
              {showList && (
                <ul className="fe-list">
                  {contours.map((c) => (
                    <li key={c.id}>
                      <button
                        className={selected.has(c.id) ? 'active' : ''}
                        onMouseEnter={() => setHover(c.id)}
                        onMouseLeave={() => setHover(null)}
                        onClick={(e) => clickContour(e, c.id)}
                      >
                        <i style={{ background: roles[c.id] ? ROLE_BY_ID[roles[c.id]!].color : 'transparent' }} />
                        <span>{c.label}</span>
                        <small>{roles[c.id] ? ROLE_BY_ID[roles[c.id]!].label : c.closed ? '—' : 'aberta'}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card">
              <h3 className="card-title">Verificação</h3>
              <ul className="checklist">
                <li className={(counts.contorno ?? 0) > 0 ? 'ok' : 'bad'}>{(counts.contorno ?? 0) > 0 ? <CheckCircle2 size={15} /> : <XCircle size={15} />} Contorno</li>
                <li className={(counts.janela ?? 0) > 0 ? 'ok' : 'bad'}>{(counts.janela ?? 0) > 0 ? <CheckCircle2 size={15} /> : <XCircle size={15} />} Janela {(counts.janela ?? 0) > 1 ? `(envoltória de ${counts.janela} linhas)` : ''}</li>
                <li className={(counts.furo ?? 0) > 0 ? 'ok' : 'opt'}>{(counts.furo ?? 0) > 0 ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />} Furo {(counts.furo ?? 0) ? '' : '(opcional)'}</li>
                {(counts.none ?? 0) > 0 && <li className="opt"><AlertTriangle size={15} /> {counts.none} linha(s) sem função serão ignoradas</li>}
              </ul>
              {built?.errors.filter((e) => !/Marque/.test(e)).map((e) => <p key={e} className="notice error">{e}</p>)}
              {built?.warnings.map((w) => <p key={w} className="notice warn">{w}</p>)}
            </section>

            <section className="card">
              <h3 className="card-title"><Sparkles size={13} /> Teste com um nome</h3>
              <div className="fe-test-row">
                <input className="input" value={testName} onChange={(e) => setTestName(e.target.value)} aria-label="Nome de teste" />
                <select className="input" value={testFont} onChange={(e) => setTestFont(e.target.value)} aria-label="Fonte de teste">
                  {ctx.fonts.list().map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </div>
              <div className="fe-result">
                {test?.result.parts.length ? (
                  <ShapeThumb shape={test.result.parts[0].solid} engrave={test.result.parts[0].engrave} fill={settings.materials[0].cor} engraveFill={settings.materials[0].corGravacao} />
                ) : (
                  <p className="muted small">Marque contorno e janela para ver o resultado.</p>
                )}
              </div>
              {test && (test.issues.length === 0 ? (
                <p className="status ok"><CheckCircle2 size={16} /> Peça única, pronta para corte</p>
              ) : (
                <ul className="issues">
                  {test.issues.map((i, k) => (
                    <li key={k} className={`issue issue-${i.level}`}><button disabled>{i.level === 'error' ? <XCircle size={15} /> : <AlertTriangle size={15} />}<span>{i.message}</span></button></li>
                  ))}
                </ul>
              ))}
            </section>

            <section className="card">
              <h3 className="card-title">Salvar</h3>
              <label className="field">
                <span className="field-label">Nome da moldura</span>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Bola com azevinho" />
              </label>
              <button className="btn btn-primary btn-block fe-save" disabled={!canSave} onClick={doSave}><Save size={17} /> {savedId ? 'Salvar alterações' : 'Salvar moldura'}</button>
              <div className="row-gap fe-after">
                <button className="btn btn-ghost btn-sm" disabled={!built?.svg || !!built?.errors.length} onClick={() => built?.svg && downloadBlob(new Blob([built.svg], { type: 'image/svg+xml' }), `${slug(name || 'moldura')}.svg`)}><Download size={15} /> Baixar SVG preparado</button>
                {savedId && <button className="btn btn-dark btn-sm" onClick={() => go(`#/estudio/enfeite-natal?moldura=${savedId}`)}>Usar no Enfeite</button>}
              </div>
              <p className="help">A moldura fica salva neste navegador. O SVG preparado pode ir para a pasta <code>src/models/enfeite-natal/molduras/</code> para virar moldura fixa do app.</p>
            </section>
          </>
        )}
        {!contours.length && (
          <section className="card">
            <h3 className="card-title">Como funciona</h3>
            <ol className="steps">
              <li>Carregue o desenho (SVG ou DXF), por exemplo um enfeite já pronto com um nome.</li>
              <li>Passe o mouse nas linhas: a linha fica laranja. Clique para selecionar.</li>
              <li>Escolha a função: <b>Contorno</b>, <b>Janela</b>, <b>Furo</b>, <b>Recortes</b>, <b>Gravação</b> ou <b>Apagar</b>.</li>
              <li>Teste com um nome e salve.</li>
            </ol>
          </section>
        )}
      </aside>
    </div>
  );
}
