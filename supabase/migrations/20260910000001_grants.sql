-- Fix: tabelas criadas via SQL Editor não recebem GRANT automático pros
-- roles anon/authenticated (diferente de tabelas criadas pelo Table Editor).
-- Sem isso, toda query falha com "permission denied for table X" ANTES
-- mesmo de a RLS ser avaliada. RLS continua sendo a barreira real —
-- estes grants são só a permissão de "poder tentar", por role.

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on table players to anon, authenticated;
grant select, insert, update, delete on table tournaments to anon, authenticated;
grant select, insert, update, delete on table categories to anon, authenticated;
grant select, insert, update, delete on table entries to anon, authenticated;
grant select, insert, update, delete on table groups to anon, authenticated;
grant select, insert, update, delete on table group_entries to anon, authenticated;
grant select, insert, update, delete on table matches to anon, authenticated;

-- garante que tabelas futuras criadas neste schema já saiam com o grant certo
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
