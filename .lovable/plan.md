
# Plano: Exportar PEI em PDF + Sugestões Pré-prontas

## 1. Logo institucional

- Copiar `user-uploads://Logo_Nonato_Novo.png` para `src/assets/logo-cepans.png`.
- Importar o logo no `AEE.tsx` para uso no cabeçalho do PDF (convertido em base64 via `import` do Vite, que já gera a URL pronta para usar em `<img src>`).

## 2. Substituir "Exportar PDF" por "Exportar PEI"

Em `src/pages/AEE.tsx`:

- Renomear o botão `FileDown` no card do aluno: `title="Exportar PEI"`.
- Trocar a chamada `fetchStudentTeachers(...).then(() => exportAEEReport(student))` por `exportPEIReport(student)`.
- Manter `exportAEEReport` removido (não é mais necessário).

### Nova função `exportPEIReport(student)`

- Carrega o PEI do aluno via `supabase.from('student_pei').select('*').eq('student_id', student.id).maybeSingle()`.
- Carrega os professores da turma (igual ao fluxo atual).
- Abre `window.open('', '_blank')` e injeta um HTML formatado para impressão (mesma estratégia já usada hoje, evitando dependências novas).
- Aciona `window.print()` no `onload`, gerando um PDF via "Salvar como PDF" do navegador.

### Cabeçalho institucional do PDF

```text
+----------------------------------------------------------+
| [LOGO]   CENTRO DE ENSINO PROF° ANTÔNIO NONATO SAMPAIO  |
|          Coelho Neto - MA                                |
|          Plano Educacional Individualizado (PEI)         |
+----------------------------------------------------------+
```

- Logo à esquerda (80px), texto institucional à direita.
- Cores: azul institucional (`#1e3a8a`) e vermelho do brasão (`#dc2626`) como detalhes (linhas, títulos).
- Nome da escola pode usar `useSchoolName()` como fallback, mas o título oficial vem fixo conforme solicitação.

### Conteúdo do PDF (espelhando as 9 seções do PEI)

1. Identificação (tabela 2 colunas: nome, data nasc., idade, turma, turno, matrícula, data elaboração, prof. AEE, coordenação, responsável legal, contato, telefone, e-mail)
2. Perfil Funcional de Aprendizagem
3. Potencialidades
4. Barreiras de Aprendizagem
5. Nível Atual de Desempenho (tabela)
6. (reservado — segue numeração do form)
7. Plano de Intervenção Pedagógica (tabela com Objetivo, Estratégia, Frequência, Responsável, Recurso)
8. Adaptações por Disciplina (Português/Humanas, Matemática/Exatas, Ciências Humanas)
9. Avaliação e Critérios
10. Professores da turma (tabela)
11. Rodapé com data de geração e linhas de assinatura (Prof. AEE / Coordenação / Responsável)

## 3. Sugestões pré-prontas nos campos do PEI

Em `src/components/aee/PEIForm.tsx`, criar um componente reutilizável `SuggestionPicker`:

- Para campos textarea (Perfil Funcional, Potencialidades, Barreiras, Avaliação, Adaptações por Disciplina): botão "Sugestões" abre um `Popover` com `Command` (lista pesquisável). Ao clicar em um item, ele é **anexado** ao texto atual (separado por `\n`), permitindo combinar várias sugestões + edição manual.
- Para o Plano de Intervenção: além do botão "Adicionar linha" manual, adicionar "Adicionar a partir de sugestão" que insere uma nova linha já preenchida com Objetivo + Estratégia sugeridos (editáveis).

### Banco de sugestões (arquivo novo `src/components/aee/peiSuggestions.ts`)

Curado a partir de referências da Educação Especial (BNCC, Política Nacional de Educação Especial, manuais do AEE/MEC). Categorias por transtorno mais comuns (TEA, TDAH, DI, deficiência sensorial) com itens genéricos suficientes para reuso.

**Perfil Funcional de Aprendizagem** (~12 opções):
- "Apresenta atenção sustentada por períodos curtos, beneficiando-se de pausas frequentes."
- "Demonstra preferência por aprendizagem visual, com apoio de imagens e pictogramas."
- "Comunica-se predominantemente por linguagem oral funcional, com vocabulário restrito."
- "Utiliza comunicação alternativa (gestos, pranchas, PECS) para expressar necessidades."
- "Apresenta hipersensibilidade auditiva, reagindo a ruídos intensos."
- "Demonstra autonomia nas atividades de vida diária dentro do ambiente escolar."
- "Necessita de mediação constante para iniciar e concluir tarefas."
- "Aprende melhor por meio de atividades concretas e manipuláveis."
- "Apresenta ritmo de aprendizagem mais lento, exigindo repetição e revisão."
- "Demonstra raciocínio lógico preservado em situações estruturadas."
- "Tem dificuldade em generalizar conceitos para novos contextos."
- "Apresenta boa memória visual e auditiva para temas de interesse."

**Potencialidades** (~12 opções):
- "Demonstra interesse por música e atividades rítmicas."
- "Possui boa memória para informações de seu interesse."
- "Apresenta habilidade artística (desenho, pintura, modelagem)."
- "Participa com entusiasmo de atividades em grupo quando bem mediadas."
- "Demonstra empatia e cuidado com colegas."
- "Apresenta facilidade com tecnologia e recursos digitais."
- "Realiza atividades motoras amplas com destreza."
- "Demonstra raciocínio matemático em situações concretas."
- "Reconhece e nomeia letras/números (alfabetização inicial)."
- "Demonstra criatividade na resolução de problemas práticos."
- "Tem boa coordenação motora fina."
- "Apresenta vocabulário rico em temas de interesse específico."

**Barreiras de Aprendizagem** (~12 opções):
- "Dificuldade na manutenção da atenção em atividades longas."
- "Dificuldade em interpretação de enunciados textuais."
- "Dificuldade em interação social com pares e adultos."
- "Resistência a mudanças de rotina e atividades não previstas."
- "Dificuldade na coordenação motora fina (escrita, recorte)."
- "Dificuldade na organização espacial e temporal."
- "Comportamento desafiador em situações de frustração."
- "Dificuldade na compreensão de regras sociais implícitas."
- "Limitação no vocabulário expressivo."
- "Dificuldade em abstração e raciocínio simbólico."
- "Hipersensibilidade sensorial (sons, luzes, texturas)."
- "Dificuldade em copiar do quadro / atividades visuais distantes."

**Plano de Intervenção** (~10 templates de Objetivo + Estratégia):
- Obj: "Ampliar o tempo de atenção em atividades dirigidas." / Est: "Uso de cronômetro visual e divisão da atividade em pequenas etapas."
- Obj: "Desenvolver a comunicação funcional." / Est: "Uso de pranchas de comunicação alternativa e modelagem verbal."
- Obj: "Avançar no processo de alfabetização." / Est: "Atividades com método fônico e materiais concretos (alfabeto móvel)."
- Obj: "Desenvolver autonomia nas atividades de vida diária." / Est: "Rotina visual com pictogramas e reforço positivo."
- Obj: "Ampliar o repertório de interação social." / Est: "Histórias sociais e jogos cooperativos mediados."
- Obj: "Desenvolver coordenação motora fina." / Est: "Atividades de recorte, pinça, traçado e modelagem com massinha."
- Obj: "Compreender enunciados de problemas matemáticos." / Est: "Leitura compartilhada e uso de material dourado/concreto."
- Obj: "Reduzir comportamentos disruptivos em sala." / Est: "Antecipação de rotina, espaço de auto-regulação e reforço positivo."
- Obj: "Ampliar a leitura e interpretação textual." / Est: "Textos curtos com apoio de imagens e perguntas guiadas."
- Obj: "Desenvolver raciocínio lógico-matemático." / Est: "Jogos de tabuleiro adaptados e situações-problema concretas."

**Adaptações por Disciplina** (~6 por área):
- Língua Portuguesa/Humanas: textos curtos, fonte ampliada (14-16pt), apoio de imagens, leitura compartilhada, redução do número de questões, uso de áudio-livros.
- Matemática/Exatas: material concreto (material dourado, ábaco), calculadora quando necessário, tempo ampliado, uso de cores para destacar operações, problemas contextualizados, redução da quantidade de exercícios.
- Ciências Humanas: linha do tempo visual, mapas com cores, vídeos curtos como apoio, vocabulário simplificado, atividades práticas, sínteses em mapa mental.

**Avaliação e Critérios** (~10 opções):
- "Avaliação processual e contínua, considerando avanços individuais."
- "Provas adaptadas com fonte ampliada e enunciados simplificados."
- "Tempo adicional (50%) para realização das atividades avaliativas."
- "Avaliação oral como complemento à escrita."
- "Uso de portfólio de produções como instrumento avaliativo."
- "Critério de sucesso: realização da atividade com apoio do mediador."
- "Critério de sucesso: realização da atividade de forma independente."
- "Avaliação por meio de registros fotográficos e relatórios descritivos."
- "Considerar participação, esforço e evolução em relação a si mesmo."
- "Adaptação significativa do conteúdo (currículo funcional)."

**Nível de Desempenho**: já é select fechado, sem mudança.

## 4. Ajuste de UX no PEIForm

- Botão "Sugestões" pequeno (`variant="outline" size="sm"`) ao lado do label de cada textarea.
- Popover com `Command` + `CommandInput` (busca) + `CommandList` com as opções.
- Nada substitui o conteúdo digitado: todas as opções são **adicionadas** no fim do texto.

## Resumo de arquivos

| Arquivo | Alteração |
|---------|-----------|
| `src/assets/logo-cepans.png` | Novo (copiado do upload) |
| `src/components/aee/peiSuggestions.ts` | Novo - banco de sugestões por seção |
| `src/components/aee/PEIForm.tsx` | Adicionar `SuggestionPicker` em todos os campos textuais e linhas de intervenção |
| `src/pages/AEE.tsx` | Renomear botão para "Exportar PEI"; nova função `exportPEIReport` com cabeçalho institucional + logo; remover `exportAEEReport` |
