/**
 * Formato padrão de retorno de toda Server Action do projeto. Toda ação
 * do usuário (criar, editar, excluir, salvar) deve retornar isto em vez
 * de falhar silenciosamente — o cliente usa isso pra mostrar um toast de
 * sucesso ou erro (ver useActionFeedback / ToastProvider).
 */
export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

export function ok(message?: string): ActionResult {
  return { ok: true, message };
}

export function fail(error: string): ActionResult {
  return { ok: false, error };
}

/**
 * Prefixo com que uma action sinaliza "isto é destrutivo, confirme"
 * em vez de só falhar. Vive aqui porque precisa ser lido pelo cliente e
 * pelo servidor: um arquivo "use server" só exporta funções async, e
 * qualquer módulo que toque next/headers não pode entrar no bundle do
 * navegador.
 */
export const PRECISA_CONFIRMAR = "PRECISA_CONFIRMAR:";
