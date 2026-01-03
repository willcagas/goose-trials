-- Migration: University domain validation for auth

-- Function to find university ID by domain (if not exists)
CREATE OR REPLACE FUNCTION find_university_by_domain(p_email_domain TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_university_id UUID;
BEGIN
  SELECT university_id INTO v_university_id
  FROM public.university_domains
  WHERE domain = LOWER(TRIM(p_email_domain))
  LIMIT 1;
  
  RETURN v_university_id;
END;
$$;

-- Function to check if domain is allowed (returns boolean)
CREATE OR REPLACE FUNCTION is_domain_allowed(p_email_domain TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM public.university_domains
    WHERE domain = LOWER(TRIM(p_email_domain))
  ) INTO v_exists;
  
  RETURN v_exists;
END;
$$;

-- Function to validate email domain for auth (used by auth hook)
-- This function will be called by Supabase Auth Hook to validate user creation
CREATE OR REPLACE FUNCTION validate_university_domain(p_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_domain TEXT;
  v_is_allowed BOOLEAN;
BEGIN
  -- Extract domain from email
  IF p_email IS NULL OR p_email = '' THEN
    RETURN 'Email is required';
  END IF;
  
  -- Extract domain (everything after @)
  v_domain := LOWER(TRIM(SPLIT_PART(p_email, '@', 2)));
  
  IF v_domain IS NULL OR v_domain = '' THEN
    RETURN 'Invalid email format';
  END IF;
  
  -- Check if domain exists in university_domains
  SELECT is_domain_allowed(v_domain) INTO v_is_allowed;
  
  IF NOT v_is_allowed THEN
    RETURN 'Use a university email to sign in.';
  END IF;
  
  -- Domain is allowed
  RETURN NULL;
END;
$$;

-- Auth Hook function for "Before User Created" event
-- This function is called by Supabase Auth Hook to validate user creation
CREATE OR REPLACE FUNCTION public.hook_validate_university_email(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email TEXT;
  v_domain TEXT;
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
  
  -- Extract and normalize domain
  v_domain := LOWER(TRIM(SPLIT_PART(v_email, '@', 2)));
  
  IF v_domain IS NULL OR v_domain = '' THEN
    RETURN jsonb_build_object(
      'error', jsonb_build_object(
        'message', 'Invalid email format.',
        'http_code', 400
      )
    );
  END IF;
  
  -- Check if domain exists in university_domains
  SELECT EXISTS(
    SELECT 1
    FROM public.university_domains
    WHERE domain = v_domain
  ) INTO v_is_allowed;
  
  IF NOT v_is_allowed THEN
    RETURN jsonb_build_object(
      'error', jsonb_build_object(
        'message', 'Use a university email to sign in.',
        'http_code', 403
      )
    );
  END IF;
  
  -- Domain is allowed, return empty jsonb to allow user creation
  RETURN '{}'::jsonb;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION find_university_by_domain(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_domain_allowed(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION validate_university_domain(TEXT) TO authenticated, anon, service_role;

-- Grant execute on auth hook function to supabase_auth_admin only
GRANT EXECUTE ON FUNCTION public.hook_validate_university_email(jsonb) TO supabase_auth_admin;

-- Revoke from other roles for security
REVOKE EXECUTE ON FUNCTION public.hook_validate_university_email(jsonb) FROM authenticated, anon, public;

