# Como adicionar um novo modelo (gerador)

Um modelo é um arquivo TypeScript que declara **parâmetros** e uma função **`generate`**. A interface, a validação, a prévia, o orçamento, o lote e os exportadores DXF/SVG/PNG funcionam sozinhos para qualquer modelo que siga o contrato.

## 1. Crie a pasta

```
src/models/placa-porta/index.ts
```

## 2. Escreva a definição

```ts
import type { GeometryResult, ModelDefinition } from '../../core/types';
import { difference, translate } from '../../core/geometry/clip';
import { circle, roundedRect } from '../../core/geometry/path';
import { missingChars, textToShape } from '../../core/geometry/text';

export const placaPorta: ModelDefinition = {
  id: 'placa-porta',
  version: 1,
  name: 'Placa de porta',
  description: 'Placa retangular com nome gravado e dois furos.',
  category: 'placas',            // id de CATEGORIES em src/models/registry.ts
  tags: ['Texto', 'Gravação'],
  batchParam: 'titulo',          // habilita o lote (um título por linha)
  params: [
    { id: 'titulo', type: 'text', label: 'Título', group: 'Texto', default: 'Escritório', maxLength: 30 },
    { id: 'fonte', type: 'font', label: 'Fonte', group: 'Texto', default: 'montserrat' },
    { id: 'largura', type: 'number', label: 'Largura', group: 'Dimensões', default: 200, min: 80, max: 500, unit: 'mm' },
    { id: 'altura', type: 'number', label: 'Altura', group: 'Dimensões', default: 60, min: 30, max: 300, unit: 'mm' },
    { id: 'furos', type: 'boolean', label: 'Furos de fixação', group: 'Detalhes', default: true },
  ],
  visibleWhen: {},

  generate(p, ctx): GeometryResult {
    const w = Number(p.largura), h = Number(p.altura);
    const font = ctx.fonts.get(String(p.fonte))!;
    const issues = missingChars(font, String(p.titulo)).length
      ? [{ level: 'error' as const, code: 'MISSING_GLYPH', message: 'Caractere não suportado pela fonte.' }]
      : [];

    let solid = [roundedRect(0, 0, w, h, 6)];
    if (p.furos) solid = difference(solid, [circle(10, h / 2, 2.5), circle(w - 10, h / 2, 2.5)]);

    const t = textToShape({ font, text: String(p.titulo), capHeight: h * 0.4 });
    const engrave = translate(t.shape, (w - t.bounds.w) / 2 - t.bounds.x, h / 2 + h * 0.2);

    return { parts: [{ id: 'placa', name: 'Placa', solid, engrave, singlePiece: true }], issues };
  },
};
```

## 3. Registre

Em `src/models/registry.ts`:

```ts
import { placaPorta } from './placa-porta';
export const MODELS: ModelDefinition[] = [enfeiteNatal, chaveiroNome, placaPorta];
```

Pronto: o modelo aparece na Biblioteca com miniatura gerada automaticamente e no Estúdio com o painel de propriedades montado a partir dos parâmetros.

## 4. Teste

`npm test` roda automaticamente para todo modelo registrado: gera com os valores padrão, com o mínimo e o máximo de cada número, e confere que o SVG é sempre o mesmo para os mesmos parâmetros. Acrescente em `tests/models.test.ts` os testes específicos (ex.: "furo a 10 mm da borda").

## Regras do contrato

- **Unidade: milímetros. Eixo Y para baixo.** A posição final não importa: o exportador leva tudo para a origem.
- `solid` é a **região de material**. O contorno dela (externo e furos) vira a linha de CORTE.
- `engrave` são áreas preenchidas (GRAVACAO). `score` são contornos de MARCAÇÃO. `guides` aparecem só na prévia.
- `singlePiece: true` faz a validação exigir uma peça única (sem pedaços soltos).
- `generate` deve ser **pura e determinística**: sem `Math.random`, data, rede ou DOM.
- Devolva em `issues` os problemas que só o modelo conhece (ex.: furo perto da borda). Os globais (peça solta, ponte fina, detalhe pequeno, não cabe na máquina) já são verificados.

## Tipos de parâmetro

| type | Controle no painel | Campos |
|---|---|---|
| `text` | campo de texto | `maxLength`, `placeholder` |
| `number` | slider + número | `min`, `max`, `step`, `unit` |
| `boolean` | chave liga/desliga | — |
| `select` | lista, botões (`display: 'buttons'`) ou miniaturas (`display: 'tiles'`) | `options` fixas ou `source(ctx)` dinâmico |
| `font` | lista com prévia do texto em cada fonte | — |

`group` agrupa os campos em seções; `visibleWhen` esconde campos conforme outros valores.

## Ferramentas do motor (`src/core/geometry`)

| Função | Para quê |
|---|---|
| `textToShape` / `missingChars` | Texto → polígonos com altura de maiúscula exata, espaçamento e condensação |
| `union`, `difference`, `intersection` | Booleanas (Clipper, resolução de 1 µm) |
| `offset` | Borda ao redor, kerf, folgas |
| `fillHoles`, `fillSmallHoles` | Remover furos (base de chaveiro) ou bolsões minúsculos |
| `islands` | Separar peças independentes |
| `connectIslands` | Pontes automáticas para acentos e pingos |
| `circle`, `rect`, `roundedRect` | Formas básicas |
| `svgPathToCommands` + `flattenCommands` | Usar desenhos SVG próprios dentro de um modelo |

## Fontes novas
1. `npm i @fontsource/<nome-da-fonte>` (somente fontes com licença OFL).
2. Inclua a entrada em `FONT_CATALOG` (`src/core/fonts.ts`) e a URL em `src/ui/fontUrls.ts`.
3. `npm test` confere a fonte com o enfeite.
