-- Migration: Fix migrate_guest_scores function to handle auth.uid() NULL case
-- This prevents constraint violations if the function is called without proper auth context

CREATE OR REPLACE FUNCTION public.migrate_guest_scores(target_guest_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get the current authenticated user's ID
  v_user_id := auth.uid();
  
  -- Critical: Check if user is authenticated
  -- Without this check, if auth.uid() is NULL, the UPDATE would set both
  -- user_id = NULL and guest_id = NULL, violating the scores_user_or_guest constraint
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to migrate guest scores';
  END IF;
  
  -- Update all scores with this guest_id to the authenticated user
  -- Only update scores where user_id IS NULL (safety check to avoid overwriting)
  UPDATE public.scores
  SET 
    user_id = v_user_id,
    guest_id = NULL
  WHERE guest_id = target_guest_id
    AND user_id IS NULL;
END;
$function$;

