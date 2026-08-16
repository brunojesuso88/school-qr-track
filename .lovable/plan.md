# Ajustes no PDF da Classificação do IRA

## O que muda

1. **Código do aluno**: exibido somente com dígitos (remove pontos, vírgulas, traços, espaços) na prévia e no PDF.
2. **Top 15**: o limite passa de 30 para 15 (prévia, badges, textos e PDF).
3. **Uma única página**: espaçamentos, altura de linha e fontes calibrados para que os 15 colocados caibam em uma folha A4 paisagem, sem quebra de página.
4. **Logo da escola**: brasão do CEPANS no cabeçalho do PDF (canto esquerdo da faixa institucional), com o texto do título recentralizado.
5. **Rodapé removido**: sai "Documento de divulgação de desempenho acadêmico — sem identificação nominal." e a numeração "Página 1".
6. **Margens otimizadas**: margens reduzidas e larguras de coluna redistribuídas para dar mais destaque a Código, Turma/Série e IRA.
7. **Estilo moderno e competitivo**: paleta azul/branco (sem o vermelho do logo), faixa superior em degradê de azuis, linhas zebradas em azul muito claro, destaque forte no pódio (1º/2º/3º) com medalhas em tons de azul/prata/grafite, coluna do IRA em azul escuro e maior, e uma frase motivacional de competição saudável no topo.

## Detalhes técnicos

- `src/lib/iraRanking.ts`
  - `RANKING_LIMIT` = 15.
  - Novo helper `formatStudentCode` (`String(code).replace(/\D/g, '')`) usado no PDF e exportado para a prévia.
  - Logo: adicionar o brasão como asset CDN (`lovable-assets`) e carregá-lo em runtime (fetch → dataURL) antes de `doc.addImage`; se o carregamento falhar, o PDF é gerado sem o logo (sem quebrar a exportação). `generateIraRankingPdf` passa a ser `async`.
  - Layout de uma página: faixa de cabeçalho mais compacta, `startY` ajustado, `styles.fontSize`/`cellPadding` reduzidos para 15 linhas, `autoTable` sem rodapé (`didDrawPage` removido).
  - Paleta: azul institucional + azuis claros; remover qualquer tom avermelhado das medalhas e dos destaques do pódio.
- `src/components/settings/IraRankingExport.tsx`
  - Usa `formatStudentCode` na tabela de prévia.
  - Textos passam a citar 15; `exportPdf` passa a aguardar a geração (async) com estado de carregamento no botão.
- Nada muda no cálculo do IRA, na seleção de disciplinas/períodos ou nas queries.
