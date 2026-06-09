-- Add 'announcement' to notification_type enum so posting an announcement can
-- notify workspace members (in-app + email) with its own icon/colour/deep-link,
-- distinct from generic broadcasts and info messages.
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'announcement';
