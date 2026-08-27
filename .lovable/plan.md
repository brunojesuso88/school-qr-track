# Notificações Push para todos os usuários — Auditoria e Plano

## 1. O que existe hoje (verificado no código)

Autenticação e perfis
- `src/contexts/AuthContext.tsx`: sessão do Lovable Cloud (Supabase Auth), papel único lido de `user_roles` via `.single()`. Papéis: `admin`, `direction`, `teacher`, `staff`. Flags derivadas (`canAccessSettings`, `canManageUsers`, etc.).
- Identidade = `auth.users.id`; perfil em `profiles`; papéis em `user_roles` com `has_role`/`user_has_any_role` (SECURITY DEFINER).

PWA
- Já é PWA: `vite.config.ts` usa `vite-plugin-pwa` com `registerType: 'autoUpdate'`, manifest inline (Edunexus, standalone, tema `#0078a8`), ícones `public/pwa-192x192.png` / `pwa-512x512.png`, runtime caching NetworkFirst para o backend.
- `index.html` tem meta tags Apple/`theme-color`; `src/components/UpdatePrompt.tsx` controla atualização do SW.

Push (parcial e hoje NÃO funcional de ponta a ponta)
- Tabela `push_subscriptions` já existe (`user_id`, `endpoint`, `p256dh`, `auth`).
- `src/hooks/usePushNotifications.ts`: permissão, `pushManager.subscribe`, upsert por `user_id,endpoint`, unsubscribe. Usa `VITE_VAPID_PUBLIC_KEY`.
- `src/components/PushNotificationToggle.tsx`, exibido em `settings/NotificationSettings.tsx` **apenas para admin**.
- Secrets já cadastrados: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VITE_VAPID_PUBLIC_KEY`.
- Edge Function `notify-new-user` monta JWT VAPID manualmente.

Três lacunas bloqueantes encontradas
1. `public/sw-push.js` (handlers de `push` / `notificationclick`) **não é referenciado em lugar algum** — o service worker gerado pelo `vite-plugin-pwa` (generateSW) não faz `importScripts` dele. Logo, mesmo com subscription válida, nada é exibido.
2. `notify-new-user` envia o payload **sem criptografia aes128gcm** (o próprio comentário admite isso) e assina em ES256 com formato de assinatura possivelmente DER-vs-raw. Serviços de push (FCM/Mozilla/Apple) rejeitam ou entregam vazio. Precisa de biblioteca de webpush real.
3. Não existe modelo de notificação interna: `notification_logs` é de WhatsApp para responsáveis (`student_id`, `guardian_phone`), não serve. Não há tabela de notificações/leitura/preferências, nem disparo por evento (nenhum trigger/función para atestados, ocorrências, etc.).

Riscos de integração
- Trocar o SW: com `generateSW` é preciso `importScripts` de um arquivo próprio (via `workbox.importScripts`) ou migrar para `injectManifest`. Mudança de SW afeta usuários já instalados (é preciso um ciclo de atualização; `UpdatePrompt` ajuda).
- `AuthContext` usa `.single()` para papel: usuário com 2 papéis quebra. Audiência por papel deve ser calculada no servidor sobre `user_roles`, não sobre o papel do cliente.
- Cache NetworkFirst do backend pode servir contagem de não lidas defasada — a central deve usar Realtime/refetch explícito.
- Privacidade: `student_medical_certificates` é sensível; nenhum dado clínico pode entrar no payload push (payload fica no dispositivo e no serviço de push).

## 2. Escolha da tecnologia

| Opção | Prós | Contras |
| --- | --- | --- |
| Web Push nativo (VAPID) | Sem SDK/terceiros, sem custo, funciona em Chrome/Edge/Firefox/Android e Safari 16.4+ (iOS instalado); chaves já existem; roda em Edge Function | Criptografia precisa de lib correta; gerenciar retry/limpeza de endpoints por conta própria |
| Firebase Cloud Messaging | SDK maduro, tópicos, painel | Projeto Firebase + SW dedicado (`firebase-messaging-sw.js`), dados no Google, no iOS Web ainda depende do mesmo Web Push |
| OneSignal | Painel, segmentação, agendamento pronto | Terceiro com dados de usuários, script externo, custo ao escalar, menos controle de RLS/auditoria |

**Recomendação: Web Push nativo (VAPID).** Chaves e tabela já existem, não adiciona dependência externa nem envia dados de alunos para terceiros, e no iOS nenhuma alternativa contorna a exigência de PWA instalado. Implementar o envio com `npm:web-push` (Deno) em vez do JWT manual atual.

## 3. Plataformas e limites
- **Android (Chrome/Edge/Samsung)**: suporte pleno, funciona no navegador e instalado.
- **Desktop (Windows/macOS/Linux, Chrome/Edge/Firefox)**: suporte pleno; macOS Safari 16+ requer app adicionado ao Dock.
- **iPhone/iPad**: só a partir do iOS/iPadOS 16.4 **e somente com o app adicionado à Tela de Início** (Compartilhar → Adicionar à Tela de Início). Sem instalação, `PushManager` não existe. Permissão só pode ser pedida a partir de um gesto do usuário; sem badge de contagem confiável e sem `actions`. Consequência prática: manter a página `/install-pwa` (já existe) com passo a passo iOS e detectar "iOS não instalado" na UI para orientar em vez de falhar.

## 4. Esquema de banco proposto (nada aplicado agora)
- `push_devices` (evolução de `push_subscriptions`): `user_id`, `endpoint` (único), `p256dh`, `auth`, `user_agent`, `platform`, `last_seen_at`, `failure_count`, `disabled_at`, `school_id`.
- `notifications`: `id`, `school_id`, `event_type`, `title`, `body` (já genérico/sanitizado), `route` (deep link), `entity_table`, `entity_id`, `severity`, `created_by`, `dedupe_key` (único), `created_at`.
- `notification_recipients`: `notification_id`, `user_id`, `read_at`, `seen_at` — base da central e do badge (único por par).
- `notification_deliveries`: `notification_id`, `user_id`, `device_id`, `status` (`queued|sent|failed|expired`), `attempts`, `last_error`, `http_status`, `sent_at`.
- `notification_preferences`: `user_id`, `event_type`, `push_enabled`, `inapp_enabled`, `quiet_hours_start/end` — padrão opt-in por papel quando não houver linha.
- `notification_audience` (para eventos segmentados): `notification_id`, `scope` (`school|role|class|user`), `role`, `class_id`, `user_id`.
- RLS: `notification_recipients` e `notification_preferences` apenas do próprio `auth.uid()`; `notifications` legíveis via join com recipients (função SECURITY DEFINER ou policy com `EXISTS`); `push_devices` só do dono; escrita de `notifications`/`deliveries` só por `service_role` (Edge Function). GRANTs explícitos para `authenticated` e `service_role` em toda tabela nova.

## 5. Fluxo ponta a ponta
```text
Ação no app (ex.: gestor salva atestado)
  -> trigger/RPC ou chamada de Edge Function "notify-event" com {event_type, entity_id, school_id}
  -> função resolve audiência (papéis autorizados do evento, mesma escola)  [service role]
  -> insere notifications + notification_recipients (dedupe_key evita duplicidade)
  -> filtra por notification_preferences e devices ativos
  -> envia Web Push (payload genérico + url) por device, grava notification_deliveries
  -> service worker: evento "push" -> showNotification(title, body, data.url)
  -> "notificationclick" -> foca aba existente ou abre a rota (ex.: /students?student=<id>&tab=certificates)
  -> app na rota: valida permissão real por RLS e marca read_at do recipient
```
Regras de conteúdo por privacidade: para atestado, título "Novo atestado registrado" e corpo "Um novo atestado foi registrado para um aluno da sua escola." Nunca CID, diagnóstico, descrição, emissor ou nome do aluno no payload. Detalhes só dentro do app, respeitando as restrições atuais (professor vê apenas período/status; staff sem detalhes).

## 6. Multi-escola
- `school_id` (nullable no início, preenchido com a escola padrão) em `notifications`, `push_devices`, `notification_audience`.
- Audiência sempre `school_id + papel` (+ turma/usuário quando aplicável), resolvida no servidor a partir de `user_roles`.
- RLS filtra por vínculo do usuário à escola; nenhuma notificação cruza escolas.

## 7. Eventos iniciais e matriz de audiência
| Evento | admin | direction | teacher | staff |
| --- | --- | --- | --- | --- |
| `medical_certificate_created` | sim | sim | sim (genérico) | não |
| `management_announcement` | sim | sim | sim | sim |
| `occurrence_created` | sim | sim | autor/turma | não |
| `attendance_critical` (faltas acima do limite) | sim | sim | turma | não |
| `planning_deadline` (prazo/notificação docente) | sim | sim | docente alvo | não |
| `aee_validation` (GAEM/PAC/PEI/PAEE) | sim | sim | responsável | não |
| `grades_import_finished` | sim | sim | autor | não |
| `school_event_published` | sim | sim | sim | sim |
| `new_user_signup` (já existente) | sim | não | não | não |

## 8. Confiabilidade e observabilidade
- **Idempotência**: `dedupe_key` único (`event_type:entity_id:versão`); reenvio não duplica.
- **Retry**: até 3 tentativas com backoff (nova invocação/cron), `attempts` e `last_error` em `notification_deliveries`.
- **Expiração**: HTTP 404/410 → marca `disabled_at` no device e remove endpoint; `failure_count` alto → desativa.
- **Rate limit**: no máximo N notificações por usuário/hora por `event_type`; agrupamento ("3 novos atestados") quando estourar.
- **Fila**: processamento em lotes na Edge Function (chunks de ~100 devices) para não bater no limite de 150s (mesma lição do importador de boletim); cron para `queued`/retry.
- **Observabilidade**: logs da Edge Function + painel simples em Configurações (enviadas, falhas, devices ativos) para admin.

## 9. Fases, testes e critérios de aceite
**Fase 1 — Base do push funcionar de verdade**
- SW próprio com handlers `push`/`notificationclick` integrado ao `vite-plugin-pwa` (importScripts ou `injectManifest`), reaproveitando `public/sw-push.js`.
- Reescrever o envio com `npm:web-push` (aes128gcm correto) em uma função `send-web-push` compartilhada; `notify-new-user` passa a usá-la.
- Liberar `PushNotificationToggle` para todos os papéis, com aviso específico para iOS não instalado.
- Aceite: um push de teste chega em Android instalado, Chrome desktop e iPhone instalado; clique abre a rota certa.

**Fase 2 — Modelo de notificações e central no app**
- Tabelas, RLS e GRANTs da seção 4; Edge Function `notify-event`; sino no `DashboardLayout` com badge de não lidas, lista, marcar como lida/todas, Realtime.
- Aceite: notificação aparece na central mesmo com push negado; badge zera ao ler.

**Fase 3 — Evento atestado + preferências**
- Disparo no salvamento de atestado (mensagem genérica), tela de preferências por evento.
- Aceite: gestor cadastra atestado, admin/direção/professores da escola recebem push genérico; payload auditado sem CID; staff não recebe.

**Fase 4 — Demais eventos, retry/limpeza e rollout**
- Eventos da seção 7, cron de retry/limpeza, painel de observabilidade.
- Rollout: habilitar por papel (admin → direção → professores → staff), monitorando taxa de falha por device.

Testes: unitários para resolução de audiência, dedupe e sanitização de payload (garantir ausência de `cid_code`/descrição); testes de permissão em RLS; verificação manual multiplataforma.
