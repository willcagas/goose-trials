-- PHASE 2: ROW LEVEL SECURITY POLICIES
-- Enable RLS and create read-only policies for clients
-- No INSERT policies for anon/authenticated - server uses service_role key

-- Enable RLS on scores table
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own scores
CREATE POLICY "users_read_own_scores" ON public.scores
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can read all scores (for leaderboards)
-- This allows public read access for leaderboard functionality
CREATE POLICY "public_read_all_scores" ON public.scores
  FOR SELECT
  USING (true);

-- Policy: Users can read guest scores associated with their guest_id
-- This is tricky since guest_id is stored client-side. For now, we rely on 
-- the service role for guest score reads in server-side queries.
-- If you need client-side guest score reads, you'd need to pass guest_id through session or JWT claims

-- Note: No INSERT policy for anon or authenticated roles
-- All inserts must go through server endpoint using service_role key

-- Note: No UPDATE or DELETE policies needed if scores are immutable
-- (recommended: scores should be append-only)

