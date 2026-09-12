-- Data do torneio.
--
-- Até aqui o torneio só tinha `start_time` (hora, sem dia), então a data
-- vivia dentro do nome ("Capicnhos Cup 11/09") — invisível para o app e
-- impossível de editar sem renomear o torneio.
--
-- Nullable de propósito: os torneios que já existem não têm data, e
-- inventar uma seria pior do que deixar em branco.
--
-- Puramente informativa: não entra em nenhum cálculo de agenda. Os
-- horários dos jogos continuam vindo de `start_time` + duração.

alter table public.tournaments
  add column if not exists event_date date;

comment on column public.tournaments.event_date is
  'Dia do torneio, só para exibição. A grade de jogos usa start_time.';

-- Grants são por tabela e já cobrem colunas novas; RLS idem (é por linha).
-- Nada a fazer além disto.
