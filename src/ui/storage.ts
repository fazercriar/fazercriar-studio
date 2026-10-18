// Persistência: navegador (sempre) + nuvem do claude.ai (quando o app está publicado).
// Tudo protegido contra armazenamento bloqueado ou corrompido.

import type { Params } from '../core/types';
import { cloudDeleteFrame, cloudPut, cloudPutFrame, deliverFile, type CloudFrame, type CloudSnapshot } from './cloud';

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* armazenamento indisponível: segue sem salvar */
  }
}

export function save(key: string, value: unknown): void {
  if (key === KEYS.userFrames) {
    const before = new Map(load<CloudFrame[]>(key, []).map((f) => [f.id, f]));
    const after = value as CloudFrame[];
    for (const f of after) {
      const old = before.get(f.id);
      if (!old || old.svg !== f.svg || old.name !== f.name) cloudPutFrame(f);
      before.delete(f.id);
    }
    for (const id of before.keys()) cloudDeleteFrame(id);
  } else {
    cloudPut(key, value);
  }
  writeLocal(key, value);
}

const SYNCED = ['settings', 'projects', 'favorites', 'recentModels'] as const;

/**
 * Junta o que veio da nuvem com o navegador: a nuvem vence; o que só existe
 * no navegador (primeiro uso online) é enviado para a nuvem.
 */
export function applyCloud(snap: CloudSnapshot): void {
  for (const k of SYNCED) {
    const key = KEYS[k];
    if (key in snap.kv) writeLocal(key, snap.kv[key]);
    else {
      const local = load<unknown>(key, null);
      if (local !== null) cloudPut(key, local);
    }
  }
  const cloudIds = new Set(snap.frames.map((f) => f.id));
  const localOnly = load<CloudFrame[]>(KEYS.userFrames, []).filter((f) => !cloudIds.has(f.id));
  localOnly.forEach(cloudPutFrame);
  writeLocal(KEYS.userFrames, [...snap.frames, ...localOnly]);
}

export const KEYS = {
  settings: 'fc.settings.v1',
  projects: 'fc.projects.v1',
  favorites: 'fc.favorites.v1',
  recentModels: 'fc.recentModels.v1',
  userFrames: 'fc.frames.v1',
};

export interface Project {
  id: string;
  name: string;
  modelId: string;
  modelVersion: number;
  materialId: string;
  params: Params;
  updatedAt: number;
}

export function listProjects(): Project[] {
  return load<Project[]>(KEYS.projects, []).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveProject(p: Project): void {
  const all = listProjects().filter((x) => x.id !== p.id);
  save(KEYS.projects, [p, ...all].slice(0, 100));
}

export function deleteProject(id: string): void {
  save(KEYS.projects, listProjects().filter((x) => x.id !== id));
}

export function getProject(id: string): Project | undefined {
  return listProjects().find((p) => p.id === id);
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function touchRecentModel(id: string): void {
  save(KEYS.recentModels, [id, ...load<string[]>(KEYS.recentModels, []).filter((m) => m !== id)].slice(0, 8));
}

/** Entrega um arquivo. Resolve com uma mensagem para mostrar ao usuário (ou null). */
export function downloadBlob(blob: Blob, filename: string): Promise<string | null> {
  return deliverFile(blob, filename);
}

export function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'arquivo';
}
