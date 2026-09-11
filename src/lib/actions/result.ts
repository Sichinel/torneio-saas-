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
