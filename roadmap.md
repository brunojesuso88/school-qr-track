# Roadmap — Matriz Integral (EPT/EVE/SEC), parser robusto e IRA aritmético

## Em andamento
- [ ] Séries/percursos `ept1|eve2|sec2|eve3|sec3` em `series.ts` (labels, parsing, opções)
- [ ] Migração: constraints de série, `system_key` + `ira_calculation_mode` em `curriculum_matrices`, `weekly_classes` nullable, `slot_index` em `curriculum_matrix_subjects` e `grade_subjects`, seed idempotente da Matriz Integral por escola (+ trigger para novas escolas)
- [ ] Espelho em código da Matriz Integral (`curriculumIntegralData.ts`) com listas exatas
- [ ] Motor IRA: modo `arithmetic` (peso 1 por componente) preservando `weighted_weekly`
- [ ] Threading do modo de IRA: card, detalhe, snapshot/recompute, medalhas
- [ ] Parser local: slots/ocorrências repetidas + continuidade de nomes longos em 2 linhas
- [ ] Import/reconcile/save com `slot_index`
- [ ] UI Disciplinas: tabs derivadas das etapas presentes, badge de modo de IRA, carga "não se aplica"
- [ ] Sync de turma por etapa (bloqueio sem componentes), sem mapping para carga nula
- [ ] Cadastro/edição de turma com os novos percursos
- [ ] Testes puros obrigatórios (11 blocos)
- [ ] QA de banco antes/depois
- [ ] Vitest / typecheck / build

## Descobertas
- Escola "CE MAIS Carlos Magno Duque Bacelar" já possui matriz homônima "Matriz Integral" criada manualmente (cópia da Original, 48 componentes 1/2/3, 0 turmas). Será renomeada para preservar e a Integral do sistema criada com `system_key='integral'`.
