// Integração com o claude.ai quando o app roda publicado como Artifact:
// - downloads: o visualizador só salva arquivos pelo capability "downloads";
// - db: guarda configurações, projetos e molduras de cada pessoa, para abrir em qualquer aparelho.
// Rodando localmente (npm run dev), window.claude não existe e tudo cai no navegador.

import JSZip from 'jszip';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    claude?: { use(name: string): Promise<any> };
  }
}

/** Extensões que o visualizador do claude.ai aceita salvar diretamente. */
const ALLOWED = new Set(['gif', 'png', 'jpg', 'jpeg', 'webp', 'txt', 'json', 'md', 'csv', 'html', 'svg', 'pdf', 'zip']);

let downloads: any = null;
let db: any = null;
let uid: string | null = null;
let ready: Promise<void> | null = null;

export function initCloud(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    const c = window.claude;
    if (!c?.use) return;
    try {
      [downloads, db] = await Promise.all([c.use('downloads'), c.use('db')]);
      const user = await c.use('user');
      uid = user ? await user.id() : null;
      if (!uid) db = null;
    } catch {
      db = null;
    }
  })();
  return ready;
}

/** true quando o app está publicado no claude.ai (downloads passam pela confirmação do visualizador). */
export function isHosted(): boolean {
  return downloads !== null;
}

export function cloudEnabled(): boolean {
  return db !== null && uid !== null;
}

function anchorDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Entrega um arquivo ao usuário. No app online, formatos que o visualizador não aceita
 * (DXF, STL) vão dentro de um .zip com o mesmo nome.
 * Resolve com uma mensagem para mostrar, ou null.
 */
export async function deliverFile(blob: Blob, filename: string): Promise<string | null> {
  await initCloud();
  if (!downloads) {
    anchorDownload(blob, filename);
    return null;
  }
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  let data: Blob = blob;
  let name = filename;
  let note: string | null = null;
  if (!ALLOWED.has(ext)) {
    const zip = new JSZip();
    zip.file(filename, blob);
    data = await zip.generateAsync({ type: 'blob' });
    name = `${filename}.zip`;
    note = `O ${ext.toUpperCase()} foi entregue dentro de um .zip (o claude.ai não baixa .${ext} direto). Descompacte para usar.`;
  }
  try {
    await downloads.save({ filename: name, data });
    return note;
  } catch (e: any) {
    if (e?.code === 'declined') return null;
    if (e?.code === 'rate_limited') return 'Já existe um download aguardando confirmação.';
    return `Não foi possível baixar o arquivo (${e?.code ?? 'erro'}).`;
  }
}

// ---------- Dados na nuvem (por pessoa) ----------

const col = () => `data/users/${uid}`;
const docPath = (key: string) => `${col()}/${key.replace(/[^A-Za-z0-9_\-.~:@+]/g, '_')}`;
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const chain = new Map<string, Promise<unknown>>();

function serial(path: string, op: () => Promise<unknown>) {
  const prev = chain.get(path) ?? Promise.resolve();
  const next = prev.then(op, op).catch(() => undefined);
  chain.set(path, next);
  return next;
}

/** Grava um valor (com espera curta para juntar várias alterações seguidas). */
export function cloudPut(key: string, value: unknown) {
  if (!cloudEnabled()) return;
  const path = docPath(key);
  clearTimeout(timers.get(path));
  timers.set(path, setTimeout(() => serial(path, () => db.doc(path).set({ kind: 'kv', key, value: JSON.stringify(value) })), 600));
}

export interface CloudFrame {
  id: string;
  name: string;
  svg: string;
}

export function cloudPutFrame(f: CloudFrame) {
  if (!cloudEnabled()) return;
  const path = docPath(`frame_${f.id}`);
  serial(path, () => db.doc(path).set({ kind: 'frame', ...f }));
}

export function cloudDeleteFrame(id: string) {
  if (!cloudEnabled()) return;
  const path = docPath(`frame_${id}`);
  serial(path, () => db.doc(path).delete());
}

export interface CloudSnapshot {
  kv: Record<string, unknown>;
  frames: CloudFrame[];
}

/** Lê tudo o que esta pessoa guardou. null quando não há nuvem nesta visualização. */
export async function cloudLoad(): Promise<CloudSnapshot | null> {
  await initCloud();
  if (!cloudEnabled()) return null;
  try {
    const snap = await db.collection(col()).get();
    const out: CloudSnapshot = { kv: {}, frames: [] };
    for (const d of snap.docs) {
      const body = d.data() as Record<string, any> | undefined;
      if (!body) continue;
      if (body.kind === 'kv') {
        try {
          out.kv[body.key] = JSON.parse(body.value);
        } catch {
          /* ignora documento corrompido */
        }
      } else if (body.kind === 'frame' && typeof body.svg === 'string') {
        out.frames.push({ id: body.id, name: body.name, svg: body.svg });
      }
    }
    return out;
  } catch {
    return null;
  }
}
