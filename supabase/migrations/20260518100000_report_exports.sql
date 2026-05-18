create table if not exists public.report_exports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  export_type text not null check (export_type in ('csv', 'pdf')),
  period_label text not null,
  generated_by uuid references public.profiles(id) on delete set null,
  generated_at timestamptz not null default now(),
  filters jsonb default '{}'
);
alter table public.report_exports enable row level security;

-- Admins and managers can view/insert for their workspace
create policy "workspace members view exports"
  on public.report_exports for select using (
    workspace_id in (
      select workspace_id from public.workspace_members where user_id = auth.uid()
      and role in ('admin', 'manager')
    )
  );

create policy "workspace members insert exports"
  on public.report_exports for insert with check (
    workspace_id in (
      select workspace_id from public.workspace_members where user_id = auth.uid()
      and role in ('admin', 'manager')
    )
  );

create index if not exists report_exports_workspace_idx
  on public.report_exports(workspace_id, generated_at desc);
