-- Migration: Add subdomain support to domain matching
-- This allows emails like "mail.utoronto.ca" to match domain "utoronto.ca"
-- 
-- Changes:
-- 1. Updated find_university_by_domain to support subdomain matching
-- 2. Updated is_domain_allowed to use find_university_by_domain

-- Function to find university ID by domain (with subdomain support)
CREATE OR REPLACE FUNCTION find_university_by_domain(p_email_domain TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_university_id UUID;
  v_normalized_domain TEXT;
  v_email_part TEXT;
BEGIN
  -- Normalize input: lowercase and trim
  v_normalized_domain := LOWER(TRIM(p_email_domain));
  
  IF v_normalized_domain IS NULL OR v_normalized_domain = '' THEN
    RETURN NULL;
  END IF;
  
  -- Extract domain from email if '@' is present (handle multiple '@' by taking substring after last '@')
  IF v_normalized_domain LIKE '%@%' THEN
    -- Use reverse/split trick to extract everything after the last '@'
    -- REVERSE -> SPLIT_PART by '@' (takes first part after reversal, which is last part originally) -> REVERSE back
    v_email_part := REVERSE(SPLIT_PART(REVERSE(v_normalized_domain), '@', 1));
    IF v_email_part IS NOT NULL AND v_email_part != '' THEN
      v_normalized_domain := v_email_part;
    END IF;
  END IF;
  
  -- Reject IPv6 literal addresses (containing brackets)
  IF v_normalized_domain LIKE '%[%' OR v_normalized_domain LIKE '%]%' THEN
    RETURN NULL;
  END IF;
  
  -- Reject IPv4-like addresses (conservative check: starts with digit and contains only digits/dots)
  IF v_normalized_domain ~ '^\d+\.' AND v_normalized_domain ~ '^[\d.]+$' THEN
    RETURN NULL;
  END IF;
  
  -- Step 1: Try exact match first (most common case, fastest, uses primary key index)
  SELECT university_id INTO v_university_id
  FROM public.university_domains
  WHERE domain = v_normalized_domain
  LIMIT 1;
  
  IF v_university_id IS NOT NULL THEN
    RETURN v_university_id;
  END IF;
  
  -- Step 2: Fallback to suffix matching (subdomain support)
  -- Match if: user_domain = db_domain OR user_domain ends with '.' || db_domain
  -- This ensures "mail.utoronto.ca" matches "utoronto.ca"
  -- but "notutoronto.ca" does NOT match "utoronto.ca" (no leading dot before match)
  -- Prefer longer matching domains (more specific matches)
  -- Use LIKE pattern to check if domain ends with '.' || db_domain
  -- The pattern '%' || '.' || ud.domain means "anything followed by .domain"
  -- This correctly matches "cs.uwaterloo.ca" ending with ".uwaterloo.ca"
  SELECT ud.university_id INTO v_university_id
  FROM public.university_domains ud
  WHERE v_normalized_domain = ud.domain 
     OR (LENGTH(v_normalized_domain) > LENGTH(ud.domain) 
         AND v_normalized_domain LIKE ('%' || '.' || ud.domain))
  ORDER BY 
    -- Prefer exact matches first (shouldn't happen here, but safe)
    CASE WHEN v_normalized_domain = ud.domain THEN 0 ELSE 1 END,
    -- Prefer longer matching domains (more specific match)
    LENGTH(ud.domain) DESC
  LIMIT 1;
  
  RETURN v_university_id;
END;
$$;

-- Function to check if domain is allowed (returns boolean, uses find_university_by_domain)
CREATE OR REPLACE FUNCTION is_domain_allowed(p_email_domain TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_university_id UUID;
BEGIN
  -- Use find_university_by_domain to check if domain is associated with any university
  -- If a university_id is found, the domain is allowed
  v_university_id := find_university_by_domain(p_email_domain);
  
  RETURN v_university_id IS NOT NULL;
END;
$$;

-- Set function owners to postgres to bypass RLS policies
-- This ensures they can read from university_domains table even with RLS enabled
ALTER FUNCTION find_university_by_domain(TEXT) OWNER TO postgres;
ALTER FUNCTION is_domain_allowed(TEXT) OWNER TO postgres;

-- Grant execute permissions (same as before)
GRANT EXECUTE ON FUNCTION find_university_by_domain(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_domain_allowed(TEXT) TO authenticated, anon;

