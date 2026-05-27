## Objetivo

Atualizar a função `exportPAEEReport` em `src/pages/AEE.tsx` para que o PDF do PAEE siga o mesmo modelo institucional do PEI (mesmo cabeçalho técnico, foto do aluno, dados ampliados) e reorganizar a Matriz Pedagógica para caber em 2 páginas.

## Mudanças

### 1. Cabeçalho institucional unificado (igual ao PEI)
- Substituir o cabeçalho azul atual do PAEE pelo mesmo layout do PEI:
  - Brasão `logoCepans` à esquerda (130×130).
  - Nome da escola, cidade ("Coelho Neto - MA") e título do documento ("Plano de Atendimento Educacional Especializado — PAEE") em vermelho.
  - Barra de acento azul/vermelha (`.accent-bar`).
- Reaproveitar exatamente a mesma estrutura CSS do PEI (`institutional-header`, `accent-bar`, `student-id-row`, `photo`, `photo-placeholder`).

### 2. Identificação com foto do aluno
- Carregar `photoSrc` via `getSignedPhotoUrl(student.photo_url)` (igual ao PEI).
- Renderizar bloco `student-id-row` com foto circular + faixa azul contendo Nome / Turma / Turno / Matrícula.
- Expandir a tabela "1. Identificação" para incluir, além dos campos atuais (Estudante, Matrícula, Turma, Turno, Idade, Deficiência/CID):
  - Data de Nascimento
  - Data de Elaboração
  - Responsável Legal (de `student.guardian_name`)
  - Telefone do Responsável (de `student.guardian_phone`)
  - Professor(a) AEE (de `paee.aee_teacher_signature`)
  - Coordenação (de `paee.coordinator_signature`)
- Usar o mesmo estilo `.id-table` do PEI.

### 3. Matriz Pedagógica em 2 páginas
- Reformatar os 5 blocos de área para layout compacto que caiba em ~2 páginas A4:
  - Grid de 2 colunas (`grid-template-columns: 1fr 1fr`) com cada card de área ocupando uma coluna.
  - Reduzir paddings (8px), fonte para 9.5pt, line-height 1.35.
  - Layout interno do card: título da área no topo, e os 3 campos (Objetivos / Estratégias / Registro Avaliativo) empilhados com rótulos compactos em uma única coluna (sem grid 130px + valor).
  - Adicionar `page-break-before: always` antes da seção "3. Matriz Pedagógica" para garantir início em nova página → cabeçalho/identificação/organização ocupam página 1; matriz preenche páginas 2-3 de forma equilibrada.
  - Inserir `page-break-after: always` após a matriz para que Assinaturas iniciem em página própria, ou mantê-las na mesma se houver espaço.
- Manter as cores de acento por área (borda esquerda colorida).

### 4. Demais seções
- Manter "2. Organização do Atendimento" e "4. Assinaturas" com o mesmo visual do PEI (cabeçalhos azuis `.section h3`), para consistência total entre os dois relatórios.
- Manter rodapé com "Edunexus • Escola • Gerado em ...".

## Arquivos afetados

- `src/pages/AEE.tsx` — apenas a função `exportPAEEReport` (HTML/CSS interno + carregamento de `photoSrc`).

Nenhuma mudança em banco de dados, edge functions, formulários ou componentes.
