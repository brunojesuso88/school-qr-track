# Roadmap — Recadastro de usuário removido, Geral sem bimestre, contador diário

## 1) Usuário excluído consegue se cadastrar novamente
- [ ] Auditar: SchoolAdminPanel (remover usuário), delete-user, admin_remove_membership, Auth.tsx, Join.tsx, guards, join_school_with_token, handle_new_user
- [ ] Remover vínculo da escola sem apagar identidade global quando houver outros vínculos
- [ ] Recadastro com e-mail existente: reutilizar identidade (login) e recriar vínculo via fluxo de aprovação
- [ ] Sessão ativa sem membership → direcionar para entrada em escola (não prender no guard)
- [ ] Mensagens UX distintas: conta sem vínculo / pendente / ativo / concluído
- [ ] Testes (helpers puros): remover membership e recadastrar; sessão sem membership; membership em outra escola; sem duplicar auth user; sem duplicar membership; isolamento school_id

## 2) Configurações > Geral
- [ ] Remover campo "Bimestre atual" da UI (sem migration, sem apagar histórico)
- [ ] Remover estado/gravação órfãos do campo; manter demais preferências

## 3) Frequência diária — contador em tempo real
- [ ] Helper puro: presentes distintos / ativos da escola / % seguro
- [ ] Card responsivo no topo da aba, global da escola (independente de filtros)
- [ ] Invalidação reutilizando React Query/realtime existentes
- [ ] Testes

## QA
- [ ] Vitest completo, tsgo, build
- [ ] Informar arquivos, comportamento, contagem de testes e SHA
