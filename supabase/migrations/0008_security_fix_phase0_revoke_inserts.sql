-- PHASE 0: IMMEDIATE CONTAINMENT
-- Revoke INSERT permissions from clients (anon, authenticated roles)
-- This prevents all browser writes immediately
-- Server will use service_role key which bypasses RLS

REVOKE INSERT ON public.scores FROM anon;
REVOKE INSERT ON public.scores FROM authenticated;

-- Note: Service role key bypasses RLS, so server-side inserts will still work

