/**
 * Tradução de erros de gravação do boletim para mensagens úteis.
 *
 * O cliente do banco (sem `throwOnError`) devolve o erro como OBJETO simples
 * `{ message, code, details, hint }` — não é `instanceof Error`. Antes, o
 * `catch` engolia o texto real e mostrava apenas "Erro ao gravar a página.".
 */

export interface DbErrorLike {
  message?: string | null;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
}

/** Códigos que indicam frontend desatualizado em relação ao esquema do banco. */
export const STALE_CLIENT_CODES = new Set([
  '42P10', // ON CONFLICT sem índice único correspondente (constraint mudou)
  'PGRST204', // coluna desconhecida no cache de esquema
  'PGRST200', // relacionamento desconhecido
  '42703', // coluna inexistente
]);

export const STALE_CLIENT_MESSAGE =
  'A versão do sistema aberta neste navegador está desatualizada em relação ao banco de dados. ' +
  'Atualize a página (ou reinstale o aplicativo) e repita a gravação.';

export const isDbErrorLike = (e: unknown): e is DbErrorLike =>
  !!e && typeof e === 'object' && ('message' in e || 'code' in e || 'details' in e);

export interface SaveErrorDescription {
  message: string;
  code: string | null;
  staleClient: boolean;
  offline: boolean;
}

export const describeSaveError = (e: unknown, fallback = 'Erro ao gravar a página.'): SaveErrorDescription => {
  if (e instanceof Error) {
    const offline = /failed to fetch|networkerror|load failed/i.test(e.message);
    return {
      message: offline
        ? 'Sem resposta do servidor ao gravar a página. Verifique a conexão e tente novamente — nada foi perdido.'
        : (e.message || fallback),
      code: null,
      staleClient: false,
      offline,
    };
  }
  if (typeof e === 'string' && e.trim()) {
    return { message: e.trim(), code: null, staleClient: false, offline: false };
  }
  if (isDbErrorLike(e)) {
    const code = e.code ? String(e.code) : null;
    const staleClient = !!code && STALE_CLIENT_CODES.has(code);
    const technical = [e.message, e.details, e.hint].filter((x) => !!x && String(x).trim()).join(' — ');
    if (staleClient) {
      return {
        message: `${STALE_CLIENT_MESSAGE} Detalhe técnico: ${technical || code}.`,
        code, staleClient: true, offline: false,
      };
    }
    if (code === '42501') {
      return {
        message: `Sem permissão para gravar notas nesta turma. ${technical}`.trim(),
        code, staleClient: false, offline: false,
      };
    }
    return {
      message: technical ? `${fallback} ${technical}` : fallback,
      code, staleClient: false, offline: false,
    };
  }
  return { message: fallback, code: null, staleClient: false, offline: false };
};
