-- Get all users with McMaster email who do not have a username
-- This query filters by email domain directly (supports subdomains like mail.mcmaster.ca)

SELECT 
  p.id,
  ua.email,
  p.username,
  p.university_id,
  uni.name AS university_name,
  ua.updated_at AS user_updated_at,
  p.updated_at AS profile_updated_at
FROM public.profiles p
JOIN auth.users ua ON ua.id = p.id
LEFT JOIN public.universities uni ON uni.id = p.university_id
WHERE LOWER(ua.email) LIKE '%@mcmaster.ca'
  AND (p.username IS NULL OR p.username = '')
ORDER BY ua.updated_at DESC;

