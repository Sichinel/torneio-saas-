-- =====================================================================
-- Capinchos Cup 12/09 — remanejo de horários por disponibilidade (2026-09-12)
--
-- Duas duplas avisaram que não podem jogar cedo:
--   * Regis Cl / Lucas A ......... só a partir das 14:30
--   * João Israel / Henrique Lopez  só a partir das 16:00, e o último jogo
--     deles tem que ser contra o Jony / Alex
--
-- As duas estavam justamente nos dois primeiros blocos do dia (Grupo A às
-- 13:00/14:00/15:00 e Grupo B às 13:30/14:30/15:30), e as 24 vagas do dia
-- (12 horários x 2 quadras) estão 100% ocupadas — não dá pra empurrar só
-- os jogos delas sem tirar alguém do lugar.
--
-- Solução: trocar os BLOCOS de horário entre os grupos. A e B vão pra
-- tarde (+3h), C e D vêm pra frente (-3h). Os confrontos, as quadras e a
-- ordem do rodízio dentro de cada grupo não mudam — só o relógio.
--
--   Grupo A  13:00/14:00/15:00  ->  16:00/17:00/18:00
--   Grupo B  13:30/14:30/15:30  ->  16:30/17:30/18:30
--   Grupo C  16:00/17:00/18:00  ->  13:00/14:00/15:00
--   Grupo D  16:30/17:30/18:30  ->  13:30/14:30/15:30
--
-- Por que isso resolve tudo de uma vez:
--   * Henrique joga 16:00, 17:00 e 18:00 (todos >= 16h) e o último já era,
--     no rodízio do grupo, contra o Jony / Alex;
--   * Regis / Lucas joga 16:30, 17:30 e 18:30 (todos >= 14:30);
--   * todo mundo mantém o slot de descanso entre jogos (inclusive o
--     Henrique — a permissão de jogar jogos seguidos não foi necessária);
--   * o dia continua 13:00 -> 19:00, com as duas quadras cheias.
--
-- JÁ APLICADO em 2026-09-12, pela tela do organizador (os 24 jogos, um a
-- um, pela mesma action `saveMatchSchedule` que o botão "Salvar" usa) —
-- não pelo SQL Editor. O arquivo fica como registro do que mudou e por
-- quê, e serve de rede de segurança: rodar ele agora é no-op, porque a
-- PARTE 2 casa horário ANTIGO -> NOVO e não acha mais nada pra trocar.
--
-- SE PRECISAR RODAR (SQL Editor do Supabase):
--   1. Rode só a PARTE 1 (prévia, só leitura) e confira a grade de hoje.
--   2. Rode a PARTE 2 inteira. É uma transação só, com as checagens no
--      fim: se qualquer uma falhar, nada é gravado.
--   3. Rode a PARTE 3 pra ver a grade nova.
-- =====================================================================


-- =====================================================================
-- PARTE 1 — PRÉVIA (só leitura; não altera nada)
-- =====================================================================
select m.scheduled_time as horario, m.court as quadra, g.name as grupo,
       m.team_a->>'name' as dupla_a, m.team_b->>'name' as dupla_b
from public.matches m
join public.groups g on g.id = m.group_id
where m.category_id = '6a097073-936d-4957-8afa-1c434b7449fc'
order by m.scheduled_time, m.court;


-- =====================================================================
-- PARTE 2 — O REMANEJO (transação; roda tudo ou nada)
-- =====================================================================
begin;

update public.matches m
set scheduled_time = mapa.novo
from (values
  -- Grupo A (+3h)
  ('d6872eb2-f2a5-43dd-b539-46398d4c747a'::uuid, '13:00'::time, '16:00'::time),
  ('d6872eb2-f2a5-43dd-b539-46398d4c747a'::uuid, '14:00'::time, '17:00'::time),
  ('d6872eb2-f2a5-43dd-b539-46398d4c747a'::uuid, '15:00'::time, '18:00'::time),
  -- Grupo B (+3h)
  ('2070689e-7c39-4830-9d7f-c980e50b6013'::uuid, '13:30'::time, '16:30'::time),
  ('2070689e-7c39-4830-9d7f-c980e50b6013'::uuid, '14:30'::time, '17:30'::time),
  ('2070689e-7c39-4830-9d7f-c980e50b6013'::uuid, '15:30'::time, '18:30'::time),
  -- Grupo C (-3h)
  ('cbfa850b-1249-48d1-8d65-1f36124d52c0'::uuid, '16:00'::time, '13:00'::time),
  ('cbfa850b-1249-48d1-8d65-1f36124d52c0'::uuid, '17:00'::time, '14:00'::time),
  ('cbfa850b-1249-48d1-8d65-1f36124d52c0'::uuid, '18:00'::time, '15:00'::time),
  -- Grupo D (-3h)
  ('6d3a5dc8-b515-4b62-8517-5a7ea4c782ae'::uuid, '16:30'::time, '13:30'::time),
  ('6d3a5dc8-b515-4b62-8517-5a7ea4c782ae'::uuid, '17:30'::time, '14:30'::time),
  ('6d3a5dc8-b515-4b62-8517-5a7ea4c782ae'::uuid, '18:30'::time, '15:30'::time)
) as mapa(grupo, antigo, novo)
where m.group_id = mapa.grupo
  and m.scheduled_time = mapa.antigo
  and m.category_id = '6a097073-936d-4957-8afa-1c434b7449fc';

-- ---------------------------------------------------------------------
-- Checagens. Qualquer uma que falhar derruba a transação inteira.
-- ---------------------------------------------------------------------
do $$
declare
  henrique  constant uuid := '57b47584-b7ce-4599-a252-adbfa3e0ac86'; -- João Israel / Henrique Lopez
  regis     constant uuid := 'e4949176-13c2-4131-affb-de3f9ee380ca'; -- Regis Cl / Lucas A
  jony      constant uuid := 'd1d29d1e-b06d-4f49-b0eb-32346e1c2844'; -- Jony / Alex
  categoria constant uuid := '6a097073-936d-4957-8afa-1c434b7449fc';
  n int;
  ultimo_adversario uuid;
begin
  create temp table _jogos on commit drop as
  select m.id, m.scheduled_time as h, m.court,
         (t.dupla ->> 'entryId')::uuid as dupla
  from public.matches m
  cross join lateral (values (m.team_a), (m.team_b)) as t(dupla)
  where m.category_id = categoria and m.scheduled_time is not null;

  -- 1. os 24 jogos continuam lá, dentro do dia
  select count(distinct id) into n from _jogos;
  if n <> 24 then
    raise exception 'Esperava 24 jogos, achei %', n;
  end if;
  if exists (select 1 from _jogos where h < time '13:00' or h > time '18:30') then
    raise exception 'Jogo fora da janela 13:00-18:30';
  end if;

  -- 2. Henrique: nada antes das 16:00, e o último jogo contra o Jony
  if exists (select 1 from _jogos where dupla = henrique and h < time '16:00') then
    raise exception 'João Israel / Henrique Lopez ainda tem jogo antes das 16:00';
  end if;
  select adv.dupla into ultimo_adversario
  from _jogos j
  join _jogos adv on adv.id = j.id and adv.dupla <> henrique
  where j.dupla = henrique
  order by j.h desc
  limit 1;
  if ultimo_adversario is distinct from jony then
    raise exception 'O último jogo do Henrique não é contra o Jony / Alex';
  end if;

  -- 3. Regis / Lucas: nada antes das 14:30
  if exists (select 1 from _jogos where dupla = regis and h < time '14:30') then
    raise exception 'Regis Cl / Lucas A ainda tem jogo antes das 14:30';
  end if;

  -- 4. sem dois jogos na mesma quadra e horário
  if exists (
    select 1 from (select distinct id, h, court from _jogos) x
    group by x.h, x.court having count(*) > 1
  ) then
    raise exception 'Duas partidas na mesma quadra e horário';
  end if;

  -- 5. ninguém em dois jogos ao mesmo tempo
  if exists (select 1 from _jogos group by dupla, h having count(*) > 1) then
    raise exception 'A mesma dupla em dois jogos no mesmo horário';
  end if;

  -- 6. descanso: 30 min de jogo + 30 min de folga = 60 min entre inícios.
  --    O Henrique está liberado pra jogos seguidos (combinado com a dupla).
  if exists (
    select 1
    from _jogos a
    join _jogos b on b.dupla = a.dupla and b.h > a.h
    where a.dupla <> henrique
      and (b.h - a.h) < interval '60 minutes'
  ) then
    raise exception 'Alguma dupla ficou sem descanso entre dois jogos';
  end if;
end $$;

commit;


-- =====================================================================
-- PARTE 3 — GRADE NOVA (só leitura)
-- =====================================================================
select m.scheduled_time as horario, m.court as quadra, g.name as grupo,
       m.team_a->>'name' as dupla_a, m.team_b->>'name' as dupla_b
from public.matches m
join public.groups g on g.id = m.group_id
where m.category_id = '6a097073-936d-4957-8afa-1c434b7449fc'
order by m.scheduled_time, m.court;
