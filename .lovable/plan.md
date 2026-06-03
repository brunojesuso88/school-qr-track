## Objetivo

Na aba **Notificação Docente**, substituir o campo de texto livre **"Turmas / disciplina"** por dois seletores múltiplos populados a partir do **Mapeamento Escolar**:

- **Disciplinas** → vindas de `mapping_global_subjects` (campo `name`)
- **Turmas** → vindas de `mapping_classes` (campo `name`, agrupadas por `shift`)

## Comportamento

1. Ao abrir o formulário de nova notificação, buscar em paralelo:
   - `mapping_global_subjects` ordenado por `name`
   - `mapping_classes` ordenado por `shift, name`
2. Dois campos lado a lado (responsivo):
   - **Disciplinas** — multi-select com busca (Popover + Command + Checkbox), permite selecionar 1+ disciplinas
   - **Turmas** — multi-select com busca, com separadores por turno (Manhã / Tarde / Noite)
3. As seleções são combinadas no formato salvo em `classes_subjects` (texto):
   - `"<Disciplina1, Disciplina2> – <Turma A, Turma B, Turma C>"`
   - Esse texto continua sendo exibido no preview, PDF e listagem (sem mudanças no backend nem no schema).
4. Ao editar uma notificação existente, tentar reconstruir as seleções a partir do texto salvo (split por `–` e por `,`); se não casar, manter seleção vazia e mostrar o texto original como dica (fallback editável).
5. Campo continua opcional. Botão "Limpar" para zerar as duas listas.

## Arquivos afetados

- `src/pages/TeacherNotifications.tsx` — substituir o `<Input>` da seção "Turmas / disciplina" pelos dois multi-selects e adicionar o `useEffect`/`useQuery` que carrega as listas. Atualizar `setForm` para gravar `classes_subjects` derivado.

## Fora de escopo

- Nenhuma mudança em banco, RLS, edge functions, preview/PDF ou estrutura de `teacher_notifications`.
- Não alterar regras de import/visualização.
