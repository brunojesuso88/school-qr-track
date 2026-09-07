# Roadmap — Recadastro de usuário removido, Geral sem bimestre, contador diário

Continuação do commit parcial `bc486a08` (migration `20260907110118_ca0d452e…` JÁ aplicada — não repetida).

## 1) Usuário excluído consegue se cadastrar novamente — CONCLUÍDO
- [x] Auditoria: SchoolAdminPanel, delete-user, admin_remove_membership, Auth.tsx, Join.tsx, guards, join_school_with_token, handle_new_user
- [x] Migration: `join_school_with_token` reabre inactive/rejected → pending; `resolve_registration_link` devolve school_id
- [x] Helpers puros: `membershipStateForSchool`, `describeAccountAccess`, `extractJoinToken`, `isExistingAccountSignUp`, `membershipFlow.ts`
- [x] `/join/:token`: sessão autenticada sem vínculo → solicitar vínculo imediatamente; estados ativo/pendente/reaberto/encerrado
- [x] `/join/:token`: e-mail já existente sem sessão → "Conta já existente — entre para solicitar acesso" (senha ou recuperação), join só após autenticar
- [x] `AuthContext.signUp` sinaliza conta existente; `refreshAccess` funciona logo após login
- [x] `AdminRoute`: conta sem vínculo/encerrada → caminho para link de cadastro; token pendente → voltar ao /join
- [x] `Auth.tsx`: após login com token pendente, refresh de acesso antes de redirecionar
- [x] Edge `delete-user` (implantada): bloqueia exclusão global no contexto de escola quando há vínculo em outra escola (409 `has_other_memberships`)
- [x] SchoolAdminPanel: envia schoolId na exclusão; "Excluir conta" desabilitado com vínculo em outra escola
- [x] Testes: reentrada após remover; sessão sem membership; conta existente exige login; outra escola preservada; reabrir pending; bloqueio de exclusão

## 2) Configurações > Geral — CONCLUÍDO
- [x] "Bimestre atual" removido da UI, tipo, default, parser e gravação (chave legada ignorada na leitura, sem migration)
- [x] Dashboard só exibe "Ano letivo"
- [x] Testes de schoolPreferences ajustados

## 3) Frequência diária — contador em tempo real — CONCLUÍDO
- [x] Helpers `computeSchoolPresence`, `formatPresencePercent`, `formatSchoolPresence`
- [x] Card "Presentes hoje: X de Y alunos — Z%" no topo, global da escola, com Progress e indicador "ao vivo"
- [x] Realtime `attendance` (filtro por escola) com debounce 700 ms → recarga isolada
- [x] Testes: dedup, inativo/órfão/outra escola, Y=0, %, data local

## QA — CONCLUÍDO
- [x] Vitest completo: 66 arquivos / 579 testes passando; tsgo limpo; build OK
- [x] Diff auditado: nenhuma alteração em IRA/matriz/parser/student_grades
- [x] Verificação no navegador: /join anônimo e autenticado, card de presença "ao vivo", Geral sem bimestre

## Próximos (prontos para iniciar)
- [ ] Painel de administração: filtro de membros por status (ativo/pendente/encerrado) e ação "Reabrir vínculo" direta, sem exigir novo acesso ao link
- [ ] Card de presença: detalhar por turno (Manhã/Tarde/Noite) ao passar o mouse/expandir, mantendo o total global
- [ ] Notificação interna para a direção quando um vínculo encerrado é reaberto via link (event_type `membership_reopened`)
