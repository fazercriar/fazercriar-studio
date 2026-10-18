# Como criar uma moldura para o Enfeite de Natal

Uma moldura é um arquivo **SVG** comum. Você desenha no CorelDRAW, Illustrator ou Inkscape e dá nomes (id) a alguns objetos. O app lê só a geometria: cores, espessuras de linha e textos do arquivo são ignorados.

## Regiões

| id | Obrigatório | O que é |
|---|---|---|
| `contorno` | sim | Forma externa da peça (pode ser um grupo com vários objetos: eles são unidos). |
| `janela` | sim | Abertura onde o nome entra. **A base precisa ser reta**: as letras ficam em pé sobre ela e é isso que as liga à peça. |
| `gravacao` | não | Desenhos gravados (preenchidos). Só aparecem onde houver material. |
| `recortes` | não | Furos decorativos vazados (losangos, estrelinhas…). |
| `furo` | não | Furo para pendurar. O usuário pode desligá-lo no Estúdio. |

Cada região pode ser um único objeto (`path`, `rect`, `circle`, `ellipse`, `polygon`) ou um grupo (`<g id="...">`) com vários objetos. Transformações (`transform`) são respeitadas. Para fazer um furo dentro de um objeto, use `fill-rule="evenodd"`.

## Medidas

- O tamanho no arquivo não importa: o app escala a moldura para a largura escolhida (50 a 300 mm). Trabalhe por exemplo com 100 unidades de largura.
- Deixe pelo menos **5 % da largura** de material entre a janela e a borda externa, e entre os recortes.
- A janela deve ter altura de 15 % a 35 % da altura total: é ela que define o tamanho das letras.
- Deixe pelo menos 3 unidades de parede ao redor do `furo`.

## Exemplo mínimo

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 110" data-nome="Minha moldura">
  <g id="contorno">
    <circle cx="50" cy="60" r="48"/>
    <circle cx="50" cy="10" r="6.5"/>
  </g>
  <rect id="janela" x="12" y="45" width="76" height="28" rx="3"/>
  <g id="gravacao">
    <rect x="15" y="80" width="70" height="2.5"/>
  </g>
  <circle id="furo" cx="50" cy="10" r="2.6"/>
</svg>
```

`data-nome` (ou `<title>`) é o nome que aparece no app.

### No CorelDRAW
1. Desenhe cada parte e agrupe as que forem da mesma região.
2. Em **Objetos** (Janela › Objetos), renomeie cada objeto ou grupo com o id da tabela (`contorno`, `janela`…).
3. **Arquivo › Exportar › SVG**. Em "Estilos", escolha *atributos de apresentação*.

### No Inkscape
Selecione o objeto, abra **Objeto › Propriedades do objeto** (Ctrl+Shift+O), preencha o campo **ID** e clique em *Definir*.

## Duas formas de adicionar

**1. Pelo app, na tela Preparar moldura (sem renomear nada)** — Configurações › Molduras do enfeite › *Preparar nova moldura*.

1. **Carregar SVG ou DXF**: pode ser um desenho qualquer, por exemplo um enfeite pronto que já tem um nome recortado.
2. Passe o mouse nas linhas: a linha fica laranja e aparece o nome dela. Clique para selecionar (Shift/Ctrl + clique soma; Shift + arrastar seleciona por área).
3. Escolha a função nos botões ou pelo teclado: **C** contorno, **J** janela, **F** furo, **R** recortes, **G** gravação, **Del** apagar, **U** sem função. *Detectar automaticamente* já marca o contorno, o furo e os recortes.
4. **Janela**: clique na linha da faixa do nome. Se a faixa não existir como uma linha só (como num enfeite com o nome já recortado), selecione as letras antigas e as pontas da faixa e aperte **J**: o app usa a envoltória dessas linhas como janela.
5. Veja o **teste com um nome** e salve. A moldura passa a aparecer no Enfeite de Natal. Ela fica salva **neste navegador**; o botão *Baixar SVG preparado* gera o arquivo com os ids certos, que pode ser usado na forma 2.

Linhas abertas (tracejadas) não são usadas: no DXF, linhas e arcos soltos que se encontram são unidos automaticamente.

**2. Como moldura fixa do app** — copie o arquivo para `src/models/enfeite-natal/molduras/` com um nome curto sem espaços (ex.: `presente.svg`). Ele é carregado automaticamente e aparece para todos. Depois rode `npm test`: o teste do enfeite gera vários nomes acentuados em todas as molduras e acusa se alguma não formar peça única.

## Conferindo
No Estúdio, use a visualização **Operações**: a janela aparece como linha tracejada ciano. Teste nomes curtos e longos e nomes com acento (João, Cecília). Se aparecer "pedaços soltos" ou "ligações mais finas", aumente a área de material ao redor da janela.
