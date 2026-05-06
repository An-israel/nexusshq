-- ── Leave & Time-Off Management ─────────────────────────────────────────────

-- Leave types (configurable by admin)
create table leave_types (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  days_per_year   int  not null default 0,
  color           text not null default 'blue',
  requires_approval boolean not null default true,
  created_at      timestamptz default now()
);

-- Seed default types
insert into leave_types (name, days_per_year, color, requires_approval) values
  ('Annual Leave',         20, 'blue',   true),
  ('Sick Leave',           10, 'amber',  false),
  ('Compassionate Leave',   5, 'purple', true),
  ('Maternity Leave',      90, 'pink',   true),
  ('Paternity Leave',      14, 'teal',   true);

-- Per-employee, per-year balance
create table leave_balances (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users not null,
  leave_type_id   uuid references leave_types not null,
  year            int  not null,
  days_allocated  int  not null default 0,
  days_used       numeric(5,1) not null default 0,
  created_at      timestamptz default now(),
  unique(user_id, leave_type_id, year)
);

-- Leave requests
create table leave_requests (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users not null,
  leave_type_id   uuid references leave_types not null,
  start_date      date not null,
  end_date        date not null,
  days_requested  numeric(5,1) not null,
  reason          text,
  status          text not null default 'pending'
                  check (status in ('pending', 'approved', 'rejected')),
  reviewed_by     uuid references auth.users,
  reviewed_at     timestamptz,
  reviewer_note   text,
  created_at      timestamptz default now()
);

-- ── RLS ─────────────────────────────────────────────────────────────────────

alter table leave_types     enable row level security;
alter table leave_balances  enable row level security;
alter table leave_requests  enable row level security;

-- leave_types: everyone can read; only admins write
create policy "anyone reads leave types"
  on leave_types for select using (true);

create policy "admins manage leave types"
  on leave_types for all
  using (exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin'));

-- leave_balances: employees see own; managers/admins see all
create policy "employees view own balance"
  on leave_balances for select using (user_id = auth.uid());

create policy "managers view all balances"
  on leave_balances for select
  using (exists (select 1 from user_roles where user_id = auth.uid() and role in ('admin','manager')));

create policy "admins manage balances"
  on leave_balances for all
  using (exists (select 1 from user_roles where user_id = auth.uid() and role in ('admin','manager')));

-- leave_requests: employees see/insert own; managers see all & update
create policy "employees view own requests"
  on leave_requests for select using (user_id = auth.uid());

create policy "employees insert own request"
  on leave_requests for insert with check (user_id = auth.uid());

create policy "managers view all requests"
  on leave_requests for select
  using (exists (select 1 from user_roles where user_id = auth.uid() and role in ('admin','manager')));

create policy "managers update requests"
  on leave_requests for update
  using (exists (select 1 from user_roles where user_id = auth.uid() and role in ('admin','manager')));

-- ── Function: auto-initialise balances for a new employee ───────────────────
create or replace function init_leave_balances(p_user_id uuid, p_year int default extract(year from now())::int)
returns void language plpgsql security definer as $$
begin
  insert into leave_balances (user_id, leave_type_id, year, days_allocated)
  select p_user_id, id, p_year, days_per_year
  from   leave_types
  on conflict (user_id, leave_type_id, year) do nothing;
end;
$$;
