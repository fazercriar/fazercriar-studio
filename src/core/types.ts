// Contratos centrais do FazerCriar Studio.
// Unidade interna: milímetros. Eixo Y para baixo (mesma convenção do SVG).

import type { Font } from 'opentype.js';

export type Mm = number;

export interface Pt {
  x: number;
  y: number;
}

/** Polígono fechado (o último ponto liga ao primeiro implicitamente). */
export type Poly = Pt[];

/** Conjunto de polígonos. Contornos externos e furos seguem a orientação do Clipper. */
export type Shape = Poly[];

export interface Bounds {
  x: Mm;
  y: Mm;
  w: Mm;
  h: Mm;
}

/**
 * Uma peça física.
 * - `solid`: região de material. O contorno dela (externo + furos) é a linha de CORTE.
 * - `engrave`: regiões preenchidas por GRAVAÇÃO (modo Scan).
 * - `score`: contornos de MARCAÇÃO (linha de baixa potência).
 * - `guides`: apenas para a prévia; nunca exportado.
 */
export interface Part {
  id: string;
  name: string;
  solid: Shape;
  engrave?: Shape;
  score?: Shape;
  guides?: Shape;
  /** Quando true, a validação exige que `solid` seja uma única peça. */
  singlePiece: boolean;
  /**
   * No STL, empilha esta peça sobre a anterior (z = espessura), deslocada por (dx, dy).
   * Ex.: letras do chaveiro em duas camadas, que na chapa ficam ao lado da base.
   */
  stack3d?: { dx: number; dy: number };
}

export type IssueLevel = 'error' | 'warning' | 'info';

export interface Issue {
  level: IssueLevel;
  code: string;
  message: string;
  where?: Pt;
}

export interface GeometryResult {
  parts: Part[];
  issues: Issue[];
}

// ---------- Parâmetros ----------

export interface SelectOption {
  value: string;
  label: string;
  /** Miniatura opcional desenhada a partir de geometria real. */
  preview?: Shape;
}

interface ParamBase {
  id: string;
  label: string;
  group?: string;
  help?: string;
}

export type ParamDef =
  | (ParamBase & { type: 'text'; default: string; maxLength?: number; placeholder?: string })
  | (ParamBase & { type: 'number'; default: number; min: number; max: number; step?: number; unit?: string })
  | (ParamBase & { type: 'select'; default: string; options?: SelectOption[]; source?: (ctx: GenContext) => SelectOption[]; display?: 'list' | 'tiles' | 'buttons' })
  | (ParamBase & { type: 'boolean'; default: boolean })
  | (ParamBase & { type: 'font'; default: string });

export type ParamValue = string | number | boolean;
export type Params = Record<string, ParamValue>;

// ---------- Contexto de geração ----------

export interface FontInfo {
  id: string;
  label: string;
}

export interface FontRegistry {
  list(): FontInfo[];
  get(id: string): Font | undefined;
}

export interface FrameDef {
  id: string;
  name: string;
  /** Largura e altura nominais (unidades do viewBox). */
  w: number;
  h: number;
  contorno: Shape;
  janela: Shape;
  gravacao: Shape;
  recortes: Shape;
  furo: Shape;
  builtIn: boolean;
}

export interface FrameRegistry {
  list(): FrameDef[];
  get(id: string): FrameDef | undefined;
}

export interface GenContext {
  fonts: FontRegistry;
  frames: FrameRegistry;
}

// ---------- Modelo ----------

export interface ModelDefinition {
  id: string;
  /** Aumente quando a geometria gerada mudar. */
  version: number;
  name: string;
  description: string;
  category: string;
  tags?: string[];
  params: ParamDef[];
  /** Parâmetro de texto usado na produção em lote (um valor por linha). */
  batchParam?: string;
  visibleWhen?: Record<string, (p: Params) => boolean>;
  /** Função pura e determinística. */
  generate(p: Params, ctx: GenContext): GeometryResult;
}
