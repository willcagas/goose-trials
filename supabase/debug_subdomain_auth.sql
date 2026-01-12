-- SQL Tests to Debug Subdomain Email Authentication Issue
-- Run these queries in Supabase SQL Editor to isolate the problem
--
-- QUICK DIAGNOSTIC: Run this first to see overall status
-- ============================================
SELECT 
  'QUICK DIAGNOSTIC' as test_name,
  (SELECT COUNT(*) FROM public.university_domains WHERE domain = 'uwaterloo.ca') > 0 as uwaterloo_exists,
  find_university_by_domain('cs.uwaterloo.ca') IS NOT NULL as subdomain_match_works,
  is_domain_allowed('cs.uwaterloo.ca') as is_allowed_result,
  (SELECT proname FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid 
   WHERE n.nspname = 'public' AND p.proname = 'hook_validate_university_email') IS NOT NULL as hook_function_exists;

-- ============================================
-- TEST 1: Check if uwaterloo.ca exists in database
-- ============================================
SELECT 
  domain, 
  university_id,
  is_primary
FROM public.university_domains
WHERE domain = 'uwaterloo.ca'
   OR domain LIKE '%.uwaterloo.ca'
ORDER BY domain;

-- ============================================
-- TEST 2: Check all University of Waterloo domains
-- ============================================
SELECT 
  ud.domain,
  u.name as university_name,
  ud.is_primary
FROM public.university_domains ud
JOIN public.universities u ON ud.university_id = u.id
WHERE u.name ILIKE '%waterloo%'
   OR ud.domain LIKE '%waterloo%'
ORDER BY ud.domain;

-- ============================================
-- TEST 3: Test find_university_by_domain with exact match
-- ============================================
SELECT 
  'uwaterloo.ca' as test_domain,
  find_university_by_domain('uwaterloo.ca') as university_id,
  CASE 
    WHEN find_university_by_domain('uwaterloo.ca') IS NOT NULL 
    THEN 'PASS: Found university'
    ELSE 'FAIL: No university found'
  END as result;

-- ============================================
-- TEST 4: Test find_university_by_domain with subdomain (cs.uwaterloo.ca)
-- ============================================
SELECT 
  'cs.uwaterloo.ca' as test_domain,
  find_university_by_domain('cs.uwaterloo.ca') as university_id,
  CASE 
    WHEN find_university_by_domain('cs.uwaterloo.ca') IS NOT NULL 
    THEN 'PASS: Found university'
    ELSE 'FAIL: No university found'
  END as result;

-- ============================================
-- TEST 5: Test find_university_by_domain with full email
-- ============================================
SELECT 
  'user@cs.uwaterloo.ca' as test_email,
  find_university_by_domain('user@cs.uwaterloo.ca') as university_id,
  CASE 
    WHEN find_university_by_domain('user@cs.uwaterloo.ca') IS NOT NULL 
    THEN 'PASS: Found university'
    ELSE 'FAIL: No university found'
  END as result;

-- ============================================
-- TEST 6: Test is_domain_allowed with exact match
-- ============================================
SELECT 
  'uwaterloo.ca' as test_domain,
  is_domain_allowed('uwaterloo.ca') as is_allowed,
  CASE 
    WHEN is_domain_allowed('uwaterloo.ca') = true 
    THEN 'PASS: Domain allowed'
    ELSE 'FAIL: Domain not allowed'
  END as result;

-- ============================================
-- TEST 7: Test is_domain_allowed with subdomain (cs.uwaterloo.ca)
-- ============================================
SELECT 
  'cs.uwaterloo.ca' as test_domain,
  is_domain_allowed('cs.uwaterloo.ca') as is_allowed,
  CASE 
    WHEN is_domain_allowed('cs.uwaterloo.ca') = true 
    THEN 'PASS: Domain allowed'
    ELSE 'FAIL: Domain not allowed'
  END as result;

-- ============================================
-- TEST 8: Test is_domain_allowed with full email
-- ============================================
SELECT 
  'user@cs.uwaterloo.ca' as test_email,
  is_domain_allowed('user@cs.uwaterloo.ca') as is_allowed,
  CASE 
    WHEN is_domain_allowed('user@cs.uwaterloo.ca') = true 
    THEN 'PASS: Domain allowed'
    ELSE 'FAIL: Domain not allowed'
  END as result;

-- ============================================
-- TEST 9: Check if hook_validate_university_email function exists
-- ============================================
SELECT 
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type,
  p.proowner::regrole as owner,
  p.prosecdef as is_security_definer
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'hook_validate_university_email';

-- ============================================
-- TEST 10: Check function permissions
-- ============================================
SELECT 
  p.proname as function_name,
  r.rolname as grantee,
  has_function_privilege(r.rolname, p.oid, 'EXECUTE') as can_execute
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
CROSS JOIN pg_roles r
WHERE n.nspname = 'public'
  AND p.proname = 'hook_validate_university_email'
  AND r.rolname IN ('supabase_auth_admin', 'postgres', 'authenticated', 'anon')
ORDER BY p.proname, r.rolname;

-- ============================================
-- TEST 11: Check table permissions for supabase_auth_admin
-- ============================================
SELECT 
  has_table_privilege('supabase_auth_admin', 'public.university_domains', 'SELECT') as can_select,
  has_table_privilege('supabase_auth_admin', 'public.universities', 'SELECT') as can_select_universities;

-- ============================================
-- TEST 12: Test hook function directly with exact domain email (should pass)
-- ============================================
SELECT 
  'user@uwaterloo.ca' as test_email,
  hook_validate_university_email(
    jsonb_build_object(
      'user', jsonb_build_object('email', 'user@uwaterloo.ca')
    )
  ) as result;

-- ============================================
-- TEST 13: Test hook function directly with subdomain email (should pass)
-- ============================================
SELECT 
  'user@cs.uwaterloo.ca' as test_email,
  hook_validate_university_email(
    jsonb_build_object(
      'user', jsonb_build_object('email', 'user@cs.uwaterloo.ca')
    )
  ) as result;

-- ============================================
-- TEST 14: Test hook function with invalid domain (should fail with error)
-- ============================================
SELECT 
  'user@invalid-domain.com' as test_email,
  hook_validate_university_email(
    jsonb_build_object(
      'user', jsonb_build_object('email', 'user@invalid-domain.com')
    )
  ) as result;

-- ============================================
-- TEST 15: Check function source code (to verify it's the correct version)
-- ============================================
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'hook_validate_university_email';

-- ============================================
-- TEST 16: Check if function has SET search_path (from migration 0006)
-- ============================================
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) LIKE '%SET search_path%' as has_search_path_set,
  CASE 
    WHEN pg_get_functiondef(p.oid) LIKE '%v_normalized_domain LIKE%' 
    THEN 'PASS: Has subdomain matching logic'
    ELSE 'FAIL: Missing subdomain matching logic'
  END as subdomain_check
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'hook_validate_university_email';

-- ============================================
-- TEST 17: Manual subdomain matching test (replicate hook logic)
-- ============================================
WITH test_domain AS (
  SELECT 'cs.uwaterloo.ca'::text as v_normalized_domain
)
SELECT 
  td.v_normalized_domain,
  -- Exact match
  (SELECT COUNT(*) FROM public.university_domains ud 
   WHERE ud.domain = td.v_normalized_domain) as exact_match_count,
  -- Subdomain match (like in hook)
  (SELECT COUNT(*) FROM public.university_domains ud 
   WHERE td.v_normalized_domain = ud.domain 
      OR (LENGTH(td.v_normalized_domain) > LENGTH(ud.domain) 
          AND td.v_normalized_domain LIKE ('%' || '.' || ud.domain))) as subdomain_match_count
FROM test_domain td;

-- ============================================
-- TEST 18: Check for RLS policies that might block access
-- ============================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'university_domains';

-- ============================================
-- TEST 19: Test as different roles (if possible)
-- ============================================
-- Note: You may need to run this with appropriate privileges
-- This tests if the function can access the table when called by supabase_auth_admin
DO $$
DECLARE
  v_result jsonb;
BEGIN
  -- Try to simulate what the hook does
  SELECT hook_validate_university_email(
    jsonb_build_object(
      'user', jsonb_build_object('email', 'user@cs.uwaterloo.ca')
    )
  ) INTO v_result;
  
  RAISE NOTICE 'Hook result for cs.uwaterloo.ca: %', v_result;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ERROR in hook: % - %', SQLSTATE, SQLERRM;
END $$;

-- ============================================
-- TEST 20: Check function execution context and errors
-- ============================================
-- This will help identify if there are any execution errors
DO $$
DECLARE
  v_result jsonb;
  v_error_text text;
BEGIN
  BEGIN
    SELECT hook_validate_university_email(
      jsonb_build_object(
        'user', jsonb_build_object('email', 'user@cs.uwaterloo.ca')
      )
    ) INTO v_result;
    
    RAISE NOTICE 'SUCCESS: Result is %', v_result;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_text = MESSAGE_TEXT;
    RAISE NOTICE 'ERROR: %', v_error_text;
    RAISE;
  END;
END $$;

