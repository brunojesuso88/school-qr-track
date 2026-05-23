# Auditoria: Cadastro de Novo Aluno

## Resultado da auditoria

Auditei o fluxo completo de cadastro em `src/pages/Students.tsx`, o schema Zod em `src/lib/validations.ts` e a tabela `students` no banco.

**Conclusão técnica:** o campo `guardian_name` **já é tecnicamente opcional** em todas as camadas:

- **Banco:** coluna `guardian_name` é `nullable` (sem NOT NULL, sem CHECK).
- **Validação Zod (`studentSchema`):** aceita string vazia (`z.literal('')`) — não bloqueia envio em branco.
- **Submit (`handleSubmit`):** converte vazio em `null` antes do insert/update.
- **HTML:** o `<Input>` não tem o atributo `required`.
- **Label atual:** já diz `Nome do Responsável (opcional)`.

**Por que o usuário pode estar percebendo como obrigatório:**
1. O rótulo usa o formato `(opcional)` entre parênteses (discreto), diferente do padrão `- Opcional` usado em `Telefone do Responsável` — gera inconsistência visual e a sensação de que só o telefone é opcional.
2. Se o usuário digitar 1 ou 2 caracteres, o Zod dispara a mensagem `"Nome do responsável deve ter pelo menos 3 caracteres"` (regra do min 3 quando preenchido). Isso pode ser confundido com "campo obrigatório".

## Mudança proposta

Arquivo único: `src/pages/Students.tsx`

- Alterar o label de `Nome do Responsável (opcional)` para `Nome do Responsável - Opcional`, padronizando com `Telefone do Responsável (WhatsApp) - Opcional`.

Nenhuma alteração em validação, banco ou lógica de submit é necessária — o campo já aceita vazio com segurança.

## Fora de escopo

- Não alterar `studentSchema` (a regra mínima de 3 caracteres *quando preenchido* é proteção válida contra dados inválidos).
- Não tocar no banco nem em outras telas.
