-- Migration: Fix auth hook to support subdomains
-- This updates hook_validate_university_email to use the subdomain-aware is_domain_allowed function
-- 
-- Problem: The hook was doing an exact domain match, so emails like "user@cs.uwaterloo.ca"
-- wouldn't match "uwaterloo.ca" in the database
-- 
-- Solution: Use the is_domain_allowed function which already has subdomain support via
-- find_university_by_domain (from migration 0005)

-- Update Auth Hook function to use subdomain-aware validation
-- This function performs the domain check directly to avoid permission issues
CREATE OR REPLACE FUNCTION public.hook_validate_university_email(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_domain TEXT;
  v_normalized_domain TEXT;
  v_email_part TEXT;
  v_university_id UUID;
  v_is_allowed BOOLEAN;
BEGIN
  -- Extract email from the event
  v_email := event->'user'->>'email';
  
  IF v_email IS NULL OR v_email = '' THEN
    RETURN jsonb_build_object(
      'error', jsonb_build_object(
        'message', 'Email is required.',
        'http_code', 400
      )
    );
  END IF;
  
  -- Normalize and extract domain from email (same logic as find_university_by_domain)
  v_normalized_domain := LOWER(TRIM(v_email));
  
  -- Extract domain from email if '@' is present (handle multiple '@' by taking substring after last '@')
  IF v_normalized_domain LIKE '%@%' THEN
    -- Use reverse/split trick to extract everything after the last '@'
    v_email_part := REVERSE(SPLIT_PART(REVERSE(v_normalized_domain), '@', 1));
    IF v_email_part IS NOT NULL AND v_email_part != '' THEN
      v_normalized_domain := v_email_part;
    END IF;
  END IF;
  
  -- Reject IPv6 literal addresses (containing brackets)
  IF v_normalized_domain LIKE '%[%' OR v_normalized_domain LIKE '%]%' THEN
    RETURN jsonb_build_object(
      'error', jsonb_build_object(
        'message', 'Use a university email to sign in.',
        'http_code', 403
      )
    );
  END IF;
  
  -- Reject IPv4-like addresses (conservative check: starts with digit and contains only digits/dots)
  IF v_normalized_domain ~ '^\d+\.' AND v_normalized_domain ~ '^[\d.]+$' THEN
    RETURN jsonb_build_object(
      'error', jsonb_build_object(
        'message', 'Use a university email to sign in.',
        'http_code', 403
      )
    );
  END IF;
  
  -- Step 1: Try exact match first
  SELECT university_id INTO v_university_id
  FROM public.university_domains
  WHERE domain = v_normalized_domain
  LIMIT 1;
  
  IF v_university_id IS NOT NULL THEN
    -- Exact match found, allow signup
    RETURN '{}'::jsonb;
  END IF;
  
  -- Step 2: Try subdomain matching (e.g., "cs.uwaterloo.ca" matches "uwaterloo.ca")
  SELECT ud.university_id INTO v_university_id
  FROM public.university_domains ud
  WHERE v_normalized_domain = ud.domain 
     OR (LENGTH(v_normalized_domain) > LENGTH(ud.domain) 
         AND v_normalized_domain LIKE ('%' || '.' || ud.domain))
  ORDER BY 
    -- Prefer exact matches first
    CASE WHEN v_normalized_domain = ud.domain THEN 0 ELSE 1 END,
    -- Prefer longer matching domains (more specific match)
    LENGTH(ud.domain) DESC
  LIMIT 1;
  
  IF v_university_id IS NOT NULL THEN
    -- Subdomain match found, allow signup
    RETURN '{}'::jsonb;
  END IF;
  
  -- No match found, reject signup
  RETURN jsonb_build_object(
    'error', jsonb_build_object(
      'message', 'Use a university email to sign in.',
      'http_code', 403
    )
  );
END;
$$;

-- Grant schema usage to supabase_auth_admin (required for hook execution)
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;

-- Set helper function owners to postgres to bypass RLS policies
-- This ensures they can read from university_domains table even with RLS enabled
ALTER FUNCTION public.is_domain_allowed(TEXT) OWNER TO postgres;
ALTER FUNCTION public.find_university_by_domain(TEXT) OWNER TO postgres;

-- Grant SELECT on university_domains table to supabase_auth_admin
-- This is needed even though functions are SECURITY DEFINER, as the functions
-- may need to access the table through the caller's permissions in some contexts
GRANT SELECT ON public.university_domains TO supabase_auth_admin;

-- Grant execute on helper functions to supabase_auth_admin (needed by the hook)
GRANT EXECUTE ON FUNCTION public.is_domain_allowed(TEXT) TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.find_university_by_domain(TEXT) TO supabase_auth_admin;

-- Set function owner to postgres (superuser) to bypass RLS policies
-- This is necessary because the university_domains table has RLS enabled
-- and SECURITY DEFINER functions still respect RLS unless owned by a role that bypasses it
ALTER FUNCTION public.hook_validate_university_email(jsonb) OWNER TO postgres;

-- Grant execute on auth hook function to supabase_auth_admin only
GRANT EXECUTE ON FUNCTION public.hook_validate_university_email(jsonb) TO supabase_auth_admin;

-- Revoke from other roles for security
REVOKE EXECUTE ON FUNCTION public.hook_validate_university_email(jsonb) FROM authenticated, anon, public;

