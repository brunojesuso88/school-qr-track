# Roadmap — Importador de boletim: auditoria + local-first

## Parte A — Bug "Aluno do boletim não encontrado na turma"
- [ ] Baseline `count(*) student_grades`
- [ ] Rastrear caminho UI → save do `student_id`
- [ ] Helper canônico `resolvePersistedStudentId`
- [ ] Validação no banco por `student_id + class_id + school_id` (sem rematch textual)
- [ ] Preservar ID em páginas seguintes do mesmo aluno
- [ ] Testes A–G

## Parte B — Menos IA, mais local
- [ ] Auditar condições que chamam `parse-grade-page`
- [ ] Política central `decideAiFallback(localResult, context)` + testes
- [ ] Autoaceite local (via rápida)
- [ ] Origem visível: "Leitura local — conclusiva" / "IA usada como fallback"
- [ ] Cache por sessão (alunos, matriz, grade_subjects) escopado school+class+matrix
- [ ] Métricas no resumo (local / IA / ignoradas / tempo médio / %)

## QA
- [ ] Vitest completo, tsgo, build
- [ ] Plano de otimização 3 fases no resultado
