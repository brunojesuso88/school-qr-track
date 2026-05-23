## Ajustes nas sugestões do PEI

Adicionar novas sugestões em `src/components/aee/peiSuggestions.ts` para complementar o que já existe.

### 4. Barreiras de Aprendizagem
Adicionar a `LEARNING_BARRIERS_SUGGESTIONS`:
- Ansiedade que interfere no desempenho escolar.
- Dificuldade na interação social com pares e adultos.
- Falta de acompanhamento familiar nas tarefas escolares.
- Insegurança e baixa autoestima diante das atividades.
- Episódios de crise emocional em sala de aula.

### 7. Plano de Intervenção (altas habilidades)
Adicionar a `INTERVENTION_PLAN_SUGGESTIONS` novos objetivos:
- Aprofundar conteúdos em área de interesse — projetos investigativos individuais, semanal, professor AEE.
- Estimular pensamento crítico e criativo — desafios lógicos, xadrez e jogos estratégicos, semanal.
- Promover liderança e protagonismo — mediação de grupos e apresentação de projetos, quinzenal.
- Ampliar repertório cultural e científico — clubes de leitura, olimpíadas e feiras, mensal.

### 8. Adaptações por Disciplina (altas habilidades)
Criar nova constante `ADAPTATION_HIGH_ABILITIES_SUGGESTIONS` (exibida quando o checkbox de altas habilidades está marcado) com itens como:
- Atividades de aprofundamento e enriquecimento curricular.
- Projetos de pesquisa autônoma sobre temas de interesse.
- Desafios extras de raciocínio lógico e resolução de problemas.
- Acesso a materiais avançados (livros, vídeos, artigos).
- Participação em olimpíadas científicas e concursos.
- Tarefas abertas que estimulem criatividade e originalidade.

Em `PEIForm.tsx`, quando `highAbilities` estiver marcado, exibir botões dessas sugestões dentro da seção de Adaptações por Disciplina (em todas as três áreas: Português/Humanas, Matemática/Exatas, Ciências/Humanas).

### 9. Avaliação e Critérios
Adicionar a `EVALUATION_CRITERIA_SUGGESTIONS`:
- Enunciados simples, curtos e diretos, sem duplo sentido.
- Fonte ampliada (mínimo 16pt) em todas as provas e atividades.
- Espaçamento maior entre questões para facilitar a leitura.

### Arquivos alterados
- `src/components/aee/peiSuggestions.ts` — novas constantes e itens.
- `src/components/aee/PEIForm.tsx` — renderizar as sugestões de altas habilidades nas adaptações por disciplina.

### Fora de escopo (já implementado anteriormente)
- Integração Laudo dentro da aba PEI, foto do aluno e imagem do laudo na exportação, edição da data de nascimento, checkbox de altas habilidades no Perfil Funcional e Potencialidades — tudo isto já foi entregue no turno anterior.
