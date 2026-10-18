// Registro de modelos e categorias.
// Para adicionar um modelo: crie a pasta em src/models/<id>/ e inclua-o em MODELS.

import type { ModelDefinition } from '../core/types';
import { enfeiteNatal } from './enfeite-natal';
import { chaveiroNome } from './chaveiro-nome';

export interface Category {
  id: string;
  name: string;
}

export const CATEGORIES: Category[] = [
  { id: 'identificacao', name: 'Identificação e nomes' },
  { id: 'chaveiros', name: 'Chaveiros e etiquetas' },
  { id: 'placas', name: 'Placas e sinalização' },
  { id: 'brindes', name: 'Brindes e lembrancinhas' },
  { id: 'decoracao', name: 'Decoração e datas' },
  { id: 'festas', name: 'Topos de bolo e festas' },
  { id: 'organizadores', name: 'Organizadores' },
  { id: 'experimentais', name: 'Experimentais' },
];

export const MODELS: ModelDefinition[] = [enfeiteNatal, chaveiroNome];

export function getModel(id: string): ModelDefinition | undefined {
  return MODELS.find((m) => m.id === id);
}

export function categoryName(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.name ?? id;
}
