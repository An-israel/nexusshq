-- ========== ENUMS / ROLE TABLE ==========
create type public.app_role as enum ('admin','manager','employee');
create type public.department_type as enum ('management','customer_success','growth','marketing','design','video_editing','operations','other');
create type public.task_priority as enum ('low','medium','high','urgent');
create type public.task_status as enum ('todo','in_progress','completed','overdue');
create type public.task_type as enum ('daily','weekly','one_time');
create type public.kpi_period as enum ('weekly','monthly');
create type public.attendance_status as enum ('present','late','absent','half_day');
create type public.flag_severity as enum ('low','medium','high');
create type public.notification_type as enum ('task_assigned','task_due_soon','task_overdue','warning','flag','kpi_reminder','clock_reminder');

-- ========== PROFILES ==========
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text unique,
  department public.department_type default 'other',
  job_title text,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- ========== USER ROLES (separate for security) ==========
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

-- Security definer role checker
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

-- Convenience: get current user's highest role
create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.user_roles
  where user_id = auth.uid()
  order by case role when 'admin' then 1 when 'manager' then 2 else 3 end
  limit 1;
$$;

-- ========== KPIS ==========
create table public.kpis (
  id uuid primary key default gen_random_uuid(),
  department public.department_type not null,
  title text not null,
  description text,
  target_value numeric not null default 0,
  unit text not null default '',
  period public.kpi_period not null default 'monthly',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.kpis enable row level security;

-- ========== TASKS ==========
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assigned_to uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  kpi_id uuid references public.kpis(id) on delete set null,
  priority public.task_priority not null default 'medium',
  status public.task_status not null default 'todo',
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  task_type public.task_type not null default 'one_time',
  due_date date not null,
  has_warning boolean not null default false,
  warning_message text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.tasks enable row level security;
create index tasks_assigned_to_idx on public.tasks(assigned_to);
create index tasks_status_idx on public.tasks(status);
create index tasks_due_date_idx on public.tasks(due_date);

-- ========== TASK UPDATES (audit log) ==========
create table public.task_updates (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  updated_by uuid references public.profiles(id) on delete set null,
  old_status public.task_status,
  new_status public.task_status,
  old_progress integer,
  new_progress integer,
  note text,
  created_at timestamptz not null default now()
);
alter table public.task_updates enable row level security;

-- ========== ATTENDANCE ==========
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  clock_in timestamptz,
  clock_out timestamptz,
  total_minutes integer,
  status public.attendance_status not null default 'absent',
  created_at timestamptz not null default now(),
  unique (user_id, date)
);
alter table public.attendance enable row level security;
create index attendance_user_date_idx on public.attendance(user_id, date desc);

-- ========== FLAGS ==========
create table public.flags (
  id uuid primary key default gen_random_uuid(),
  flagged_user_id uuid not null references public.profiles(id) on delete cascade,
  flagged_by uuid references public.profiles(id) on delete set null,
  reason text not null,
  severity public.flag_severity not null default 'medium',
  is_resolved boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.flags enable row level security;

-- ========== NOTIFICATIONS ==========
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  message text not null,
  is_read boolean not null default false,
  related_task_id uuid references public.tasks(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
create index notifications_user_idx on public.notifications(user_id, created_at desc);

-- ========== PROFILES RLS ==========
create policy "users view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "managers/admins view all profiles" on public.profiles
  for select using (public.has_role(auth.uid(),'manager') or public.has_role(auth.uid(),'admin'));
create policy "users update own profile" on public.profiles
  for update using (auth.uid() = id);
create policy "admins update any profile" on public.profiles
  for update using (public.has_role(auth.uid(),'admin'));
create policy "admins insert profiles" on public.profiles
  for insert with check (public.has_role(auth.uid(),'admin'));

-- ========== USER_ROLES RLS ==========
create policy "users view own roles" on public.user_roles
  for select using (auth.uid() = user_id);
create policy "admins view all roles" on public.user_roles
  for select using (public.has_role(auth.uid(),'admin'));
create policy "admins manage roles" on public.user_roles
  for all using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- ========== KPIS RLS ==========
create policy "all auth view kpis" on public.kpis
  for select using (auth.uid() is not null);
create policy "admins manage kpis" on public.kpis
  for all using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- ========== TASKS RLS ==========
create policy "employees view own tasks" on public.tasks
  for select using (assigned_to = auth.uid());
create policy "managers/admins view all tasks" on public.tasks
  for select using (public.has_role(auth.uid(),'manager') or public.has_role(auth.uid(),'admin'));
create policy "employees update own tasks" on public.tasks
  for update using (assigned_to = auth.uid());
create policy "managers/admins manage tasks" on public.tasks
  for all using (public.has_role(auth.uid(),'manager') or public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'manager') or public.has_role(auth.uid(),'admin'));

-- ========== TASK UPDATES RLS ==========
create policy "view updates of own tasks" on public.task_updates
  for select using (
    exists(select 1 from public.tasks t where t.id = task_id and t.assigned_to = auth.uid())
    or public.has_role(auth.uid(),'manager') or public.has_role(auth.uid(),'admin')
  );
create policy "insert updates for own/managed tasks" on public.task_updates
  for insert with check (
    updated_by = auth.uid() and (
      exists(select 1 from public.tasks t where t.id = task_id and t.assigned_to = auth.uid())
      or public.has_role(auth.uid(),'manager') or public.has_role(auth.uid(),'admin')
    )
  );

-- ========== ATTENDANCE RLS ==========
create policy "users view own attendance" on public.attendance
  for select using (user_id = auth.uid());
create policy "managers/admins view all attendance" on public.attendance
  for select using (public.has_role(auth.uid(),'manager') or public.has_role(auth.uid(),'admin'));
create policy "users insert own attendance" on public.attendance
  for insert with check (user_id = auth.uid());
create policy "users update own attendance" on public.attendance
  for update using (user_id = auth.uid());
create policy "admins manage attendance" on public.attendance
  for all using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- ========== FLAGS RLS ==========
create policy "users view own flags" on public.flags
  for select using (flagged_user_id = auth.uid());
create policy "managers/admins view all flags" on public.flags
  for select using (public.has_role(auth.uid(),'manager') or public.has_role(auth.uid(),'admin'));
create policy "managers/admins manage flags" on public.flags
  for all using (public.has_role(auth.uid(),'manager') or public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'manager') or public.has_role(auth.uid(),'admin'));

-- ========== NOTIFICATIONS RLS ==========
create policy "users view own notifications" on public.notifications
  for select using (user_id = auth.uid());
create policy "users update own notifications" on public.notifications
  for update using (user_id = auth.uid());
create policy "managers/admins create notifications" on public.notifications
  for insert with check (public.has_role(auth.uid(),'manager') or public.has_role(auth.uid(),'admin') or user_id = auth.uid());

-- ========== AUTO-CREATE PROFILE + ROLE ON SIGNUP ==========
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.email
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'employee')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ========== REALTIME ==========
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.attendance;