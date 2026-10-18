// Catálogo de fontes empacotadas no app (todas com licença SIL Open Font License).
// Para adicionar uma fonte: instale o pacote @fontsource, inclua aqui e em src/ui/fontUrls.ts.

import type { Font } from 'opentype.js';
import type { FontInfo, FontRegistry } from './types';

export interface FontEntry extends FontInfo {
  /** Caminho do arquivo dentro de node_modules. */
  file: string;
}

export const FONT_CATALOG: FontEntry[] = [
  { id: 'montserrat', label: 'Montserrat ExtraBold', file: '@fontsource/montserrat/files/montserrat-latin-800-normal.woff' },
  { id: 'lilita', label: 'Lilita One', file: '@fontsource/lilita-one/files/lilita-one-latin-400-normal.woff' },
  { id: 'anton', label: 'Anton', file: '@fontsource/anton/files/anton-latin-400-normal.woff' },
  { id: 'bebas', label: 'Bebas Neue', file: '@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff' },
  { id: 'baloo', label: 'Baloo 2 ExtraBold', file: '@fontsource/baloo-2/files/baloo-2-latin-800-normal.woff' },
  { id: 'fredoka', label: 'Fredoka Bold', file: '@fontsource/fredoka/files/fredoka-latin-700-normal.woff' },
  { id: 'righteous', label: 'Righteous', file: '@fontsource/righteous/files/righteous-latin-400-normal.woff' },
  { id: 'lobster', label: 'Lobster (cursiva)', file: '@fontsource/lobster/files/lobster-latin-400-normal.woff' },
  { id: 'pacifico', label: 'Pacifico (cursiva)', file: '@fontsource/pacifico/files/pacifico-latin-400-normal.woff' },
  { id: 'greatvibes', label: 'Great Vibes (cursiva fina)', file: '@fontsource/great-vibes/files/great-vibes-latin-400-normal.woff' },
];

export function createFontRegistry(fonts: Map<string, Font>): FontRegistry {
  const list = FONT_CATALOG.filter((f) => fonts.has(f.id)).map(({ id, label }) => ({ id, label }));
  return { list: () => list, get: (id) => fonts.get(id) };
}
