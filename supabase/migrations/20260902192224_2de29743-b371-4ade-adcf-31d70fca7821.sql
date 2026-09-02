-- Limpeza dos artefatos temporários da auditoria A×B multi-escola.
-- Evidência já registrada: 15/15 verificações aprovadas (isolamento de leitura,
-- gravação, Storage, papel por escola, links de cadastro e staleness de IRA).
DROP FUNCTION IF EXISTS public.audit_ab_isolation();
DROP TABLE IF EXISTS public.ab_audit_results;