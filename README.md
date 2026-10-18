# FazerCriar Studio

> **Ideias ganham forma.** Criação paramétrica de produtos para corte e gravação a laser.

Escolha um modelo, personalize, confira a verificação e o orçamento e baixe o arquivo em DXF, SVG 1:1, STL (impressão 3D) ou como mockup PNG para o cliente aprovar.

## Rodar

```bash
npm install
npm run dev        # abre em http://localhost:5173
npm test           # testes de geometria, exportação e modelos
npm run build      # versão estática em dist/ (pode ser hospedada em qualquer servidor)
```

## O que já faz

- **Modelos:** Enfeite de Natal com nome (6 molduras originais + molduras suas) e Chaveiro com nome (gravado, duas camadas ou silhueta; argola à esquerda, à direita ou no topo).
- **Estúdio:** painel montado automaticamente a partir dos parâmetros, prévia 2D em mm com cotas, modos Produto/Operações, zoom, desfazer/refazer.
- **Verificação:** peças soltas, pontes finas, detalhes pequenos, furo perto da borda, caractere ausente na fonte e peça maior que a área da máquina (600 × 400 mm).
- **Exportação:** DXF (camadas CORTE/GRAVACAO/MARCACAO), SVG 1:1, STL para impressão 3D (espessura do material + gravação em relevo de 0,6 mm), mockup PNG 1080 × 1080 com a marca, compensação de kerf.
- **Preparar moldura:** carregue um SVG ou DXF, passe o mouse nas linhas e marque contorno, janela, furo, recortes, gravação ou apagar.
- **Lote:** lista de nomes → ZIP com uma chapa organizada em grade ou um arquivo por nome, com tempo e preço do lote.
- **Orçamento:** tempo de máquina e preço sugerido a partir de perfis de material e custos editáveis.
- **Projetos:** salvos no navegador e exportáveis em `.fazercriar.json`.

## Documentação

- [PRD](docs/PRD.md)
- [Como criar uma moldura](docs/COMO-CRIAR-MOLDURA.md)
- [Como adicionar um novo modelo](docs/COMO-CRIAR-MODELO.md)

## Estrutura

```
src/core/      motor: geometria, texto, validação, exportadores, estimativa (sem React)
src/models/    modelos (um por pasta) + registro e categorias
src/ui/        interface React com a identidade FazerCriar
tests/         testes automatizados (Vitest)
```
