-- Allow assigning tasks with a specific time-of-day deadline (e.g. "due by 5pm
-- today"), not just a date. Additive + nullable so existing rows and queries
-- that treat due_date as a plain date continue to work unchanged.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS due_time time;

ALTER TABLE public.recurring_tasks
  ADD COLUMN IF NOT EXISTS due_time time;
