# FazerCriar Studio — PRD (Product Requirements Document)

> **Ideias ganham forma.**
> Versão 1.1 · 18/10/2026 · Status: rascunho para validação
> Tipo: aplicação web de fabricação digital paramétrica · Idioma: pt-BR · Unidade interna: mm

---

## 0. Resumo executivo

O FazerCriar Studio é uma aplicação web em que o operador escolhe um **modelo de produto** (chaveiro, placa, topper, enfeite…), personaliza os **parâmetros** (nome, fonte, medidas, furos, material), vê uma **prévia fiel** e baixa um **SVG em escala 1:1 pronto para o laser**.

A decisão central do projeto: **um motor, vários produtos**. A interface, a validação e a exportação são genéricas. Cada produto é apenas um **gerador** que segue um contrato comum. Adicionar um produto novo não exige mexer na interface nem no exportador.

---

## 1. Engenharia reversa funcional da referência

Referência analisada: *Christmas Name Ornament Generator* (Vector Painter), em 18/10/2026. A análise reproduz apenas comportamentos observáveis. Nenhum código, desenho ou ativo da referência será copiado.

### 1.1 O que a ferramenta faz (observado)

| Bloco | Comportamento observado |
|---|---|
| **Escolha do desenho** | Grade com 10 molduras decorativas (botões de seleção com miniatura). |
| **Texto** | Um campo "Nome ou texto". Aceita letras, números e alguns símbolos. Letras e números têm **altura constante**; símbolos mantêm a proporção natural e recebem um pequeno suporte; textos longos são **estreitados** para caber. |
| **Fonte** | 9 fontes (Impact, Montserrat ExtraBold, Holtwood One SC, Rye, Germania One, Courgette, Sancreek, Oleo Script, Caveat Brush). Quase todas são grossas: fontes finas quebram no corte. |
| **Conexão** | O texto é convertido em curvas e **unido automaticamente** às duas laterais da abertura do enfeite, formando uma peça única. |
| **Tamanho** | Unidade mm/polegada; slider + campo numérico; largura de 50 a 500 mm; a altura acompanha proporcionalmente (ex.: 75,0 × 93,9 mm). |
| **Espessura** | Lista de 1,5 a 12 mm. Afeta **somente** a prévia 3D e o STL; SVG/DXF continuam 2D. |
| **Material da prévia** | Compensado bétula, cerejeira, MDF e acrílico (35 cores). Apenas visual. |
| **Prévia** | Canvas WebGL (Three.js) com rotação/zoom/pan, vista frontal, reset, modo dia/noite e indicador "Atualizando…". |
| **Exportação** | Botões SVG, DXF e STL. **Os arquivos são gerados no servidor**, não no navegador. |
| **Barreira de download** | Ao exportar, pede login/cadastro (conta de cliente Shopify) — funciona como captação de leads. |
| **Conteúdo de apoio** | Painel "Sobre e instruções" com passo a passo, FAQ, dicas de material/software e **licença de uso** (pode vender o produto físico, não pode redistribuir o arquivo). |

### 1.2 Arquitetura inferida

```
[Painel de parâmetros] → (debounce) → [Gerador de geometria] → [Prévia 3D WebGL]
                                                         ↘
                                    [Login] → [Servidor gera SVG/DXF/STL] → download
```

### 1.3 O que aproveitar, o que melhorar

| Referência | FazerCriar Studio |
|---|---|
| 1 produto por página/app | **Biblioteca de modelos** num único app, com contrato comum |
| Prévia 3D bonita, sem cotas | **Prévia 2D técnica primeiro** (cotas, cores de operação, avisos); 3D depois |
| Só corte | **Corte + gravação + marcação** separados por camada/cor |
| Sem validação visível | **Painel de validação** (peças soltas, detalhes frágeis, furo perto da borda) |
| Um item por vez | **Produção em lote** (lista de nomes → ZIP ou chapa) |
| Geração no servidor + login | **Geração 100% no navegador**, sem login no MVP (uso interno) |
| Sem compensação de corte | **Kerf** e perfis de material (ver Ideias) |

---

## 2. Problema, público e metas

**Problema.** Cada pedido personalizado ("o mesmo chaveiro, mas com o nome Cecília e 70 mm") hoje exige abrir um software vetorial, editar texto, unir letras, conferir pontes e exportar. É trabalho repetitivo e sujeito a erro.

**Público inicial.** Operador e desenvolvedor de produtos da FazerCriar (uso interno). Futuro possível: clientes finais ou outros fabricantes.

**Metas / indicadores de sucesso**

| # | Meta | Medida |
|---|---|---|
| M1 | Personalizar um modelo conhecido rapidamente | < 2 min do clique em "Personalizar" ao SVG baixado |
| M2 | Arquivo com medida real | Erro dimensional ≤ 0,01 mm no SVG (teste automatizado) |
| M3 | Trocar o nome sem redesenhar | 100% dos modelos com texto |
| M4 | Novo modelo sem tocar no núcleo | Novo gerador = 1 pasta nova + 1 linha de registro |
| M5 | Bloquear erros antes do corte | Peças soltas e geometria inválida bloqueiam a exportação |
| M6 | Compatibilidade real | DXF abre no RDWorks/LaserCAD na escala correta e com camadas por cor (teste manual registrado) |

**Fora do escopo do MVP:** editor CAD completo, loja/pagamentos, autenticação, backend, controle direto da máquina, STL, nesting automático.

### 2.1 Decisões tomadas (18/10/2026)

| Tema | Decisão | Consequência |
|---|---|---|
| Software da máquina | **RDWorks / LaserCAD** (controladora Ruida, CO2) | **DXF entra no MVP** como formato principal; SVG continua disponível |
| Primeiros modelos | **Enfeite de Natal com nome + Chaveiro com nome** | O enfeite equivale à referência, mas com molduras próprias |
| Público | **Só a FazerCriar por agora** | Sem login e sem backend; site estático/PWA |
| Extras no MVP | **Mockup PNG, produção em lote, kerf e perfis de material, estimativa de tempo e preço** | Ver seções 8.2, 10, 11 e 12 |

---

## 3. Identidade visual aplicada à interface

### 3.1 Tokens de design

```css
:root {
  --fc-laranja:   #FF6A00;  /* ação principal, seleção ativa, foco */
  --fc-laranja-escuro: #E05A00; /* hover/pressed */
  --fc-grafite:   #1E1E1E;  /* cabeçalho, textos fortes, barra lateral */
  --fc-cinza:     #E5E5E5;  /* superfícies secundárias, divisórias */
  --fc-branco:    #FFFFFF;  /* área de trabalho, contraste */
  --fc-texto-sec: #6B6B6B;
  --fc-erro:      #D92D20;
  --fc-alerta:    #F5A300;
  --fc-ok:        #12A150;
  --fc-raio: 10px;
  --fc-fonte: 'Montserrat', system-ui, sans-serif;
}
```

- **Tipografia:** Montserrat — 700/800 para títulos (como "Da ideia ao produto."), 500 para rótulos, 400 para corpo. Rótulos de seção em caixa alta com espaçamento largo (eco de "IDEIAS GANHAM FORMA.").
- **Gradiente laranja** só no logotipo e no símbolo (lâmpada-C). A interface usa cores sólidas.
- **Ícones:** traço de linha laranja, como na faixa de serviços da marca (laser, impressão 3D, engrenagem, lápis, aperto de mãos). Biblioteca sugerida: Lucide.
- **Tema:** cabeçalho e painel lateral grafite; canvas branco/claro (o produto é o protagonista). Modo escuro opcional no canvas.
- **Separar cores de interface das cores operacionais.** O laranja da marca **nunca** é usado como cor de operação no SVG.

### 3.2 Cores operacionais (convenção, configurável)

| Operação | Camada DXF / cor ACI | Cor no SVG | Exibição na prévia |
|---|---|---|---|
| Corte | `CORTE` / 1 (vermelho) | `#FF0000` | Linha contínua vermelha, 0,1 mm |
| Gravação (preenchimento) | `GRAVACAO` / 7 (preto/branco) | `#000000` | Área preenchida cinza-escuro |
| Marcação / vinco | `MARCACAO` / 5 (azul) | `#0000FF` | Linha tracejada azul |
| Guia (não exportar) | — | — | Ciano tracejado, só na tela |

> No RDWorks/LaserCAD, cada cor importada vira uma camada na lista de camadas, à qual o operador associa um modo (Cut/Scan) com potência e velocidade. Ordem recomendada: gravação → marcação → furos internos → contorno externo. A convenção é configurável em "Configurações".

### 3.3 Logotipo

- Cabeçalho: logo horizontal branco sobre grafite.
- Favicon e ícone PWA: símbolo lâmpada-C sobre laranja.
- **Necessário:** arquivos do logotipo em **SVG** (versões clara, escura e símbolo).

---

## 4. Mapa de telas

```
01 Início ──→ 02 Biblioteca ──→ 03 Estúdio ──→ 05 Exportação
                                   │
                                   └─→ 04 Lote
06 Configurações (materiais, cores de operação, chapa, kerf)
07 Administração de modelos (Fase 3)
```

### 4.1 Início
- Logo, chamada "Da ideia ao produto." e botão laranja **Criar novo produto**.
- Recentes (últimos 6 projetos salvos localmente), favoritos e atalho para a biblioteca.

### 4.2 Biblioteca de modelos
- Cartões com miniatura **gerada pelo próprio gerador** com os valores padrão (sempre atualizada), nome, categoria, selos (ex.: "Texto", "Peça única", "Multicamada") e botão **Personalizar**.
- Busca por nome; filtros por categoria, favoritos e recentes.
- Categorias vêm de um arquivo de configuração (sem alterar código de interface):
  Identificação e nomes · Chaveiros e etiquetas · Placas e sinalização · Brindes e lembrancinhas · Decoração e datas · Topos de bolo e festas · Organizadores · Experimentais.

### 4.3 Estúdio de criação (tela principal)

```
┌──────────────────────────────────────────────────────────────────────┐
│ [logo]  Chaveiro com nome              [Salvar] [Lote] [EXPORTAR DXF]│
├──────────────┬───────────────────────────────────────┬───────────────┤
│ PROPRIEDADES │                                       │ FABRICAÇÃO    │
│ ▸ Texto      │          (canvas 2D, mm)              │ 60,0 × 22,4mm │
│ ▸ Dimensões  │       régua · grade · cotas           │ 1 peça        │
│ ▸ Formato    │                                       │ Corte: 182 mm │
│ ▸ Detalhes   │                                       │ Gravação: —   │
│ ▸ Material   │                                       │ ⚠ 1 aviso     │
│              │ [−][+][Ajustar][Camadas][Operações]   │ ✓ Pronto      │
└──────────────┴───────────────────────────────────────┴───────────────┘
```

- **Painel de propriedades** gerado automaticamente a partir dos parâmetros do modelo, agrupados em seções recolhíveis. Botão "Restaurar padrão".
- **Canvas:** zoom, pan, ajustar à tela, régua em mm, cotas de largura/altura, alternância "produto" ↔ "operações", mostrar/ocultar camadas, contorno da chapa quando configurada.
- **Resumo de fabricação:** dimensões, número de peças, comprimento de corte, área de gravação, lista de avisos/erros clicáveis (clicar destaca o problema no canvas).
- Atualização automática com *debounce* de ~150 ms; geração pesada em **Web Worker** para não travar a digitação.
- Desfazer/refazer (Ctrl+Z / Ctrl+Y) sobre os parâmetros.
- Tablet: painéis viram gavetas; o canvas ocupa a tela.

### 4.4 Lote
- Área de texto "um nome por linha" (ou colar uma coluna de planilha/CSV).
- Tabela de pré-visualização com status por item (✓ / ⚠ / ✕) e motivo.
- Saída: **ZIP com um SVG por item** ou **um SVG de chapa** com os itens em grade (sem nesting no MVP), com espaçamento configurável.

### 4.5 Exportação
- Resumo final: dimensões, camadas incluídas, avisos aceitos.
- Formato: **DXF (padrão, RDWorks/LaserCAD)**, SVG ou PNG de mockup.
- Opções: incluir/excluir camadas, aplicar kerf do material e nome do arquivo (padrão: `modelo_nome_60x22mm.dxf`).
- O botão fica **bloqueado** enquanto houver erro; avisos exigem confirmação.

### 4.6 Configurações
- Materiais (nome, espessura, kerf, largura mínima de ponte, tamanho mínimo de detalhe).
- Cores das operações.
- Tamanho da chapa/área útil da máquina.
- Unidade de exibição (mm/pol).

---

## 5. Sistema paramétrico (núcleo do projeto)

### 5.1 Separação em três camadas

1. **Motor** — texto→curvas, booleanas, offset, validação, renderização, exportação.
2. **Definição do modelo** — parâmetros, padrões, limites, regras e função `generate`.
3. **Interface genérica** — lê a definição e monta os controles.

### 5.2 Contrato do gerador (TypeScript)

```ts
type Mm = number;

type ParamDef =
  | { id: string; type: 'text';    label: string; default: string; maxLength?: number; multiline?: boolean; group?: string }
  | { id: string; type: 'number';  label: string; default: number; min: number; max: number; step?: number; unit?: 'mm' | '°' | '%'; group?: string }
  | { id: string; type: 'select';  label: string; default: string; options: { value: string; label: string; thumb?: string }[]; group?: string }
  | { id: string; type: 'boolean'; label: string; default: boolean; group?: string }
  | { id: string; type: 'font';    label: string; default: string; allowed?: string[]; group?: string }
  | { id: string; type: 'material';label: string; default: string; group?: string };

interface ModelDefinition<P> {
  id: string;                 // 'chaveiro-nome'
  version: number;            // muda quando a geometria muda
  name: string;
  category: string;
  tags?: string[];
  params: ParamDef[];
  visibleWhen?: Record<string, (p: P) => boolean>;   // ex.: diâmetro só se "furo" ativo
  generate(p: P, ctx: GenContext): GeometryResult;   // pura e determinística
  validate?(p: P, g: GeometryResult, ctx: GenContext): Issue[]; // regras próprias, além das globais
}

interface GenContext {
  fonts: FontRegistry;        // fontes já carregadas (opentype.js)
  material: MaterialProfile;  // espessura, kerf, ponte mínima…
  geo: GeometryKit;           // texto→path, união, offset, formas básicas
}

type Operation = 'cut' | 'engrave' | 'score' | 'guide';

interface Part {
  id: string;
  name: string;               // 'Base', 'Letras'
  layers: { op: Operation; paths: Path2D_mm[] }[];
}

interface GeometryResult {
  parts: Part[];
  bounds: { x: Mm; y: Mm; w: Mm; h: Mm };
  metrics?: { cutLength: Mm; engraveArea: number };
  issues: Issue[];            // avisos do próprio gerador
}

interface Issue {
  level: 'error' | 'warning' | 'info';
  code: string;               // 'DISCONNECTED_PART', 'THIN_BRIDGE'…
  message: string;            // pt-BR, acionável
  where?: { x: Mm; y: Mm };   // para destacar no canvas
}
```

Regras do contrato:
- `generate` é **pura e determinística**: mesmos parâmetros → mesmo SVG, byte a byte (testável por *snapshot*).
- Geradores **não** acessam DOM, rede nem armazenamento.
- O campo `generator` de um JSON **nunca** é código executável: ele aponta para um gerador já registrado no código.
- A prévia e a exportação consomem **o mesmo `GeometryResult`**.

### 5.3 Registro de um modelo novo

```
src/models/
  chaveiro-nome/
    index.ts        ← ModelDefinition
    thumb.json      ← parâmetros da miniatura (opcional)
    chaveiro-nome.test.ts
  registry.ts       ← export const models = [chaveiroNome, placaPorta, …]
```

### 5.4 Regras geométricas declaráveis (kit do motor)

| Regra | Implementação no motor |
|---|---|
| Altura acompanha largura | `width` → escala uniforme do desenho base |
| Texto cabe na área | Ajuste automático de tamanho ou estreitamento, com **altura mínima legível** (aviso abaixo dela) |
| Peça única | União booleana de texto + base; após a união, contar ilhas externas → >1 = **erro** |
| Ponte mínima | Detecção de "pescoço" via offset negativo de `pontemin/2` e verificação se a peça se divide |
| Furo × borda | Distância mínima furo↔contorno externo configurável |
| Ilhas de letras (O, A, B) | Em texto **vazado**, os miolos caem: aviso ou **pontes de estêncil automáticas** |
| Elementos opcionais | Gerados somente se o parâmetro booleano estiver ativo |

---

## 6. Personalização — requisitos detalhados

### 6.1 Texto e tipografia
- Nomes, números, frases curtas e datas; suporte completo a acentos do português (á à â ã é ê í ó ô õ ú ç).
- **Fontes empacotadas no app** (sem internet), somente com licença que permite incorporar e converter em curvas (preferência por Google Fonts/OFL). Lista inicial sugerida, priorizando fontes grossas que cortam bem: Montserrat ExtraBold/Black, Anton, Bebas Neue, Pacifico, Lobster, Great Vibes (cursiva conectada, boa para nomes), Fredoka, Baloo 2, Righteous.
- Controles conforme o modelo: tamanho, espaçamento entre letras, alinhamento, **sobreposição das letras cursivas** (para unir).
- Caractere sem glifo na fonte → erro claro ("A fonte X não tem o caractere ‘ñ’").
- Texto convertido em curvas (opentype.js) **somente na geometria**. O projeto salvo guarda o texto editável.

### 6.2 Dimensões
- Unidade interna em mm; exibição em mm ou polegadas.
- Modelos declaram se a escala é proporcional ou com largura/altura independentes.
- Limites mín./máx. por modelo e por chapa configurada.
- Arredondamento só na exibição (2 casas); geometria em ponto flutuante, com tolerância de 0,001 mm.

### 6.3 Formas e elementos
Círculo, retângulo, retângulo arredondado, oval, cápsula, silhuetas SVG próprias, furos, contorno/borda (offset), ícones vetoriais, texto gravado ou vazado, repetição simples (linha/grade/radial).

---

## 7. Prévia

### 7.1 2D (MVP, obrigatória)
- Renderização SVG no navegador a partir do `GeometryResult` (mesma fonte da exportação).
- Modo **Produto** (simulação de material: MDF, acrílico, compensado, com gravação escurecida) e modo **Operações** (cores de corte/gravação/marcação).
- Cotas, régua, grade de 10 mm, centralizar e ajustar à tela.

### 7.2 3D (Fase 2)
- Three.js: extrusão das peças com a espessura do material; camadas empilhadas em multicamada; materiais MDF/acrílico/compensado; rotação/zoom.
- É uma **representação**, não uma simulação física do corte.

---

## 8. Exportação

### 8.1 SVG (MVP)
- Raiz: `<svg width="{w}mm" height="{h}mm" viewBox="0 0 {w} {h}">` → 1 unidade = 1 mm.
- Grupos por operação: `<g id="corte" inkscape:groupmode="layer" inkscape:label="Corte">` etc.
- Corte: `fill="none" stroke="#FF0000" stroke-width="0.1"`. Gravação: `fill="#000000" stroke="none"`.
- Sem `<text>`, sem fontes, sem imagens externas, sem scripts, sem cotas nem guias.
- Caminhos fechados (`Z`), sem duplicados, com precisão de 3 casas decimais.
- Metadados: modelo, versão, parâmetros e data em `<metadata>` (permite reabrir/reproduzir).
- **Validação pós-exportação:** reparsear o SVG gerado e conferir as dimensões e a quantidade de caminhos.

### 8.2 DXF para RDWorks/LaserCAD (MVP — formato principal)
- Exportador DXF **real** (escrito no projeto ou via `dxf-writer`), sem conversão a partir do SVG.
- Versão **AutoCAD R12 (AC1009)**, a mais aceita pelo RDWorks; unidade em mm (`$INSUNITS = 4`, mesmo que o R12 ignore, para outros softwares).
- Entidades: `POLYLINE` fechada (flag 1) com `VERTEX`; curvas Bézier achatadas em segmentos com tolerância de 0,02 mm (configurável); círculos de furo como `CIRCLE`.
- Uma camada por operação (`CORTE`, `GRAVACAO`, `MARCACAO`), com cor ACI por camada **e** por entidade (o RDWorks agrupa pela cor).
- Contornos de gravação sempre **fechados**, para o modo Scan preencher corretamente.
- Sem blocos, hachuras, textos nem cotas.
- Testes: reparse com um leitor DXF (`dxf-parser`) e conferência de bounds; teste manual de importação no RDWorks V8 e no LaserCAD, registrado em `docs/compatibilidade.md`.

### 8.3 PNG de mockup para aprovação (MVP)
- Imagem 1080 × 1080 (formato bom para o WhatsApp) da prévia "Produto", com a textura do material, a medida ("75 × 94 mm") e o logo FazerCriar no rodapé.
- Opcional: marca d'água "PRÉVIA" e o nome do cliente.
- Gerada no navegador (SVG → canvas → PNG). Nunca contém a geometria exportável em alta resolução.

### 8.4 STL (Fase 3)
- Somente para modelos com sólido válido (extrusão fechada), gerado a partir do mesmo `GeometryResult`.

### 8.5 Fluxo
```
Gerar → Validar (globais + do modelo) → Aplicar kerf → Montar DXF/SVG → Reparsear e conferir → Baixar
```

---

## 9. Validação

| Código | Verificação | Nível |
|---|---|---|
| `INVALID_GEOMETRY` | Caminho aberto, NaN ou autointerseção não resolvida | Erro |
| `DISCONNECTED_PART` | Peça marcada como "única" com mais de uma ilha | Erro |
| `MISSING_GLYPH` | Caractere sem glifo na fonte | Erro |
| `OUT_OF_SHEET` | Peça maior que a área útil configurada | Erro |
| `THIN_BRIDGE` | Ligação mais fina que a ponte mínima do material | Aviso |
| `SMALL_DETAIL` | Furo ou detalhe menor que o mínimo do material | Aviso |
| `HOLE_NEAR_EDGE` | Furo a menos de X mm da borda | Aviso |
| `TEXT_TOO_SMALL` | Altura das letras abaixo do mínimo legível | Aviso |
| `FALLING_ISLANDS` | Miolos de letras vazadas que vão cair | Aviso |
| `DUPLICATE_PATH` | Caminhos sobrepostos (corte duplo) | Aviso |

> Nenhum algoritmo garante que todo desenho é fabricável. O app separa **erros detectáveis** (bloqueiam) de **recomendações** (pedem teste físico).

---

## 10. Produção em lote
1. Entrada: um nome por linha (ou CSV).
2. Valida cada item e gera geometria independente.
3. Mostra itens com erro e o total de arquivos.
4. Exporta ZIP (JSZip) com um DXF/SVG por item **ou** um arquivo de chapa em grade, respeitando a área útil e o espaçamento configurados (abre outra chapa quando lotar).
5. Mostra a estimativa de tempo e preço do lote inteiro (seção 12).
6. Nesting otimizado (encaixe irregular) fica para fase posterior.

---

## 11. Perfis de material e kerf (MVP)

Cada material cadastrado em Configurações tem:

| Campo | Exemplo (MDF 3 mm) | Uso |
|---|---|---|
| Nome / espessura | MDF cru 3 mm | Seleção no Estúdio e na prévia |
| **Kerf** (largura do corte) | 0,15 mm | Offset de kerf/2 para fora nos contornos externos e para dentro nos furos |
| Ponte mínima | 1,5 mm | Validação `THIN_BRIDGE` |
| Menor detalhe | 1,0 mm | Validação `SMALL_DETAIL` |
| Velocidade/potência de corte | 15 mm/s · 60% | Estimativa de tempo; referência para o operador |
| Velocidade de gravação · intervalo de linha | 300 mm/s · 0,1 mm | Estimativa de tempo de Scan |
| Custo da chapa e tamanho | R$ 12 · 600 × 400 mm | Custo de material por área usada |
| Textura/cor da prévia | MDF | Prévia e mockup |

- A compensação de kerf é **opcional por exportação** (ligada por padrão nos modelos com encaixe; desligada nos demais, porque o RDWorks também pode compensar).
- O offset é aplicado sobre uma cópia da geometria, usando o Clipper2 com junções arredondadas.
- Valores iniciais vêm de um teste de corte (ver "Peça de calibração" na seção 23).

---

## 12. Estimativa de tempo e preço (MVP)

**Tempo estimado**
- Corte: Σ (comprimento de cada contorno ÷ velocidade de corte) + deslocamentos em vazio (distância entre contornos ÷ velocidade de deslocamento) + tempo fixo por perfuração.
- Gravação (Scan): (altura da área ÷ intervalo de linha) × (largura da área ÷ velocidade de gravação) + aceleração por linha (fator de correção configurável).
- Fator de calibração global (ex.: × 1,15), ajustado comparando com o tempo real mostrado pelo RDWorks.

**Preço sugerido**
```
custo = minutos × custo_minuto_máquina
      + área_bbox × custo_material_por_mm² × (1 + perda%)
      + custo_fixo_por_pedido
preço = custo × (1 + margem%)   → arredondado para R$ 0,50
```
- Painel "Orçamento" no Resumo de fabricação e no Lote, com detalhamento.
- Exibido como **estimativa**; o valor final é decisão do operador.

---

## 13. Modelo 1 — Enfeite de Natal com nome

Equivalente funcional à referência, **com molduras próprias da FazerCriar**.

- **Parâmetros:** moldura (lista com miniaturas), nome, fonte, largura (50–300 mm, altura proporcional), material, furo/argola (sim/não, diâmetro), espessura da borda.
- **Geometria:** a moldura tem uma "janela" onde o nome é encaixado. O texto é escalado para **altura constante** e estreitado (até um limite) se não couber na largura. Cada letra encosta nas laterais da janela e é unida à moldura por **união booleana**, formando uma peça única.
- **Molduras como dados:** cada moldura é um SVG próprio com regiões nomeadas (`contorno`, `janela`, `gravacao`, `furo`). Assim, novas molduras entram sem código novo — é o primeiro passo do editor de modelos.
- **Validação:** peça única, ponte mínima entre letras e moldura, furo × borda, glifo ausente.
- **Molduras iniciais:** 6 molduras paramétricas desenhadas para o projeto (bola clássica, estrela, sino, árvore, floco geométrico e coração), com possibilidade de importar molduras desenhadas pela FazerCriar.

## 14. Modelo 2 — Chaveiro com nome

- **Parâmetros:** nome, fonte, altura das letras, estilo da base (contorno do nome / cápsula / retângulo arredondado), espessura da borda (offset), posição da argola (esquerda/direita/topo), diâmetro do furo, gravar nome ou nome em relevo (2 camadas).
- **Geometria:** texto → curvas → união das letras → offset externo = base; furo posicionado com distância mínima da borda.
- **Por que prova a arquitetura:** a geometria é derivada do texto (não de uma moldura), com regras de furo e offset — formato bem diferente do enfeite usando o mesmo motor, a mesma interface e o mesmo exportador.

---

## 15. Arquitetura técnica

| Camada | Escolha | Por quê |
|---|---|---|
| App | **Vite + React + TypeScript** | Rápido, estático, sem backend |
| Estilo | CSS Modules ou Tailwind com os tokens da seção 3 | Identidade consistente |
| Estado | Zustand | Simples; desfazer/refazer sobre os parâmetros |
| Texto → curvas | **opentype.js** | Lê TTF/OTF/WOFF e gera caminhos dos glifos |
| Booleanas / offset | **Clipper2 (clipper2-js)** ou **paper.js** | União robusta (peça única), offset (borda, kerf, ponte mínima) |
| Formas paramétricas | **Maker.js** (avaliar num protótipo) | Primitivas e exportação SVG/DXF; não resolve sozinho união de letras nem validação |
| DXF | Exportador R12 próprio ou `dxf-writer` + `dxf-parser` nos testes | Formato principal para o RDWorks/LaserCAD |
| Lote | JSZip | ZIP com um arquivo por nome |
| Prévia 2D | SVG/React a partir do `GeometryResult` | Mesmo dado da exportação |
| Prévia 3D (F2) | Three.js | Extrusão e materiais |
| Worker | Web Worker (Comlink) | Geração sem travar a interface |
| Persistência | localStorage/IndexedDB + exportar/importar projeto `.fazercriar.json` | Sem servidor no MVP |
| Testes | **Vitest** (unidade, snapshot de SVG) + Playwright (fluxo principal) | Critério de conclusão |
| Distribuição | Site estático (Netlify/Vercel/GitHub Pages) + **PWA offline** | Funciona na oficina sem internet |

### Estrutura de pastas
```
src/
  core/        geometry/ (texto, booleanas, offset, formas), validate/, export/ (svg.ts, dxf.ts, png.ts), estimate/, kerf/, types.ts
  models/      registry.ts, enfeite-natal/ (molduras/*.svg), chaveiro-nome/, …
  ui/          components/, studio/, library/, batch/, settings/, theme.css
  worker/      generate.worker.ts
  assets/      fonts/ (com LICENSES.md), logo/
tests/         geometry/, export/, models/, e2e/
docs/          PRD.md, COMO-CRIAR-MODELO.md
```

---

## 16. Resumo dos modelos

| # | Modelo | Por que prova a arquitetura |
|---|---|---|
| 1 | **Enfeite de Natal com nome** (seção 13) — moldura como dado + nome unido à janela | Texto→curvas, união com moldura, altura constante, molduras sem código novo |
| 2 | **Chaveiro com nome** (seção 14) — base derivada do texto por offset + argola | Geometria derivada do texto, offset, regra de furo × borda |

Candidatos seguintes: placa retangular com furos, topo de bolo com nome cursivo + hastes, tag de lembrancinha, crachá/porta-nome de mesa (2 peças com encaixe), letreiro/nome de parede, caixa com encaixe *finger joint* (multipeça).

---

## 17. Requisitos não funcionais
- Regeneração < 200 ms para modelos simples em notebook comum.
- Lote de 100 nomes em < 15 s.
- Funciona offline após o primeiro acesso (PWA).
- Chrome, Edge e Firefox atuais; desktop ≥ 1280 px; tablet ≥ 768 px.
- Acessibilidade: navegação por teclado no painel, foco visível laranja e contraste AA.

## 18. Segurança, licenças e privacidade
- Somente desenhos próprios da FazerCriar ou com licença compatível; arquivo `assets/LICENSES.md` com a origem de cada fonte e ícone.
- SVG importado (fase futura) é sanitizado: sem `<script>`, `on*`, `<foreignObject>` nem referências externas.
- Definições de modelo nunca executam código vindo de dados.
- Projetos ficam no dispositivo; nada é enviado a servidores no MVP.

## 19. Testes (critério de conclusão)
- **Unidade:** texto→curvas (acentos), união resulta em 1 ilha, offset, furo × borda.
- **Exportação SVG:** `width`/`height` em mm iguais aos bounds (±0,01 mm); nenhum `<text>`; grupos por operação; reparse válido.
- **Exportação DXF:** reparse com `dxf-parser`; somente POLYLINE fechadas e CIRCLE; camadas/cores corretas; bounds iguais aos do SVG.
- **Kerf:** contorno externo cresce kerf/2 e furo diminui kerf/2 (±0,001 mm).
- **Estimativa:** caso de referência (retângulo 100 × 50 mm) com tempo calculado à mão.
- **Determinismo:** snapshot do SVG de cada modelo com parâmetros padrão.
- **Contrato:** todo modelo do registro gera sem erro com os padrões e com os limites mín./máx.
- **E2E:** abrir biblioteca → personalizar → exportar → arquivo baixado.
- **Manual (registrado):** importar o DXF no RDWorks V8 e no LaserCAD, conferir medida e camadas; um corte real por modelo.

## 20. Roadmap

| Fase | Entregas |
|---|---|
| **0 — Fundação** | Projeto, tokens visuais, contratos, motor (texto, união, offset), exportadores DXF e SVG, testes |
| **1 — MVP** | Biblioteca, Estúdio, Enfeite de Natal + Chaveiro, validação, perfis de material com kerf, estimativa de tempo/preço, mockup PNG, lote + chapa em grade, salvar local |
| **2 — Produção** | Prévia 3D, mais modelos, peça de calibração, etiqueta de produção, ficha do pedido |
| **3 — Plataforma** | Editor/importador de modelos (SVG + parâmetros), STL, nesting |
| **4 — Comercial (opcional)** | Portal do cliente, link de aprovação, contas, catálogo público |

## 21. Riscos

| Risco | Mitigação |
|---|---|
| União de letras cursivas falha em algumas fontes | Lista curada de fontes testadas + controle de sobreposição + erro bloqueante |
| Diferença entre prévia e arquivo | Fonte única de geometria + teste de reparse |
| RDWorks interpretar o DXF de outra forma (escala, curvas) | R12 só com polilinhas e círculos; teste manual registrado antes de liberar cada modelo |
| Estimativa de tempo muito diferente da real | Fator de calibração ajustado com o tempo real do RDWorks |
| Escopo do editor de modelos cresce demais | Começar com modelos em código (Método A); editor só na Fase 3 |
| Licença de fontes | Somente OFL/licenças livres no MVP, documentadas |

## 22. Questões em aberto
Respondidas em 18/10/2026:

1. Área útil da máquina: **600 × 400 mm**. Versão do RDWorks/LaserCAD: desconhecida — o DXF R12 deve ser testado na máquina.
2. Logotipo: não há SVG oficial. O símbolo foi **reconstruído em vetor** a partir da imagem da identidade (`src/ui/brand.ts`, `public/favicon.svg`); substituir quando houver arquivo oficial.
3. Molduras: o projeto criou **6 molduras originais** (bola, estrela, sino, árvore, floco geométrico, coração). Novas molduras podem ser adicionadas pela tela de Configurações ou colocando o SVG na pasta de molduras (ver `docs/COMO-CRIAR-MOLDURA.md`).
4. Custos: **valores de exemplo** em `src/core/settings.ts`, editáveis em Configurações.

## 23. Ideias para fases seguintes
- **Peça de calibração:** um modelo que gera um "pente" de teste para medir o kerf real e a ponte mínima de cada material e preencher o perfil automaticamente.
- **Etiqueta de produção:** no lote, um PDF/lista com nome, modelo, material e tempo para conferir os itens depois do corte.
- **Ficha do pedido:** salvar o projeto com o nome e o WhatsApp do cliente, o mockup aprovado e o preço, formando um histórico simples.
- **Importar moldura SVG:** a FazerCriar desenha no CorelDRAW/Illustrator, marca as regiões por cor e o app transforma isso em modelo (caminho para o editor de modelos).
- **Topo de bolo, porta-nome de mesa, caixa finger joint e letreiro** como próximos modelos.
