-- Impede cadastrar o mesmo jogador duas vezes pro mesmo organizador
-- (mesmo nome com acento/caixa/espaços diferentes). Também remove
-- duplicados que já existam, mantendo o registro mais antigo de cada
-- grupo (owner_id + nome normalizado).
--
-- Usa translate() (built-in do Postgres, sem extensão) em vez de
-- unaccent() — o Supabase instala extensões no schema "extensions", não
-- em "public", o que fazia unaccent(text) não ser encontrado pelo
-- search_path padrão do SQL Editor.

create or replace function normalize_player_name(name text)
returns text
language sql
immutable
as $$
  select lower(trim(regexp_replace(
    translate(
      name,
      'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
      'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
    ),
    '\s+', ' ', 'g'
  )));
$$;

-- remove duplicados existentes (mantém o mais antigo por owner_id + nome normalizado)
delete from players p
using players p2
where p.owner_id = p2.owner_id
  and normalize_player_name(p.name) = normalize_player_name(p2.name)
  and (
    p.created_at > p2.created_at
    or (p.created_at = p2.created_at and p.id > p2.id)
  );

create unique index if not exists players_owner_name_unique
  on players (owner_id, normalize_player_name(name));
