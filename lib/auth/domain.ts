import { createClient } from '@/lib/supabase/server';

/**
 * Extract email domain from email address
 * 
 * @param email - Full email address (e.g., "user@example.com")
 * @returns Domain part of email (e.g., "example.com") or null if invalid
 */
export function extractEmailDomain(email: string): string | null {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain || null;
}

/**
 * Find university ID by email domain
 * Uses the backend RPC function to match domain to university
 * 
 * @param emailDomain - Email domain (e.g., "uwaterloo.ca")
 * @returns University ID UUID or null if no match found
 */
export async function findUniversityByDomain(emailDomain: string): Promise<string | null> {
  try {
    const supabase = await createClient();
    
    const { data: universityData, error: universityError } = await supabase
      .rpc('find_university_by_domain', { p_email_domain: emailDomain });

    if (universityError) {
      console.error('Error finding university by domain:', universityError);
      return null;
    }

    return universityData as string | null;
  } catch (error) {
    console.error('Unexpected error finding university by domain:', error);
    return null;
  }
}