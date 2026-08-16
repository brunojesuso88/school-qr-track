/**
 * Sufixo visível "Sala Fora": diferencia turmas do anexo de turmas homônimas da Sede.
 * O sufixo pertence APENAS ao registro da turma no EDUNEXUS; nunca ao código lido no PDF.
 */
export const SALA_FORA_SUFFIX = 'Sala Fora';

const SUFFIX_RE = /\s*[-–—]?\s*sala\s+fora\s*$/i;

/** Remove o sufixo "Sala Fora" (qualquer caixa/espaçamento) do fim do nome. */
export function stripSalaForaSuffix(name: string | null | undefined): string {
  let out = String(name ?? '').trim();
  // Remove repetições acidentais do sufixo.
  while (SUFFIX_RE.test(out)) out = out.replace(SUFFIX_RE, '').trim();
  return out;
}

/** true quando o nome já termina com o sufixo do anexo. */
export function hasSalaForaSuffix(name: string | null | undefined): boolean {
  return SUFFIX_RE.test(String(name ?? '').trim());
}

/** Acrescenta o sufixo uma única vez, preservando o nome base normalizado. */
export function withSalaForaSuffix(name: string | null | undefined): string {
  const base = stripSalaForaSuffix(name);
  if (!base) return base;
  return `${base} ${SALA_FORA_SUFFIX}`;
}

/** Nome final da turma conforme a decisão do usuário no diálogo de divergência. */
export function resolveClassNameFromPdf(pdfName: string | null | undefined, salaFora: boolean): string {
  const base = stripSalaForaSuffix(pdfName);
  return salaFora ? withSalaForaSuffix(base) : base;
}

const normalizeBase = (s: string) =>
  stripSalaForaSuffix(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();

/**
 * Compara nomes de turma IGNORANDO o sufixo "Sala Fora".
 * Serve só para não gerar falso conflito dentro da turma já selecionada;
 * nunca para escolher automaticamente entre turmas distintas com o mesmo código-base.
 */
export function samePdfClassBaseName(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeBase(String(a ?? ''));
  const nb = normalizeBase(String(b ?? ''));
  return Boolean(na) && na === nb;
}
