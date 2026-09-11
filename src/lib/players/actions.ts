"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, type ActionResult } from "@/lib/actions/result";

function sideFromForm(formData: FormData): string | null {
  const side = String(formData.get("side") ?? "").trim();
  return side || null;
}

export async function createPlayer(_prevState: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return fail("Digite um nome.");
  const side = sideFromForm(formData);
  const phone = String(formData.get("phone") ?? "").trim() || null;

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    console.error("createPlayer: no authenticated user", authError);
    return fail("Sessão expirada. Atualize a página e faça login de novo.");
  }

  const { error } = await supabase.from("players").insert({ owner_id: user.id, name, side, phone });
  if (error) {
    console.error("createPlayer: insert failed", error);
    if (error.code === "23505") {
      return fail(`Já existe um jogador chamado "${name}" no seu banco — edite o existente em vez de criar um novo.`);
    }
    return fail(`Não foi possível salvar: ${error.message}`);
  }

  revalidatePath("/dashboard/players");
  return ok(`${name} adicionado ao banco de jogadores.`);
}

export async function updatePlayer(
  id: string,
  _prevState: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return fail("Digite um nome.");
  const side = sideFromForm(formData);
  const phone = String(formData.get("phone") ?? "").trim() || null;

  const supabase = await createClient();
  const { error } = await supabase.from("players").update({ name, side, phone }).eq("id", id);
  if (error) {
    console.error("updatePlayer: update failed", error);
    if (error.code === "23505") {
      return fail(`Já existe um jogador chamado "${name}" no seu banco — escolha outro nome.`);
    }
    return fail(`Não foi possível salvar: ${error.message}`);
  }

  revalidatePath("/dashboard/players");
  return ok("Jogador atualizado.");
}

export async function deletePlayer(
  id: string,
  _prevState: ActionResult | undefined,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("players").delete().eq("id", id);
  if (error) {
    console.error("deletePlayer: delete failed", error);
    return fail(`Não foi possível excluir: ${error.message}`);
  }

  revalidatePath("/dashboard/players");
  return ok("Jogador excluído.");
}

export async function createPlayersBulk(names: string[]): Promise<ActionResult> {
  if (names.length === 0) return fail("Nada pra adicionar.");
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    console.error("createPlayersBulk: no authenticated user", authError);
    return fail("Sessão expirada. Atualize a página e faça login de novo.");
  }

  const { error } = await supabase
    .from("players")
    .insert(names.map((name) => ({ owner_id: user.id, name })));
  if (error) {
    console.error("createPlayersBulk: insert failed", error);
    if (error.code === "23505") {
      return fail("Um ou mais nomes da lista já existem no seu banco. Remova os duplicados e tente de novo.");
    }
    return fail(`Não foi possível salvar: ${error.message}`);
  }

  revalidatePath("/dashboard/players");
  return ok(`${names.length} jogador(es) adicionado(s).`);
}
