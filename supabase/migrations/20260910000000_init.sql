-- Torneio SaaS — schema inicial
-- Aplique este arquivo inteiro no SQL Editor do Supabase (Project > SQL Editor > New query).

create extension if not exists pgcrypto;

-- =====================================================================
-- TABELAS
-- =====================================================================

-- Banco de jogadores do organizador. Privado: nunca lido pelo espectador
-- (os nomes já são "congelados" dentro de entries/matches).
create table players (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  side text check (side in ('direita', 'esquerda', 'ambos')),
  phone text,
  notes text,
  created_at timestamptz not null default now()
);
create index players_owner_id_idx on players (owner_id);

create table tournaments (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  public_code text not null unique,
  courts text[] not null default '{}',
  start_time time not null default '09:00',
  created_at timestamptz not null default now()
);
create index tournaments_organizer_id_idx on tournaments (organizer_id);

create table categories (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments (id) on delete cascade,
  name text not null,
  format text not null check (format in ('grupos', 'mata', 'americano', 'super8')),
  team_type text not null check (team_type in ('duplas', 'individual')),
  americano_type text check (americano_type in ('rotativo', 'fixas')),
  -- Como a partida é decidida: 1 set decide, ou melhor de 3 (2 sets pra vencer).
  sets_to_win smallint not null default 2 check (sets_to_win in (1, 2)),
  max_sets smallint not null default 3 check (max_sets in (1, 3)),
  -- outras opções específicas do formato (numGroups, rounds, duration_minutes, ...)
  config jsonb not null default '{}',
  created_at timestamptz not null default now(),
  constraint sets_config_consistent check (
    (sets_to_win = 1 and max_sets = 1) or (sets_to_win = 2 and max_sets = 3)
  )
);
create index categories_tournament_id_idx on categories (tournament_id);

-- Participante fixo de uma categoria (dupla ou individual).
create table entries (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories (id) on delete cascade,
  player_id_1 uuid not null references players (id) on delete restrict,
  player_id_2 uuid references players (id) on delete restrict,
  seed int,
  created_at timestamptz not null default now()
);
create index entries_category_id_idx on entries (category_id);

create table groups (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index groups_category_id_idx on groups (category_id);

create table group_entries (
  group_id uuid not null references groups (id) on delete cascade,
  entry_id uuid not null references entries (id) on delete cascade,
  primary key (group_id, entry_id)
);

-- Tabela central: espelha o objeto "match" do protótipo.
create table matches (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories (id) on delete cascade,
  group_id uuid references groups (id) on delete set null,
  stage text not null check (
    stage in ('group', 'bracket', 'americano_round', 'super8_round', 'super8_final_a', 'super8_final_b')
  ),
  round int,
  bracket_slot int,
  court text,
  scheduled_time time,
  -- {entryId?, playerIds: uuid[], name, bye?}
  team_a jsonb,
  team_b jsonb,
  -- até 3 sets: [{a: int|null, b: int|null}, ...]
  sets jsonb not null default '[]',
  completed boolean not null default false,
  winner_side text check (winner_side in ('A', 'B')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index matches_category_id_idx on matches (category_id);
create index matches_group_id_idx on matches (group_id);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger matches_set_updated_at
  before update on matches
  for each row
  execute function set_updated_at();

-- =====================================================================
-- HELPERS DE AUTORIZAÇÃO (usados pelas policies de RLS abaixo)
-- =====================================================================

create or replace function auth_owns_tournament(t_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from tournaments where id = t_id and organizer_id = auth.uid()
  );
$$;

create or replace function auth_owns_category(c_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from categories c
    join tournaments t on t.id = c.tournament_id
    where c.id = c_id and t.organizer_id = auth.uid()
  );
$$;

create or replace function auth_owns_group(g_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from groups g
    join categories c on c.id = g.category_id
    join tournaments t on t.id = c.tournament_id
    where g.id = g_id and t.organizer_id = auth.uid()
  );
$$;

-- =====================================================================
-- RLS
--
-- Tudo (exceto players) tem SELECT público — é o que permite o link
-- público funcionar sem login E o Supabase Realtime entregar updates a
-- espectadores anônimos (Realtime respeita a RLS de SELECT da tabela).
-- INSERT/UPDATE/DELETE é restrito ao organizador dono do torneio.
-- `players` (tem telefone/notas) é 100% privado ao owner.
-- =====================================================================

alter table players enable row level security;
alter table tournaments enable row level security;
alter table categories enable row level security;
alter table entries enable row level security;
alter table groups enable row level security;
alter table group_entries enable row level security;
alter table matches enable row level security;

-- players: totalmente privado
create policy players_select_own on players
  for select using (owner_id = auth.uid());
create policy players_insert_own on players
  for insert with check (owner_id = auth.uid());
create policy players_update_own on players
  for update using (owner_id = auth.uid());
create policy players_delete_own on players
  for delete using (owner_id = auth.uid());

-- tournaments: leitura pública, escrita só do organizador
create policy tournaments_select_public on tournaments
  for select using (true);
create policy tournaments_insert_own on tournaments
  for insert with check (organizer_id = auth.uid());
create policy tournaments_update_own on tournaments
  for update using (organizer_id = auth.uid());
create policy tournaments_delete_own on tournaments
  for delete using (organizer_id = auth.uid());

-- categories
create policy categories_select_public on categories
  for select using (true);
create policy categories_insert_own on categories
  for insert with check (auth_owns_tournament(tournament_id));
create policy categories_update_own on categories
  for update using (auth_owns_tournament(tournament_id));
create policy categories_delete_own on categories
  for delete using (auth_owns_tournament(tournament_id));

-- entries
create policy entries_select_public on entries
  for select using (true);
create policy entries_insert_own on entries
  for insert with check (auth_owns_category(category_id));
create policy entries_update_own on entries
  for update using (auth_owns_category(category_id));
create policy entries_delete_own on entries
  for delete using (auth_owns_category(category_id));

-- groups
create policy groups_select_public on groups
  for select using (true);
create policy groups_insert_own on groups
  for insert with check (auth_owns_category(category_id));
create policy groups_update_own on groups
  for update using (auth_owns_category(category_id));
create policy groups_delete_own on groups
  for delete using (auth_owns_category(category_id));

-- group_entries
create policy group_entries_select_public on group_entries
  for select using (true);
create policy group_entries_insert_own on group_entries
  for insert with check (auth_owns_group(group_id));
create policy group_entries_delete_own on group_entries
  for delete using (auth_owns_group(group_id));

-- matches
create policy matches_select_public on matches
  for select using (true);
create policy matches_insert_own on matches
  for insert with check (auth_owns_category(category_id));
create policy matches_update_own on matches
  for update using (auth_owns_category(category_id));
create policy matches_delete_own on matches
  for delete using (auth_owns_category(category_id));

-- =====================================================================
-- REALTIME
-- Garante que a tabela matches está na publicação usada pelo Realtime.
-- =====================================================================
alter publication supabase_realtime add table matches;
