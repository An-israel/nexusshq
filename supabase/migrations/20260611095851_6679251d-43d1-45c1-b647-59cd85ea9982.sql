CREATE OR REPLACE FUNCTION public.autofill_workspace_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ws uuid;
BEGIN
  IF NEW.workspace_id IS NULL THEN
    SELECT workspace_id INTO ws
    FROM public.workspace_members
    WHERE user_id = auth.uid() AND is_active = true
    ORDER BY created_at ASC
    LIMIT 1;

    IF ws IS NULL THEN
      RAISE EXCEPTION 'workspace_id is required when no active workspace membership exists';
    END IF;

    NEW.workspace_id := ws;
  END IF;

  RETURN NEW;
END;
$$;

GRANT SELECT (token, passcode) ON public.workspace_invitations TO service_role;