# Correção antes de liberar a Escola 2

A auditoria somente leitura encontrou dois pontos que quebram o isolamento **de papel** entre escolas (os dados em si já estão isolados). Este plano corrige apenas esses pontos.

## Problema 1 — Papel vaza entre escolas (bloqueador)

As funções `user_has_any_role()` e `current_user_has_role()` consideram o papel em **qualquer** escola (e também o `user_roles` legado). Todas as políticas de papel das tabelas escolares (`students`, `classes`, `attendance`, `student_grades`, `settings`, `student_medical_certificates`, etc.) e todas as políticas de Storage usam essas funções.

Consequência com a Escola 2: um usuário que for `direction` na Escola B e `teacher` na Escola A passa a ter poderes de direção também na Escola A (excluir alunos/turmas, ver atestados, editar notas e configurações).

Correção: avaliar o papel **na escola da linha**, não globalmente.

- Nova função `public.has_row_role(_school_id uuid, _roles app_role[])`: verdadeira se o usuário é admin global ou tem vínculo ativo com um dos papéis **naquela** escola.
- Reescrever as políticas de papel das tabelas escolares trocando `user_has_any_role(ARRAY[...])` por `has_row_role(school_id, ARRAY[...])` (mantendo a policy restritiva `school_isolation` como está).
- Em tabelas filhas sem `school_id` direto no predicado, usar o `school_id` da própria linha (todas as tabelas auditadas já possuem a coluna).
- Manter `user_roles` apenas como fonte de admin global (`is_global_admin`).

## Problema 2 — Storage: papel global + fallback legado

As políticas de `storage.objects` combinam `user_has_any_role(...)` com `storage_school_allowed(name)`. Além do vazamento de papel acima, `storage_school_allowed` devolve acesso à **escola legada** quando o caminho não começa por `schools/<uuid>/`, o que permitiria a membros da Escola 1 gravar/ler fora do padrão.

Correção:

- Reescrever as políticas dos buckets `student-photos`, `class-photos`, `school-events`, `medical-certificates`, `aee-documents`, `management-signatures` usando `has_row_role(storage_path_school_id(name), ARRAY[...])`.
- Endurecer o caminho: exigir `storage_path_school_id(name) IS NOT NULL` em INSERT/UPDATE (nenhum objeto legado existe hoje — 756/756 já estão segregados), e remover o fallback legado da leitura depois de confirmar que nada mais aponta para caminho antigo.

## Ajuste menor opcional

`students.qr_code` tem unicidade **global**. Não é falha de acesso, mas pode gerar conflito de geração entre escolas; a unicidade correta é `(school_id, qr_code)`.

## Como será feito

1. Uma migration única: cria `has_row_role`, recria as policies de papel das tabelas escolares e as policies de Storage, ajusta `storage_school_allowed`/unicidade do QR.
2. Nenhuma mudança de frontend é necessária (escola ativa, papel por escola, caches segregados e `school_id` nos inserts já estão corretos).
3. QA: suíte Vitest completa, typecheck e build, mais um teste A×B transacional com `ROLLBACK` (sem resíduos) provando que direção da Escola B não é direção na Escola A.

## Fora de escopo

Nada de alteração em notas, IRA, medalhas, importador de boletim, frequência ou dados existentes.
