## Problema

Ambos os problemas relatados têm a mesma causa raiz: **constraints do banco** que exigem `guardian_name` (3–100 chars, NOT NULL) e `guardian_phone` no formato `^\d{10,11}$` (NOT NULL). Quando o usuário tenta cadastrar um aluno (incluindo na turma "Noturno") sem responsável ou telefone, o insert falha com `23514 students_guardian_phone_format`. O erro nos logs confirma:

```
new row for relation "students" violates check constraint "students_guardian_phone_format"
```

Não há nada específico à turma Noturno — é simplesmente o cenário em que o usuário deixa o telefone vazio.

## Mudanças propostas

### 1. Migration de banco
- `students.guardian_name`: tornar `NULL` permitido e remover/relaxar `students_guardian_name_length` (permitir NULL).
- `students.guardian_phone`: tornar `NULL` permitido e substituir `students_guardian_phone_format` por uma checagem que aceite `NULL` ou string vazia OU `^\d{10,11}$`.

### 2. `src/lib/validations.ts`
- `studentSchema.guardian_name` e `guardian_phone` já aceitam string vazia; nada a alterar (mantém validação de formato quando preenchido).

### 3. `src/pages/Students.tsx`
- Em `handleSubmit`, enviar `null` (em vez de `''`) para `guardian_name` e `guardian_phone` quando vazios, tanto no insert quanto no update.
- Ajustar o label do formulário: "Nome do responsável" e "Telefone do responsável" passam a indicar **(opcional)**, removendo o `*` de obrigatório.

### 4. `src/pages/Classes.tsx` (import de PDF)
- Garantir que a inserção em massa também envie `null` quando `guardian_name`/`guardian_phone` vierem vazios do PDF (já trata phone vazio, mas envia `'Responsável'` como fallback; vamos manter `null` se a IA não trouxer nada).

## Fora de escopo
- Lógica de alertas WhatsApp já está condicionada à presença de telefone (memória `guardian-contact-optional`), portanto continua válida.
- Sem mudanças em RLS, rotas ou outras telas.
