## Problema

O Postgres rejeita o insert com `date/time field value out of range: "28/07/2010"` porque a edge function `parse-students-pdf` devolve `birth_date` no formato brasileiro `DD/MM/YYYY`, e em `src/pages/Classes.tsx` (linha 561) esse valor é enviado direto para a coluna `students.birth_date` (tipo `date`, que exige `YYYY-MM-DD`).

## Correção

Normalizar `birth_date` para ISO `YYYY-MM-DD` no front-end, dentro de `handleSaveStudents` (Classes.tsx), antes do insert. Usar um parser robusto que aceite:
- `DD/MM/YYYY` ou `DD-MM-YYYY` (formato brasileiro vindo do PDF)
- `YYYY-MM-DD` (já ISO — passa direto)
- Datas inválidas / vazias → `null` (campo já é nullable)

Função pura `toIsoBirthDate(input: string | null): string | null` com validação de mês/dia para evitar datas impossíveis (ex.: 31/02). Também aplicar a mesma normalização no valor passado para `generateStudentId(r.full_name, r.birth_date)` se a função depender de partes da data — checar antes para não quebrar a fórmula do ID.

## Arquivos

- `src/pages/Classes.tsx` — adicionar helper `toIsoBirthDate` e usá-lo em `birth_date` e (se necessário) ao gerar o `student_id`.

## Fora de escopo

- Edge function `parse-students-pdf` permanece como está (continua retornando `DD/MM/YYYY` que é o formato do PDF). Sanitização fica no cliente, mais barata e segura para retro-compat.
- Sem mudanças de schema ou RLS.
