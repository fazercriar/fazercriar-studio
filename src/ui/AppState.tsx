// Estado global: configurações, fontes e molduras carregadas.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { parse, type Font } from 'opentype.js';
import type { FrameDef, GenContext } from '../core/types';
import { DEFAULT_SETTINGS, type Material, type Settings } from '../core/settings';
import { FONT_CATALOG, createFontRegistry } from '../core/fonts';
import { createFrameRegistry, parseFrameSvg, type FrameParseResult } from '../core/frames';
import { loadBuiltInFrames } from '../models/enfeite-natal/frames';
import { FONT_URLS } from './fontUrls';
import { KEYS, applyCloud, load, save, slug } from './storage';
import { cloudLoad } from './cloud';

export interface UserFrame {
  id: string;
  name: string;
  svg: string;
}

export type SyncState = 'loading' | 'local' | 'cloud';

interface AppState {
  /** 'cloud' = dados sincronizados com a conta do claude.ai; 'local' = só neste navegador. */
  sync: SyncState;
  /** Muda quando dados chegam da nuvem: telas que leem projetos/favoritos usam como dependência. */
  syncVersion: number;
  ready: boolean;
  loadError: string | null;
  ctx: GenContext;
  settings: Settings;
  setSettings: (s: Settings) => void;
  resetSettings: () => void;
  material: (id: string | undefined) => Material;
  userFrames: UserFrame[];
  frameErrors: string[];
  /** Cria (sem id) ou atualiza (com id) uma moldura do usuário. */
  saveUserFrame: (svg: string, name: string, id?: string) => FrameParseResult & { id?: string };
  removeUserFrame: (id: string) => void;
}

const Ctx = createContext<AppState | null>(null);

function loadSettings(): Settings {
  const s = load<Partial<Settings>>(KEYS.settings, {});
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    machine: { ...DEFAULT_SETTINGS.machine, ...s.machine },
    pricing: { ...DEFAULT_SETTINGS.pricing, ...s.pricing },
    colors: { ...DEFAULT_SETTINGS.colors, ...s.colors },
    materials: s.materials?.length ? s.materials : DEFAULT_SETTINGS.materials,
  };
}

const builtIn = loadBuiltInFrames();

function parseUserFrames(list: UserFrame[]): { frames: FrameDef[]; errors: string[] } {
  const frames: FrameDef[] = [];
  const errors: string[] = [];
  for (const u of list) {
    const r = parseFrameSvg(u.svg, u.id, false);
    if (r.frame) frames.push({ ...r.frame, name: u.name });
    else errors.push(`${u.name}: ${r.errors.join(' ')}`);
  }
  return { frames, errors };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [fonts, setFonts] = useState<Map<string, Font> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [settings, setSettingsState] = useState<Settings>(loadSettings);
  const [userFrames, setUserFrames] = useState<UserFrame[]>(() => load<UserFrame[]>(KEYS.userFrames, []));

  const [sync, setSync] = useState<SyncState>('loading');
  const [syncVersion, setSyncVersion] = useState(0);

  // App publicado no claude.ai: busca configurações, projetos e molduras guardados na nuvem.
  useEffect(() => {
    let alive = true;
    cloudLoad().then((snap) => {
      if (!alive) return;
      if (!snap) return setSync('local');
      applyCloud(snap);
      setSettingsState(loadSettings());
      setUserFrames(load<UserFrame[]>(KEYS.userFrames, []));
      setSyncVersion((v) => v + 1);
      setSync('cloud');
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const map = new Map<string, Font>();
        await Promise.all(
          FONT_CATALOG.map(async (f) => {
            const url = FONT_URLS[f.id];
            const buf = await (await fetch(url)).arrayBuffer();
            map.set(f.id, parse(buf));
            // Também registra a fonte para mostrar o nome dela na própria letra.
            try {
              const face = new FontFace(`fc-${f.id}`, `url(${url})`);
              document.fonts.add(await face.load());
            } catch {
              /* apenas visual */
            }
          }),
        );
        if (alive) setFonts(map);
      } catch (e) {
        if (alive) setLoadError(`Não foi possível carregar as fontes: ${(e as Error).message}`);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const parsedUser = useMemo(() => parseUserFrames(userFrames), [userFrames]);

  const ctx = useMemo<GenContext>(
    () => ({
      fonts: createFontRegistry(fonts ?? new Map()),
      frames: createFrameRegistry([...builtIn.frames, ...parsedUser.frames]),
    }),
    [fonts, parsedUser],
  );

  const setSettings = useCallback((s: Settings) => {
    setSettingsState(s);
    save(KEYS.settings, s);
  }, []);

  const resetSettings = useCallback(() => setSettings(DEFAULT_SETTINGS), [setSettings]);

  const material = useCallback(
    (id: string | undefined) => settings.materials.find((m) => m.id === id) ?? settings.materials[0],
    [settings.materials],
  );

  const saveUserFrame = useCallback(
    (svg: string, name: string, existingId?: string): FrameParseResult & { id?: string } => {
      let id = existingId;
      if (!id) {
        const base = 'usuario-' + slug(name);
        id = base;
        for (let i = 2; [...builtIn.frames, ...parsedUser.frames].some((f) => f.id === id); i++) id = `${base}-${i}`;
      }
      const r = parseFrameSvg(svg, id, false);
      if (r.frame) {
        const entry = { id, name, svg };
        const next = existingId ? userFrames.map((f) => (f.id === existingId ? entry : f)) : [...userFrames, entry];
        setUserFrames(next);
        save(KEYS.userFrames, next);
      }
      return { ...r, id };
    },
    [userFrames, parsedUser],
  );

  const removeUserFrame = useCallback(
    (id: string) => {
      const next = userFrames.filter((f) => f.id !== id);
      setUserFrames(next);
      save(KEYS.userFrames, next);
    },
    [userFrames],
  );

  const value: AppState = {
    sync,
    syncVersion,
    ready: fonts !== null,
    loadError,
    ctx,
    settings,
    setSettings,
    resetSettings,
    material,
    userFrames,
    frameErrors: [...builtIn.errors, ...parsedUser.errors],
    saveUserFrame,
    removeUserFrame,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp fora do AppProvider');
  return v;
}
