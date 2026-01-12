-- SQL Queries to check and test McMaster domain support

-- 1. Check if McMaster is in the universities table
SELECT 
  id,
  name,
  country,
  alpha_two_code,
  website,
  created_at
FROM universities
WHERE LOWER(name) LIKE '%mcmaster%'
ORDER BY name;

-- 2. Check all domains for McMaster (includes subdomains)
SELECT 
  ud.domain,
  u.name AS university_name,
  u.country,
  ud.is_primary,
  ud.created_at
FROM university_domains ud
JOIN universities u ON u.id = ud.university_id
WHERE LOWER(u.name) LIKE '%mcmaster%'
ORDER BY ud.is_primary DESC, ud.domain;

-- 3. Test if specific McMaster domains would be allowed (common variants)
SELECT 
  'mcmaster.ca' AS test_domain,
  is_domain_allowed('mcmaster.ca') AS is_allowed,
  find_university_by_domain('mcmaster.ca') AS university_id;

SELECT 
  'mail.mcmaster.ca' AS test_domain,
  is_domain_allowed('mail.mcmaster.ca') AS is_allowed,
  find_university_by_domain('mail.mcmaster.ca') AS university_id;

SELECT 
  'test@mcmaster.ca' AS test_email,
  is_domain_allowed('test@mcmaster.ca') AS is_allowed,
  find_university_by_domain('test@mcmaster.ca') AS university_id;

SELECT 
  'test@mail.mcmaster.ca' AS test_email,
  is_domain_allowed('test@mail.mcmaster.ca') AS is_allowed,
  find_university_by_domain('test@mail.mcmaster.ca') AS university_id;

-- 4. Check recent signups from McMaster (users with McMaster university_id)
SELECT 
  p.id,
  p.email,
  p.username,
  p.university_id,
  u.name AS university_name,
  u.created_at AS profile_created
FROM profiles p
JOIN universities u ON u.id = p.university_id
WHERE LOWER(u.name) LIKE '%mcmaster%'
ORDER BY p.id DESC  -- UUIDs are roughly chronological
LIMIT 50;

-- 5. Check recent signups from McMaster with missing usernames
SELECT 
  p.id,
  p.email,
  p.username,
  p.university_id,
  u.name AS university_name,
  ua.created_at AS auth_created_at
FROM profiles p
JOIN universities u ON u.id = p.university_id
JOIN auth.users ua ON ua.id = p.id
WHERE LOWER(u.name) LIKE '%mcmaster%'
  AND p.username IS NULL
ORDER BY ua.created_at DESC
LIMIT 50;

-- 6. Count McMaster users by username status
SELECT 
  COUNT(*) AS total_mcmaster_users,
  COUNT(p.username) AS users_with_username,
  COUNT(*) - COUNT(p.username) AS users_without_username
FROM profiles p
JOIN universities u ON u.id = p.university_id
WHERE LOWER(u.name) LIKE '%mcmaster%';

