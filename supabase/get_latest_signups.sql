-- Get the latest player signups
-- Ordered by profile updated_at (most recent first)

SELECT 
  p.id,
  ua.email,
  p.username,
  p.university_id,
  uni.name AS university_name,
  p.updated_at AS profile_updated_at
FROM public.profiles p
JOIN auth.users ua ON ua.id = p.id
LEFT JOIN public.universities uni ON uni.id = p.university_id
ORDER BY p.updated_at DESC;

