import { createClient } from '@/lib/supabase/server';
import { extractEmailDomain } from './domain-utils';

// Re-export for server-side convenience
export { extractEmailDomain };

/**
 * Check if an email domain is allowed (exists in university_domains table)
 * Server-safe function that checks the allowlist
 * 
 * @param email - Full email address (e.g., "user@uwaterloo.ca")
 * @returns true if domain is in allowlist, false otherwise
 */
export async function isUniversityDomainAllowed(email: string): Promise<boolean> {
  try {
    const domain = extractEmailDomain(email);
    if (!domain) {
      return false;
    }

    const supabase = await createClient();
    
    const { data, error } = await supabase
      .rpc('is_domain_allowed', { p_email_domain: domain });

    if (error) {
      console.error('Error checking domain allowlist:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Unexpected error checking domain allowlist:', error);
    return false;
  }
}

/**
 * Find university ID by email domain
 * Uses the backend RPC function to match domain to university
 * Supports subdomains (e.g., "mail.utoronto.ca" matches "utoronto.ca")
 * Can accept either full email or domain string
 * 
 * @param emailDomain - Email domain (e.g., "uwaterloo.ca") or full email (e.g., "user@mail.utoronto.ca")
 * @returns University ID UUID or null if no match found
 */
export async function findUniversityByDomain(emailDomain: string): Promise<string | null> {
  try {
    const supabase = await createClient();
    
    // The SQL function now handles both emails and domains, so we can pass as-is
    // Since the SQL function handles extraction, passing full email is safe
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