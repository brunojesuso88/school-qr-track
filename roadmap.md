# Roadmap — Importador de boletim: auditoria + local-first

## Parte A — Bug "Aluno do boletim não encontrado na turma"
- [x] Baseline `count(*) student_grades` (77.557 antes e depois; nenhum dado de QA gravado)
- [x] Rastrear caminho UI → save do `student_id`
- [x] Helper canônico `resolvePersistedStudentId` (`src/lib/gradeImport/persistedStudent.ts`)
- [x] Validação no banco por `student_id + class_id + school_id` (sem rematch textual)
- [x] Preservar ID em páginas seguintes do mesmo aluno (`rememberPersistedStudent`/`recallPersistedStudent`)
- [x] Testes A–G (`persistedStudent.test.ts`)
- [x] Mensagem real do banco no erro de gravação (`describeSaveError`, detecção de cliente desatualizado)

## Parte B — Menos IA, mais local
- [x] Auditar condições que chamam `parse-grade-page`
- [x] Política central `decideAiFallback(localResult, context)` + testes (`aiPolicy.ts`)
- [x] Autoaceite local (via rápida) — já existente, mantido
- [x] Origem visível no selo da página (`readingOriginLabel`)
- [x] Cache por sessão do contexto estático (matriz/catálogo) escopado school+class+matrix (`contextCache.ts`)
- [x] Métricas no resumo (local / IA / ignoradas / tempo médio / %) (`readingMetrics.ts`)

## QA
- [x] Vitest completo (456/456), tsgo exit 0, build exit 0
- [x] Plano de otimização 3 fases entregue no chat

## Próximas fases (não iniciadas)
- [ ] Fase 2: cache de `grade_subjects` por página + prefetch da próxima página local
- [ ] Fase 3: validação por amostragem (IA só em N% das páginas locais conclusivas)
