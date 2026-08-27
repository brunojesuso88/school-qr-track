# Atestados Médicos do Aluno + integração com Frequência

Proposta técnica/UX baseada na auditoria read-only do projeto atual. Nenhuma alteração feita.

## O que existe hoje (auditado)

- Card/detalhe do aluno: `src/components/StudentReportModal.tsx` já usa `Tabs` com 4 abas (Frequência, Notas, Ocorrências, Laudo médico — esta última só habilitada quando `students.has_medical_report`).
- Cadastro/listagem de alunos e diálogo de ocorrências: `src/pages/Students.tsx`. Já existe o tipo de ocorrência `medical_certificate` com data inicial (`date`) e final (`end_date`), gravado em `occurrences`.
- Relatório de ocorrências do dia: `src/components/OccurrencesReportDialog.tsx` (jsPDF, agrupado por turma).
- Frequência: `src/pages/Attendance.tsx` (filtros, relatório geral e detalhado em HTML/print), `src/components/AttendanceCalendar.tsx` (relatório diário por turma), `src/components/ClassAttendanceDialog.tsx` e exportação de faltosos em `src/pages/Classes.tsx`.
- Banco: `attendance(status: present|absent|justified)`, `occurrences(type, date, end_date, teacher_name)`, campos AEE sensíveis já no `students` (`aee_cid_code`, `aee_cid_description`, `aee_laudo_attachment_url`) com anexo em bucket privado (`aee-documents`).
- RLS atual: `students`/`occurrences`/`attendance` são legíveis por `admin`, `direction`, `teacher` (staff só vê frequência do dia). Ou seja, hoje **professor vê CID do AEE** — a nova estrutura deve ser mais restritiva.

Conclusão da auditoria: o atestado hoje é modelado como "ocorrência", sem status, sem validação de sobreposição, sem CID e sem qualquer efeito no relatório de faltas. Precisa de entidade própria.

## Modelo de dados recomendado

Nova tabela `public.student_medical_certificates`:

- `student_id` (FK students, not null)
- `start_date`, `end_date` (date, not null, `end_date >= start_date`)
- `days_count` (gerado/calculado na leitura, não armazenado)
- `cid_code` (text, opcional, normalizado maiúsculo sem ponto — ex. `J11`, `M545`)
- `cid_description` (text, opcional — preenchido por catálogo/IA, nunca digitado livre como diagnóstico)
- `cid_source` (`catalog` | `ai` | `manual` | null)
- `notes` (text, opcional, limite 500)
- `issuer` (text, opcional: médico/unidade)
- `attachment_path` (text, opcional — bucket privado)
- `status_manual` (`active` | `cancelled`, default `active`) — cancelamento lógico, sem delete
- `cancelled_reason`, `cancelled_by`, `cancelled_at`
- `created_by`, `created_at`, `updated_at` (+ trigger `update_updated_at_column`)

Índices: `(student_id, start_date desc)`, índice GiST em `daterange(start_date, end_date, '[]')` para sobreposição, e índice parcial em `status_manual = 'active'`.

Status derivado na aplicação (não persistido): `cancelado` → `futuro` (start > hoje) → `ativo` (hoje entre datas) → `vencido`.

### Regras de datas e sobreposição
- `end_date >= start_date` (CHECK); limite máximo configurável de dias (aviso, não bloqueio).
- Sobreposição com outro atestado **ativo** do mesmo aluno: bloquear salvamento com mensagem clara e link para o atestado existente (permitir editar/estender em vez de duplicar). Atestados cancelados não contam.
- Sem restrição a fim de semana (atestado pode abranger período contínuo); a cobertura de falta só é avaliada em dias com registro de frequência.

## UX no card do aluno

Nova aba `Atestados` em `StudentReportModal.tsx` (5ª aba, sempre visível para perfis autorizados; a aba `Laudo` do AEE permanece separada):

- Lista ordenada por período (mais recente primeiro), cada item mostrando: período `dd/MM` a `dd/MM`, quantidade de dias, badge de status (Ativo verde / Futuro azul / Vencido cinza / Cancelado riscado), quem cadastrou e ícone de anexo.
- CID exibido **oculto por padrão** ("CID registrado — mostrar"), com revelação sob clique e apenas para perfis autorizados. Perfis sem permissão veem só "possui CID registrado".
- Botão `Novo atestado` abre diálogo com: calendário de data inicial e final (mesmo padrão de `Students.tsx`), campo CID opcional com botão `Pesquisar CID com IA`, observações, anexo opcional.
- Ações por item: editar (datas/observação/anexo), cancelar (com motivo), baixar anexo. Nenhum delete físico.
- Indicador no card da listagem de alunos: badge discreto "Atestado ativo" quando houver cobertura na data atual.

## Comportamento no relatório de faltas

Princípio: **não alterar o registro bruto de `attendance`**. A cobertura é uma camada derivada.

- Novo hook `src/hooks/useCertificateCoverage.ts`: dado um conjunto de `student_id` + intervalo de datas, retorna um mapa `student_id|date → coberto`, consultando apenas `student_id, start_date, end_date, status_manual` (sem CID).
- Relatório diário (`AttendanceCalendar.tsx`) e relatório detalhado/geral (`Attendance.tsx`): faltas cobertas ganham marca visual e no PDF/HTML a coluna Status passa a exibir `Ausente (atestado)`, com legenda no rodapé. Sem CID, sem observações médicas no relatório geral.
- Resumo do dia por turma: contador extra "Ausências com atestado", e a taxa de frequência ganha uma linha adicional "frequência considerando atestados" sem substituir a taxa bruta.
- Exportação de faltosos (`Classes.tsx`) e `ClassAttendanceDialog.tsx`: marcar com asterisco os alunos com atestado válido, para não cobrar justificativa indevidamente.
- Opção futura (fase 4, opcional): botão "Aplicar atestado à frequência" que converte `absent` → `justified` no período, sempre com registro em `audit_logs` e nunca automático.

## Recurso `Pesquisar CID com IA`

Estratégia em três camadas, determinística primeiro:

1. **Catálogo local** (`src/lib/cid/cid10.ts` ou tabela `cid_catalog` somente-leitura com os capítulos/subcategorias mais usados): validação de formato (`^[A-Z]\d{2}(\.?\d)?$`) e busca exata/prefixo. Se o código existe no catálogo, a descrição oficial é retornada sem chamar IA.
2. **Edge Function `cid-lookup`** (Lovable AI Gateway, padrão do projeto): recebe **apenas o código informado**, com prompt restrito a "explicar em linguagem simples a descrição oficial deste código CID-10; se não reconhecer com segurança, responder desconhecido". Proibido inferir diagnóstico, gravidade, tratamento ou dados do aluno. Nenhum dado do aluno é enviado.
3. **Cache/auditoria**: resultado gravado em `cid_lookup_cache(code, description, simple_explanation, source, created_at)` para reuso e para evitar respostas divergentes; cada consulta registra `code`, usuário e origem em `audit_logs` — sem vincular ao aluno na tabela de cache.

UX: descrição retornada aparece como sugestão que o usuário **confirma** antes de gravar; sempre com aviso "descrição informativa, não é diagnóstico". Nunca preenche `cid_description` automaticamente sem confirmação.

## Permissões, RLS e LGPD

- Perfis: `admin` e `direction` → criar, editar, cancelar, ver CID e anexo. `teacher` → ver existência/período do atestado e a marca no relatório, **sem CID e sem anexo**. `staff` → nenhum acesso.
- Implementação: RLS na tabela restringindo INSERT/UPDATE a `admin`/`direction`; SELECT liberado a `admin`/`direction`/`teacher`, e os campos sensíveis (`cid_code`, `cid_description`, `attachment_path`, `notes`) expostos ao professor via **view/RPC** `student_certificates_basic` que só retorna período e status — o front do professor consome a view, nunca a tabela. GRANTs explícitos para `authenticated` e `service_role`.
- Minimização: nenhum relatório coletivo carrega CID; logs de auditoria registram acesso a CID (`log_audit_event` na tabela).
- Anexos: **opcionais**. Bucket privado `medical-certificates` (mesmo padrão de `aee-documents`), path `{student_id}/{certificate_id}/{arquivo}`, políticas de storage restritas a `admin`/`direction`, acesso só por URL assinada de curta duração.

## Impacto e indicadores

- Dashboard: novo indicador "Ausências cobertas por atestado (mês)" e "Alunos com atestado ativo".
- Nenhum impacto em notas, IRA ou importação de boletim.
- Ocorrências do tipo `medical_certificate` existentes permanecem intactas; oferecer, na aba Atestados, um aviso quando existir ocorrência antiga desse tipo, com ação manual de migração (sem migração automática de dados).

## Fases de implementação

1. **Dados**: migração da tabela, índices, RLS, GRANTs, view do professor, trigger de updated_at e auditoria.
2. **Card do aluno**: aba `Atestados` + diálogo de cadastro/edição/cancelamento com validação de datas e sobreposição.
3. **CID**: catálogo local, validação de formato, Edge Function `cid-lookup` com cache e confirmação do usuário.
4. **Frequência**: hook de cobertura e marcação nos relatórios diário/detalhado/geral e exportação de faltosos.
5. **Anexos e indicadores**: bucket privado, URLs assinadas, métricas no dashboard.

## Testes principais

- Datas: `end_date < start_date` rejeitado; atestado de 1 dia; período atravessando meses.
- Sobreposição: bloqueio com atestado ativo; permitido quando o anterior está cancelado.
- Status derivado: futuro/ativo/vencido/cancelado em torno de "hoje".
- Cobertura: falta em dia coberto marcada; falta fora do período não marcada; presença em dia coberto não alterada.
- Relatórios: PDF/HTML nunca contêm CID; legenda presente quando há cobertura.
- Permissões: professor não obtém CID nem anexo; staff sem acesso.
- CID: formato inválido rejeitado sem chamar IA; código do catálogo não chama IA; cache reutilizado; resposta "desconhecido" não grava descrição.
