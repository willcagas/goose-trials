-- Get the earliest signups for all users who have a username
-- Ordered by user creation date (earliest first)

SELECT 
  p.id,
  ua.email,
  p.username,
  p.university_id,
  uni.name AS university_name,
  ua.created_at AS user_created_at,
  p.created_at AS profile_created_at
FROM public.profiles p
JOIN auth.users ua ON ua.id = p.id
LEFT JOIN public.universities uni ON uni.id = p.university_id
WHERE p.username IS NOT NULL 
  AND p.username != ''
ORDER BY ua.created_at ASC;

