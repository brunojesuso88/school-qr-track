

# Plano: Campos Opcionais no Cadastro + Download de Alunos Faltosos

## 1. Tornar `guardian_name` e `guardian_phone` opcionais no cadastro de alunos

### Problema atual
Em `src/lib/validations.ts`, o `studentSchema` exige `guardian_name` (min 3 chars) e `guardian_phone` (regex obrigatoria). Isso bloqueia o cadastro se esses campos estiverem vazios.

Em `src/pages/Students.tsx`, o `handleSubmit` passa esses valores pela validacao Zod, que falha se vazios.

### Solucao

**Arquivo `src/lib/validations.ts`** (linhas 15-20):
- Alterar `guardian_name` para: `z.string().max(100).regex(nameRegex).optional().or(z.literal(''))`
- Alterar `guardian_phone` para: `z.string().regex(phoneRegex).optional().or(z.literal(''))`
- Ou seja, aceitar string vazia ou valor valido

**Arquivo `src/pages/Students.tsx`** (linhas 261-264):
- No `validationData`, passar `guardian_name` e `guardian_phone` como strings que podem ser vazias
- Ajustar para nao aplicar `formatPhone` em string vazia

## 2. Botao "Alunos Faltosos" no card da turma + download JPEG

### Comportamento
- Apos a frequencia diaria ser realizada (`classesWithAttendance.has(classItem.name)`), exibir um botao "Alunos Faltosos" no card
- Ao clicar, o sistema busca os alunos ausentes daquela turma no dia atual
- Gera uma imagem JPEG usando `<canvas>` com as informacoes: nome da turma, data, lista de alunos faltosos (nome e turma)
- Faz download automatico do arquivo JPEG

### Implementacao

**Arquivo `src/pages/Classes.tsx`**:
- Adicionar funcao `handleDownloadAbsentStudents(className: string)`:
  1. Consultar `attendance` com status `absent` e data de hoje, filtrando pelo `class` do aluno via join com `students`
  2. Criar um `<canvas>` off-screen com fundo branco
  3. Desenhar titulo (turma + data), e listar cada aluno faltoso com seu nome
  4. Converter para JPEG via `canvas.toDataURL('image/jpeg')` e disparar download
- Adicionar botao "Alunos Faltosos" (com icone `Download`) no card, visivel apenas quando a frequencia ja foi realizada e nao e final de semana
- O botao fica entre o botao de frequencia e o de ver alunos

## Resumo

| Arquivo | Alteracao |
|---------|-----------|
| `src/lib/validations.ts` | `guardian_name` e `guardian_phone` opcionais |
| `src/pages/Students.tsx` | Ajustar validacao para campos vazios |
| `src/pages/Classes.tsx` | Botao "Alunos Faltosos" + geracao e download de JPEG via canvas |

