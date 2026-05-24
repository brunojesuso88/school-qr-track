## Objetivo

Adicionar um botão no card de cada aluno no Sistema AEE para gerar um PDF do **PAEE** (Plano de Atendimento Educacional Especializado) com cabeçalho institucional, logo da escola e layout moderno, organizado e fácil de interpretar.

## Onde aparece

- **Card do aluno em `src/pages/AEE.tsx`** — novo botão "PAEE PDF" ao lado dos botões existentes (Visualizar / Editar), com ícone `FileDown` e variante `outline`. Desabilitado (com tooltip "PAEE ainda não preenchido") quando o aluno não possui registro em `student_paee`.

## Geração do PDF

Usar **`window.print()`** com uma janela auxiliar (mesmo padrão já adotado em PEI/Declarações no projeto — sem dependências novas). Fluxo:

1. Função `handleExportPAEEPDF(student)` busca `student_paee` por `student_id` (single).
2. Se vazio → toast "Aluno sem PAEE cadastrado".
3. Renderiza HTML em `window.open()`, injeta CSS de impressão (`@page A4`, margens, cores) e chama `window.print()` ao terminar o load.
4. Logo: usa `logoCepans` já importado em `AEE.tsx` (convertido para data URL via `fetch` + `FileReader`) para garantir renderização na impressão.

## Layout do PDF (moderno e institucional)

Inspirado em modelos institucionais de planos educacionais (faixa de cor, tipografia hierárquica, cards de área com cores suaves para facilitar leitura).

```text
┌──────────────────────────────────────────────────────────────┐
│  [LOGO]   {NOME DA ESCOLA}                          PAEE     │ ← faixa azul institucional
│           Plano de Atendimento Educacional Especializado     │
│           Data de Elaboração: 24/05/2026                     │
├──────────────────────────────────────────────────────────────┤
│  1. IDENTIFICAÇÃO                                            │
│  ┌────────────────┬───────────────┬────────────────────────┐ │
│  │ Estudante      │ Turma         │ Idade                  │ │
│  │ Matrícula      │ Turno         │ Deficiência / CID      │ │
│  └────────────────┴───────────────┴────────────────────────┘ │
│                                                              │
│  2. ORGANIZAÇÃO DO ATENDIMENTO                               │
│  Composição: Individual    Periodicidade: 1º Semestre        │
│  Dias: Seg • Qua • Sex     Horário: 14h–15h                  │
│  Assistência: ☑ Intérprete Libras   ☐ Auxiliar de Apoio      │
│                                                              │
│  3. MATRIZ PEDAGÓGICA                                        │
│  ┌──── Área Cognitiva ──────────────────────────────────┐    │
│  │ Objetivos      │ ...                                 │    │
│  │ Estratégias    │ ...                                 │    │
│  │ Registro Aval. │ ...                                 │    │
│  └──────────────────────────────────────────────────────┘    │
│  (repetir para Motora, Comunicação, Social, Comportamento)   │
│                                                              │
│  4. ASSINATURAS                                              │
│  _______________________     _______________________         │
│  Professor(a) de AEE         Coordenador(a)                  │
├──────────────────────────────────────────────────────────────┤
│  Edunexus • {escola} • Pág. X/Y • Gerado em DD/MM/AAAA HH:MM │
└──────────────────────────────────────────────────────────────┘
```

**Decisões visuais:**
- Faixa institucional superior em azul (`#1e3a5f` → `#2d6a9e`) com logo à esquerda e título à direita.
- Tipografia: system-ui / Segoe UI, hierarquia clara (título 22pt, seções 14pt uppercase com barra lateral azul, rótulos 9pt cinza, conteúdo 11pt).
- Cards de área da matriz com gradiente sutil (azul→cinza claro) e borda esquerda colorida por área (cognitiva azul, motora âmbar, comunicação verde, social roxo, comportamento rosa) para escaneamento visual rápido.
- Tabelas com `border-collapse`, linhas alternadas (`#f8fafc`).
- Checkboxes renderizadas como `☑/☐` Unicode para sinalizar Libras/Apoio.
- Rodapé fixo via `@page` com paginação e timestamp.
- `print-color-adjust: exact` para manter cores na impressão.

## Mapeamento dos dados

Da tabela `student_paee` + `students`:

| Seção | Campos |
|---|---|
| Cabeçalho | `schoolName` (hook), `logoCepans`, `elaboration_date` |
| Identificação | `student.full_name`, `student_id`, `class`, `getShiftLabel(shift)`, `age` (ou calculado de `birth_date`), `disability_type` (label do enum) |
| Organização | `composition`, `periodicity`, `weekdays` (labels), `schedule_time`, `libras_interpreter`, `support_assistant` |
| Matriz | `pedagogical_matrix[area].{objectives, strategies, evaluation_record}` para 5 áreas |
| Assinaturas | `aee_teacher_signature`, `coordinator_signature` |

Reutilizar `escapeHtml`, `getShiftLabel`, `calculateAge` já existentes em `AEE.tsx`. Importar os labels de área/deficiência/dia de `PAEEForm.tsx` (exportar as constantes `DISABILITY_OPTIONS`, `WEEKDAYS`, `AREAS`, `FIELD_LABELS` que hoje são internas).

## Arquivos a editar

- `src/pages/AEE.tsx` — adicionar botão no card, função `handleExportPAEEPDF`, helpers de render HTML, conversão do logo para data URL (cacheada em ref).
- `src/components/aee/PAEEForm.tsx` — `export` das constantes `DISABILITY_OPTIONS`, `WEEKDAYS`, `AREAS`, `FIELD_LABELS` para reuso na geração do PDF.

## Fora de escopo

- Biblioteca externa de PDF (jsPDF/pdfmake) — `window.print` mantém consistência com PEI/Declarações.
- Assinaturas digitais com canvas/imagem (apenas linhas para assinatura manual após impressão).
- Edição do layout pelo usuário.
