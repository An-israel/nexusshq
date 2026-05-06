-- ── Client Portal view audit log ─────────────────────────────────────────────
-- Logs every time a client opens their /track/:token portal page.

create table client_portal_views (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references client_projects on delete cascade not null,
  token       text not null,
  viewed_at   timestamptz default now() not null,
  ip_hint     text    -- first 3 octets only, stored for analytics (no PII)
);

alter table client_portal_views enable row level security;

-- Only admins/managers can read view logs
create policy "managers view portal logs"
  on client_portal_views for select
  using (exists (
    select 1 from user_roles where user_id = auth.uid() and role in ('admin','manager')
  ));

-- Public inserts (no auth) — portal page calls this anonymously
create policy "public inserts portal views"
  on client_portal_views for insert
  with check (true);
