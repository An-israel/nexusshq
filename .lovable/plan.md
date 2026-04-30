## Nexus HQ — Internal Team Management Platform

A full-stack ops platform for managing your team: tasks, attendance, KPIs, warnings, flags, and notifications. Three roles (admin, manager, employee) with role-aware navigation and permissions. Premium dark UI on your exact palette.

### Stack translation (since this project is locked to TanStack Start, not Next.js)
- **Routing/SSR**: TanStack Start v1 + React 19 + Vite 7 (replaces Next.js App Router)
- **DB/Auth/Storage**: Supabase via Lovable Cloud (auto-wired)
- **Email**: Lovable Emails (built-in, replaces Resend — no API key needed)
- **Scheduled jobs**: Public TanStack server routes (`/api/public/*`) called by Supabase `pg_cron` with a shared secret header (replaces Supabase Edge Functions)
- **Timezone**: Fixed work window 09:00–16:00 WAT, late threshold 09:15 WAT, all storage in UTC
- **UI**: shadcn/ui (already installed), Tailwind, Inter font, your exact dark palette

---

### Build phases

**Phase 1 — Foundation**
- Database schema: `profiles`, `kpis`, `tasks`, `task_updates`, `attendance`, `flags`, `notifications` (+ `user_roles` table for safe role storage, separate from `profiles`)
- RLS policies on every table using a `has_role()` SECURITY DEFINER function (prevents RLS recursion and privilege escalation)
- Auto-create `profiles` row + default `employee` role on signup via trigger
- Seed your admin account
- Apply your dark theme palette to Tailwind/CSS variables
- Inter font, base layout shell

**Phase 2 — Auth & shell**
- `/login` (email + password) and `/accept-invite` (set password from invite link)
- `_authenticated` route guard with Supabase session hydration
- Dashboard layout: collapsible sidebar (role-aware nav) + topbar with the live clock-in/out widget
- Stub pages for Dashboard, Notifications, Settings

**Phase 3 — Task management** (the bulk of the build)
- Employee `/tasks` page: summary bar (totals, completed, in-progress, overdue, weekly KPI ring), filter tabs, task list with priority/warning/overdue styling, detail panel with status change + progress slider + note → writes to `task_updates`
- KPI link block in detail panel when `kpi_id` is set
- Manager/Admin `/tasks/assign` form: employee picker, type/priority/due/KPI/warning, on submit → insert task, insert notification, send Lovable email
- Three-dot action menu on Team-view task cards: Escalate to Urgent, Add/Remove Warning, Flag Employee (writes to `flags`, sends notification + email)
- Realtime: `supabase.channel()` subscriptions so updates appear live

**Phase 4 — Attendance**
- Topbar clock widget: live clock, Clock In/Out buttons, elapsed time, late detection at 09:15 WAT, toast feedback
- Employee `/attendance` page: monthly summary cards, color-coded calendar with day popovers, paginated history table
- Admin/Manager `/admin/attendance`: all-employees overview table with department/month/status filters, expandable per-employee calendar, CSV export

**Phase 5 — Team Overview & KPIs**
- `/team` (manager + admin): roster, per-employee task/attendance/flag stats, jump-in to assign tasks or view profile
- `/kpis` (admin): create/edit/delete KPIs per department with target, unit, period
- `/notifications`: list, mark read, deep-link to related task

**Phase 6 — Scheduled jobs (pg_cron + public server routes)**
- `auto-overdue-tasks` (daily 23:01 UTC): mark overdue tasks, notify employees
- `task-reminders` (daily 07:00 UTC): due-today / due-tomorrow / overdue notifications + emails
- `clock-reminders` (08:30 UTC + 15:15 UTC, weekdays): missing clock-in / missing clock-out emails
- All routes protected by HMAC-style shared secret header; pg_cron jobs configured to call the stable `project--{id}.lovable.app` URLs

**Phase 7 — Email templates (Lovable Emails)**
React Email templates, branded to match the app:
- `task-assigned`, `task-due-soon`, `task-overdue`, `warning-issued`, `flag-issued`, `clock-reminder-missed-in`, `clock-reminder-missed-out`, `invite-employee`

---

### Visual design
- Background `#0F0F0F`, cards `#1A1A1A`, borders `#2A2A2A`, secondary text `#9CA3AF`
- Accent blue `#3B82F6`, danger `#EF4444`, warning amber `#F59E0B`, success green `#10B981`
- Overdue cards: `border-l-4 border-red-500`; urgent: red-400; high: amber-400
- Warning badge: `animate-pulse` amber
- Completed: 60% opacity + strikethrough title
- Empty states with clean illustrations, no lorem ipsum anywhere

---

### Security notes
- Roles live in a separate `user_roles` table (NEVER on `profiles`) to prevent privilege escalation
- All role checks use a `has_role(uid, role)` SECURITY DEFINER function
- Service-role key only used in server functions; never shipped to browser
- Public cron routes verified with shared-secret header before any DB write
- Form inputs validated with Zod both client and server side

---

### What I'll deliver in stages
Because of the scope, I'll build it in the 7 phases above and verify each one works before moving on. After phase 1 (schema + auth + shell), you'll see the app shape immediately and can give feedback. Each subsequent phase ships working features end-to-end.

### What you'll need to do (only at the very end)
Lovable Cloud auto-wires Supabase, so you don't manage env vars manually. The only manual step: when we reach the email phase, you'll be prompted in chat to verify a sender email domain (one click, ~2 min). I'll walk you through it then.

Ready to build phase 1?