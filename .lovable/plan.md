
# Plano: Substituir aba "Informações do Laudo" pelo PEI (Plano Educacional Individualizado)

## Objetivo
Na seção **Sistema AEE**, ao clicar em **Editar** um aluno, a aba "Informações do Laudo" será substituída pela aba **PEI**, contendo um formulário estruturado com 9 seções para construção do Plano Educacional Individualizado.

A aba "Professores" e o upload de documento do laudo permanecem inalterados.

---

## 1. Banco de Dados

### Nova tabela `student_pei`
Armazena o PEI completo do aluno (1 PEI ativo por aluno, mas mantemos histórico com `version`).

Colunas principais:
- `id` (uuid, PK)
- `student_id` (uuid, FK → students.id, ON DELETE CASCADE)
- **Identificação:** `birth_date_snapshot`, `shift_snapshot`, `enrollment_number`, `aee_teacher`, `coordination`, `elaboration_date`, `legal_guardian`, `contact`, `email`, `phone`
- **Texto livre:** `functional_profile`, `potentialities`, `learning_barriers`, `evaluation_criteria` (todos `text`)
- **JSON estruturados:**
  - `performance_levels` (jsonb) — ex: `{ "linguagem": "Independente", "matematica": "Com apoio", "ciencias_natureza": "Não realiza", "ciencias_humanas": "Independente" }`
  - `intervention_plan` (jsonb) — array de `{ objetivo, estrategia, frequencia, responsavel, recurso }`
  - `discipline_adaptations` (jsonb) — `{ portugues_humanas: "...", matematica_exatas: "...", ciencias_humanas: "..." }`
- `created_at`, `updated_at` (timestamptz, default `now()`)
- `created_by` (uuid)

### RLS (mesmo padrão de `students`)
- SELECT: admin, direction, teacher, staff
- INSERT/UPDATE: admin, direction, teacher
- DELETE: admin, direction

### Trigger
- `update_updated_at_column` em `BEFORE UPDATE`.

---

## 2. Frontend — `src/pages/AEE.tsx`

### Mudanças nas abas (apenas em modo edição)
```
TabsList:
  [ Professores ]  [ PEI ]              ← antes: "Informações do Laudo"
```

Em **modo visualização**, mantém a aba "Informações do Laudo" como está (read-only do laudo médico já existente). A aba PEI aparece apenas em **modo edição** (e também em modo visualização como uma terceira aba "PEI" para consultar o plano salvo).

> Decisão: 3 abas no total → **Professores | Laudo (read-only) | PEI**. O conteúdo de "Laudo" continua existindo (CID, medicação, alfabetização, etc.) — apenas o **título da aba** muda quando entrar em **modo edição** para "PEI", e o conteúdo de edição passa a ser o formulário PEI. Os campos do laudo (CID, medicação) continuam editáveis dentro da seção 1 do PEI ou são acessíveis pelo cadastro do aluno.

**Recomendação final (mais clara):** manter 3 abas sempre visíveis: `Professores | Laudo | PEI`. Edição do laudo médico passa para a aba "Laudo", e a aba "PEI" tem seu próprio formulário com botão Salvar independente.

### Novo componente: `src/components/aee/PEIForm.tsx`
Formulário com as 9 seções, em accordion ou seções empilhadas:

**1. Identificação** (grid 2 colunas)
- Nome Completo (auto, readOnly do `selectedStudent.full_name`)
- Data de nascimento (auto do `selectedStudent.birth_date`)
- Idade (calculada, readOnly)
- Turma (auto do `selectedStudent.class`, readOnly)
- Turno (auto, readOnly)
- Nº matrícula (auto do `selectedStudent.student_id`, readOnly)
- Professor(a) AEE — Input
- Coordenação — Input
- Data de elaboração — Input type=date (default hoje)
- Responsável legal — Input (preenche com `guardian_name` do aluno se vazio)
- Contato — Input
- E-mail — Input type=email
- Telefone — Input (preenche com `guardian_phone` do aluno se vazio)

**2. Perfil Funcional de Aprendizagem** — Textarea (`functional_profile`)

**3. Potencialidades** — Textarea (`potentialities`)

**4. Barreiras de Aprendizagem** — Textarea (`learning_barriers`)

**5. Nível Atual de Desempenho** — tabela com 4 linhas fixas (Linguagem, Matemática, Ciências da Natureza, Ciências Humanas), cada uma com `<Select>` com opções: "Nível Independente", "Com apoio", "Não realiza".

**7. Plano de Intervenção Pedagógica** — tabela dinâmica (array em `intervention_plan`):
- Colunas: Objetivo | Estratégia | Frequência | Responsável | Recurso
- Botão "+ Adicionar linha" e ícone de lixeira por linha.

**8. Adaptações por Disciplina** — 3 textareas:
- Língua Portuguesa e Humanas
- Matemática e Exatas
- Ciências Humanas

**9. Avaliação e Critérios** — Textarea (`evaluation_criteria`) com placeholder explicando instrumentos, critérios de sucesso e tipo de adaptação.

### Lógica de carregamento
- Ao abrir edição (`openEditMode`): se existe registro em `student_pei` para o `student_id`, carrega; senão, inicializa formulário vazio com campos auto-preenchidos a partir do `selectedStudent`.
- Botão **Salvar PEI**: faz `upsert` em `student_pei` por `student_id` (UNIQUE constraint).

### Integração com export PDF
- Atualizar `exportAEEReport` para incluir uma seção "PEI" no relatório quando existir, renderizando as 9 seções (ficará para iteração futura se preferir; mantém nesta entrega o export atual + nova função `exportPEIReport(student)` acionada por botão na aba PEI).

---

## Arquivos afetados

| Arquivo | Alteração |
|---|---|
| Migration SQL nova | Criar tabela `student_pei` com RLS e trigger |
| `src/pages/AEE.tsx` | Adicionar 3ª aba "PEI", lógica de carregar/salvar PEI, botão de exportar PEI |
| `src/components/aee/PEIForm.tsx` (novo) | Formulário completo das 9 seções |
| `src/lib/validations.ts` | Schema Zod `peiSchema` para validação |

---

## Detalhes técnicos

- Tipos em `src/integrations/supabase/types.ts` serão regenerados automaticamente após a migration.
- Os campos JSON (`performance_levels`, `intervention_plan`, `discipline_adaptations`) usam estados tipados no React e são serializados no save.
- O formulário PEI fica em `<ScrollArea>` dentro do dialog para não estourar a altura.
- Permissões: igual ao restante do AEE (admin, direction, teacher podem editar).
