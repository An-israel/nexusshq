-- ── Goals & OKR Tracking ─────────────────────────────────────────────────────

create table objectives (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  description      text,
  owner_id         uuid references auth.users not null,
  department       text,
  period           text not null default '',   -- e.g. "Q2 2026" or "2026"
  status           text not null default 'on_track'
                   check (status in ('on_track','at_risk','behind','completed')),
  progress_percent int  not null default 0,    -- kept in sync by app logic
  start_date       date,
  end_date         date,
  created_at       timestamptz default now()
);

create table key_results (
  id               uuid primary key default gen_random_uuid(),
  objective_id     uuid references objectives on delete cascade not null,
  title            text not null,
  description      text,
  owner_id         uuid references auth.users,
  target_value     numeric not null default 100,
  current_value    numeric not null default 0,
  unit             text    not null default '%',
  created_at       timestamptz default now()
);

create table key_result_updates (
  id               uuid primary key default gen_random_uuid(),
  key_result_id    uuid references key_results on delete cascade not null,
  updated_by       uuid references auth.users not null,
  previous_value   numeric not null,
  new_value        numeric not null,
  note             text,
  created_at       timestamptz default now()
);

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table objectives          enable row level security;
alter table key_results         enable row level security;
alter table key_result_updates  enable row level security;

-- objectives: everyone reads; admins/managers write
create policy "all users view objectives"
  on objectives for select using (true);

create policy "managers manage objectives"
  on objectives for all
  using (exists (
    select 1 from user_roles where user_id = auth.uid() and role in ('admin','manager')
  ));

-- key_results: everyone reads; admins/managers insert/delete; any user can update value
create policy "all users view key results"
  on key_results for select using (true);

create policy "managers insert/delete key results"
  on key_results for insert
  with check (exists (
    select 1 from user_roles where user_id = auth.uid() and role in ('admin','manager')
  ));

create policy "managers delete key results"
  on key_results for delete
  using (exists (
    select 1 from user_roles where user_id = auth.uid() and role in ('admin','manager')
  ));

create policy "any user updates key result progress"
  on key_results for update using (true);

-- key_result_updates: everyone reads; any user inserts their own
create policy "all users view kr updates"
  on key_result_updates for select using (true);

create policy "any user inserts kr update"
  on key_result_updates for insert with check (updated_by = auth.uid());
