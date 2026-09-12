-- =====================================================================
-- Limpeza dos jogadores antigos (2026-09-11)
--
-- Corrige os jogadores cadastrados antes do parser de lado/capitalização:
--   * lado digitado dentro do nome ("augusto E", "Alex - esquerda") vai
--     pra coluna `side` e sai do nome;
--   * capitalização padronizada ("FELIPE" -> "Felipe", "tonoli" -> "Tonoli"),
--     com da/de/do/das/dos/e minúsculos no meio do nome;
--   * duplicados (mesmo nome depois de limpar, pela mesma regra do índice
--     único `normalize_player_name`) viram um jogador só: fica o cadastro
--     MAIS ANTIGO; o lado é o da linha MAIS RECENTE do grupo que tinha lado
--     (mesma regra do app: o lado colado por último vale);
--   * duplas (`entries`) e partidas (`matches.team_a/team_b`: ids e nome
--     da dupla) passam a apontar pro jogador que ficou, com o nome novo.
--
-- COMO RODAR (SQL Editor do Supabase):
--   1. Rode só a PARTE 1 (prévia, só leitura) e confira a tabela.
--   2. Rode a PARTE 2 inteira. Ela é uma transação só: se qualquer
--      checagem do final falhar, nada é gravado.
-- =====================================================================


-- =====================================================================
-- PARTE 1 — PRÉVIA (só leitura; não altera nada)
-- =====================================================================
with parsed as (
  select p.id, p.owner_id, p.name as nome_antigo, p.side as lado_antigo, p.created_at,
         regexp_match(
           trim(regexp_replace(p.name, '\s+', ' ', 'g')),
           '^(.+?)[[:space:],(–-]+(direita|dir|d|eesquerda|esquerda|esq|e|ambos|ambas)\)?$', 'i'
         ) as m
  from public.players p
),
limpo as (
  select *,
         coalesce(trim(m[1]), trim(regexp_replace(nome_antigo, '\s+', ' ', 'g'))) as base,
         case lower(m[2])
           when 'direita' then 'direita' when 'dir' then 'direita' when 'd' then 'direita'
           when 'esquerda' then 'esquerda' when 'eesquerda' then 'esquerda'
           when 'esq' then 'esquerda' when 'e' then 'esquerda'
           when 'ambos' then 'ambos' when 'ambas' then 'ambos'
         end as lado_digitado
  from parsed
),
formatado as (
  select l.*,
         (select string_agg(
                   case when t.ord > 1 and lower(t.w) in ('da', 'de', 'do', 'das', 'dos', 'e')
                        then lower(t.w) else initcap(t.w) end,
                   ' ' order by t.ord)
            from regexp_split_to_table(l.base, ' ') with ordinality as t(w, ord)) as nome_formatado,
         coalesce(l.lado_digitado, l.lado_antigo) as lado_da_linha
  from limpo l
),
grupos as (
  select f.*,
         public.normalize_player_name(f.nome_formatado) as chave,
         first_value(f.id) over w_antigo as manter_id,
         first_value(f.nome_formatado) over w_antigo as nome_novo,
         first_value(f.lado_da_linha) over (
           partition by f.owner_id, public.normalize_player_name(f.nome_formatado)
           order by (f.lado_da_linha is null), f.created_at desc
         ) as lado_novo
  from formatado f
  window w_antigo as (
    partition by f.owner_id, public.normalize_player_name(f.nome_formatado)
    order by f.created_at, f.id
  )
)
select case when id = manter_id then 'FICA' else 'JUNTA em "' || nome_novo || '"' end as acao,
       nome_antigo,
       coalesce(lado_antigo, '—') as lado_antigo,
       nome_novo,
       coalesce(lado_novo, '—') as lado_novo,
       (select count(*) from public.entries e where e.player_id_1 = g.id or e.player_id_2 = g.id) as duplas
from grupos g
order by nome_novo, (id <> manter_id), created_at;


-- =====================================================================
-- PARTE 2 — LIMPEZA (grava; uma transação só)
-- =====================================================================
begin;

-- Mesmo cálculo da prévia, guardado numa tabela temporária.
create temp table plano on commit drop as
with parsed as (
  select p.id, p.owner_id, p.name as nome_antigo, p.side as lado_antigo, p.created_at,
         regexp_match(
           trim(regexp_replace(p.name, '\s+', ' ', 'g')),
           '^(.+?)[[:space:],(–-]+(direita|dir|d|eesquerda|esquerda|esq|e|ambos|ambas)\)?$', 'i'
         ) as m
  from public.players p
),
limpo as (
  select *,
         coalesce(trim(m[1]), trim(regexp_replace(nome_antigo, '\s+', ' ', 'g'))) as base,
         case lower(m[2])
           when 'direita' then 'direita' when 'dir' then 'direita' when 'd' then 'direita'
           when 'esquerda' then 'esquerda' when 'eesquerda' then 'esquerda'
           when 'esq' then 'esquerda' when 'e' then 'esquerda'
           when 'ambos' then 'ambos' when 'ambas' then 'ambos'
         end as lado_digitado
  from parsed
),
formatado as (
  select l.*,
         (select string_agg(
                   case when t.ord > 1 and lower(t.w) in ('da', 'de', 'do', 'das', 'dos', 'e')
                        then lower(t.w) else initcap(t.w) end,
                   ' ' order by t.ord)
            from regexp_split_to_table(l.base, ' ') with ordinality as t(w, ord)) as nome_formatado,
         coalesce(l.lado_digitado, l.lado_antigo) as lado_da_linha
  from limpo l
)
select f.id,
       f.nome_antigo,
       first_value(f.id) over w_antigo as manter_id,
       first_value(f.nome_formatado) over w_antigo as nome_novo,
       first_value(f.lado_da_linha) over (
         partition by f.owner_id, public.normalize_player_name(f.nome_formatado)
         order by (f.lado_da_linha is null), f.created_at desc
       ) as lado_novo
from formatado f
window w_antigo as (
  partition by f.owner_id, public.normalize_player_name(f.nome_formatado)
  order by f.created_at, f.id
);

-- 1. Duplas passam a apontar pro jogador que fica.
update public.entries e set player_id_1 = pl.manter_id
from plano pl where e.player_id_1 = pl.id and pl.id <> pl.manter_id;

update public.entries e set player_id_2 = pl.manter_id
from plano pl where e.player_id_2 = pl.id and pl.id <> pl.manter_id;

-- 2. Partidas: troca os ids dos jogadores e refaz o nome da dupla.
with times as (
  select m.id, lado.col, lado.team
  from public.matches m
  cross join lateral (values ('team_a', m.team_a), ('team_b', m.team_b)) as lado(col, team)
  where lado.team ? 'playerIds'
),
refeito as (
  select t.id, t.col,
         jsonb_set(
           jsonb_set(t.team, '{playerIds}', jsonb_agg(to_jsonb(pl.manter_id) order by x.ord)),
           '{name}',
           to_jsonb(string_agg(pl.nome_novo, ' / ' order by x.ord)
             || case when t.team ->> 'name' like '% (sem parceiro)' then ' (sem parceiro)' else '' end)
         ) as novo
  from times t
  cross join lateral jsonb_array_elements_text(t.team -> 'playerIds') with ordinality as x(pid, ord)
  join plano pl on pl.id = x.pid::uuid
  group by t.id, t.col, t.team
)
update public.matches m
set team_a = coalesce((select r.novo from refeito r where r.id = m.id and r.col = 'team_a'), m.team_a),
    team_b = coalesce((select r.novo from refeito r where r.id = m.id and r.col = 'team_b'), m.team_b)
where m.id in (select id from refeito);

-- 3. Apaga os duplicados (já sem nenhuma dupla apontando pra eles).
delete from public.players p
using plano pl
where p.id = pl.id and pl.id <> pl.manter_id;

-- 4. Nome e lado limpos nos jogadores que ficam.
update public.players p
set name = pl.nome_novo, side = pl.lado_novo
from plano pl
where p.id = pl.id and pl.id = pl.manter_id
  and (p.name is distinct from pl.nome_novo or p.side is distinct from pl.lado_novo);

-- 5. Checagens: se alguma falhar, a transação inteira é desfeita.
do $$
declare
  n int;
begin
  select count(*) into n from public.players
  where name ~* '[[:space:],(–-]+(direita|dir|d|eesquerda|esquerda|esq|e|ambos|ambas)\)?$';
  if n > 0 then raise exception 'Ainda há % jogador(es) com lado no nome', n; end if;

  select count(*) into n from public.entries where player_id_1 = player_id_2;
  if n > 0 then raise exception '% dupla(s) ficaram com o mesmo jogador duas vezes', n; end if;

  select count(*) into n
  from public.matches m
  cross join lateral (values (m.team_a), (m.team_b)) as lado(team)
  cross join lateral jsonb_array_elements_text(lado.team -> 'playerIds') as x(pid)
  where not exists (select 1 from public.players p where p.id = x.pid::uuid);
  if n > 0 then raise exception '% referência(s) de partida apontam pra jogador inexistente', n; end if;
end $$;

commit;
