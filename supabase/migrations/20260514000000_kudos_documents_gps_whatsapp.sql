-- ============================================================
-- Kudos / recognition feed
-- ============================================================
create table if not exists kudos (
  id             uuid        primary key default gen_random_uuid(),
  workspace_id   uuid        not null references workspaces(id) on delete cascade,
  from_user_id   uuid        not null references auth.users(id) on delete cascade,
  to_user_id     uuid        not null references auth.users(id) on delete cascade,
  message        text        not null check (char_length(message) between 1 and 280),
  emoji          text        not null default '⭐',
  created_at     timestamptz not null default now()
);
alter table kudos enable row level security;

create policy "workspace members read kudos"
  on kudos for select using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

create policy "workspace members insert kudos"
  on kudos for insert with check (
    from_user_id = auth.uid() and
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

create index if not exists kudos_workspace_created
  on kudos(workspace_id, created_at desc);

-- ============================================================
-- Document vault
-- ============================================================
create table if not exists documents (
  id                uuid        primary key default gen_random_uuid(),
  workspace_id      uuid        not null references workspaces(id) on delete cascade,
  user_id           uuid        not null references auth.users(id) on delete cascade,
  uploaded_by       uuid        not null references auth.users(id),
  title             text        not null,
  file_url          text        not null,
  file_size_bytes   bigint,
  mime_type         text,
  doc_type          text        not null default 'other',
  requires_signature boolean    not null default false,
  signed_at         timestamptz,
  signature_text    text,
  created_at        timestamptz not null default now()
);
alter table documents enable row level security;

-- Employees see their own docs; managers see all docs in workspace
create policy "employees see own documents"
  on documents for select using (
    user_id = auth.uid()
    or uploaded_by = auth.uid()
    or exists (
      select 1 from workspace_members wm
      where wm.workspace_id = documents.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('admin', 'manager')
    )
  );

create policy "managers insert documents"
  on documents for insert with check (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = documents.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('admin', 'manager')
    )
  );

-- Managers can update; employees can sign their own
create policy "managers update documents"
  on documents for update using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = documents.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('admin', 'manager')
    )
  );

create policy "employees sign own documents"
  on documents for update using (
    user_id = auth.uid()
  ) with check (
    user_id = auth.uid()
  );

create policy "managers delete documents"
  on documents for delete using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = documents.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('admin', 'manager')
    )
  );

create index if not exists documents_workspace_user
  on documents(workspace_id, user_id);

-- ============================================================
-- GPS clock-in settings on workspaces
-- ============================================================
alter table workspaces
  add column if not exists office_lat           decimal(10,7),
  add column if not exists office_lng           decimal(10,7),
  add column if not exists clock_in_radius_m    integer not null default 500,
  add column if not exists enforce_gps_clockin  boolean not null default false;

-- ============================================================
-- WhatsApp opt-in on profiles
-- ============================================================
alter table profiles
  add column if not exists whatsapp_opt_in boolean not null default false;

-- ============================================================
-- Supabase storage bucket for documents (idempotent)
-- ============================================================
insert into storage.buckets (id, name, public)
  values ('documents', 'documents', false)
  on conflict (id) do nothing;

create policy "authenticated users upload documents"
  on storage.objects for insert with check (
    bucket_id = 'documents' and auth.role() = 'authenticated'
  );

create policy "authenticated users read documents"
  on storage.objects for select using (
    bucket_id = 'documents' and auth.role() = 'authenticated'
  );
