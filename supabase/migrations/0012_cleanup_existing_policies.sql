-- Cleanup existing policies before applying security fixes
-- This migration drops the vulnerable INSERT policy and consolidates SELECT policies

-- Drop the vulnerable INSERT policy that allows client-side inserts
DROP POLICY IF EXISTS "Score insert policy" ON public.scores;

-- Drop existing SELECT policy (we'll recreate it with a better name)
DROP POLICY IF EXISTS "Scores public select" ON public.scores;

-- Now you can safely apply migrations 0008 and 0009

