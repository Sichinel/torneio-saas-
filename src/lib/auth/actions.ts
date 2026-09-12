"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, type ActionResult } from "@/lib/actions/result";

export async function login(_prevState: ActionResult | undefined, formData: FormData): Promise<ActionResult | undefined> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return fail("Preencha email e senha.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error("login: signInWithPassword failed", error);
    return fail("Email ou senha inválidos.");
  }

  redirect("/dashboard");
}

export async function signup(_prevState: ActionResult | undefined, formData: FormData): Promise<ActionResult | undefined> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return fail("Preencha email e senha.");
  }
  if (password.length < 8) {
    return fail("A senha precisa ter pelo menos 8 caracteres.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    console.error("signup: signUp failed", error);
    return fail(error.message);
  }

  // Com confirmação de email ligada, o Supabase não retorna erro pra email
  // já cadastrado (anti-enumeração): devolve um usuário sem identities.
  if (data.user?.identities?.length === 0) {
    return fail("Este email já está cadastrado. Use o link Entrar abaixo.");
  }

  if (!data.session) {
    return ok("Conta criada! Confira seu email para confirmar antes de entrar.");
  }

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) console.error("logout: signOut failed", error);
  redirect("/");
}

/**
 * Passo 1 do "esqueci minha senha": manda o email de recuperação.
 *
 * O link do email cai em /auth/confirm, que troca o token_hash por uma
 * sessão de recovery e redireciona pra /auth/update-password. Isso é o
 * fluxo PKCE — o implícito (tokens no #hash) não funciona aqui porque a
 * sessão vive em cookie httpOnly lido pelo servidor.
 *
 * Nunca revela se o email existe: resposta idêntica nos dois casos, senão
 * a tela vira um oráculo de "quem tem conta aqui".
 */
export async function requestPasswordReset(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return fail("Informe seu email.");
  }

  const headerList = await headers();
  const origin = headerList.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL;

  if (!origin) {
    console.error("requestPasswordReset: sem origin no request e sem NEXT_PUBLIC_SITE_URL");
    return fail("Não foi possível enviar o email agora. Tente de novo em instantes.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm`,
  });

  // Só logamos: o usuário vê a mesma mensagem com ou sem erro.
  if (error) console.error("requestPasswordReset: resetPasswordForEmail failed", error);

  return ok("Se existe uma conta com esse email, o link de recuperação já está a caminho.");
}

/**
 * Passo 2: grava a senha nova. Só funciona com a sessão de recovery que o
 * /auth/confirm criou — sem ela o updateUser falha, que é a proteção real
 * desta tela (a página também confere, mas a verdade está aqui).
 */
export async function updatePassword(
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult | undefined> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  if (!password || !confirmation) {
    return fail("Preencha os dois campos.");
  }
  if (password.length < 8) {
    return fail("A senha precisa ter pelo menos 8 caracteres.");
  }
  if (password !== confirmation) {
    return fail("As senhas não conferem.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    console.error("updatePassword: updateUser failed", error);
    return fail("Não foi possível salvar a senha. Peça um novo link e tente de novo.");
  }

  redirect("/dashboard");
}
