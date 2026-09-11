"use server";

import { redirect } from "next/navigation";
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
