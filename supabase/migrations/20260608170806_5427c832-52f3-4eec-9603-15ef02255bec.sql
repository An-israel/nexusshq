ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS due_time time;
ALTER TABLE public.recurring_tasks ADD COLUMN IF NOT EXISTS due_time time;