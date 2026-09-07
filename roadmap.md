# Roadmap — Recadastro de usuário removido, Geral sem bimestre, contador diário

Continuação do commit parcial `bc486a08` (migration `20260907110118_ca0d452e…` JÁ aplicada — não repetir).

## 1) Usuário excluído consegue se cadastrar novamente
- [x] Auditoria: SchoolAdminPanel, delete-user, admin_remove_membership, Auth.tsx, Join.tsx, guards, join_school_with_token, handle_new_user
- [x] Migration: `join_school_with_token` reabre inactive/rejected → pending; `resolve_registration_link` devolve school_id
- [x] Helpers puros: `membershipStateForSchool`, `describeAccountAccess`, `extractJoinToken`, `isExistingAccountSignUp`, `membershipFlow.ts`
- [ ] `/join/:token`: sessão autenticada sem vínculo → solicitar vínculo imediatamente; estados ativo/pendente/reaberto/encerrado
- [ ] `/join/:token`: e-mail já existente sem sessão → "Conta já existente — entre para solicitar acesso" (senha ou recuperação), join só após autenticar
- [ ] `AuthContext.signUp` sinaliza conta existente; `refreshAccess` funciona logo após login
- [ ] `AdminRoute`: conta sem vínculo/encerrada → caminho para link de cadastro; token pendente → voltar ao /join
- [ ] `Auth.tsx`: após login com token pendente, refresh de acesso antes de redirecionar
- [ ] Edge `delete-user`: bloquear exclusão global no contexto de escola quando há vínculo em outra escola (backend)
- [ ] SchoolAdminPanel: enviar schoolId na exclusão; desabilitar "Excluir conta" com vínculo em outra escola
- [ ] Testes: reentrada após remover; sessão sem membership; conta existente exige login; outra escola preservada; reabrir pending; bloqueio de exclusão

## 2) Configurações > Geral
- [ ] Remover "Bimestre atual" da UI, tipo, default, parser, gravação
- [ ] Remover exibição do bimestre no Dashboard
- [ ] Ajustar testes de schoolPreferences

## 3) Frequência diária — contador em tempo real
- [ ] Helper puro `computeSchoolPresence` + `formatPresencePercent`
- [ ] Card no topo, global da escola (independente de filtros), Progress
- [ ] Realtime `attendance` com debounce → recarga
- [ ] Testes: dedup, inativo/órfão/outra escola, Y=0, %, data local

## QA
- [ ] Vitest completo, tsgo, build
- [ ] Auditar diff: sem alterações em IRA/matriz/parser/student_grades
- [ ] Informar arquivos, comportamento, contagem de testes e SHA
