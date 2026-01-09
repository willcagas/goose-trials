// Format utilities

/**
 * Get the client's timezone
 * Returns the timezone string (e.g., "America/New_York", "Europe/London")
 * Falls back to UTC if timezone detection fails
 */
export function getClientTimezone(): string {
  if (typeof window === 'undefined') {
    // Server-side: return UTC
    return 'UTC';
  }
  
  try {
    // Use Intl API to detect timezone
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    // Fallback to UTC if detection fails
    return 'UTC';
  }
}

/**
 * Format a date string (from UTC database) to the client's local timezone
 * 
 * @param dateString - ISO date string from database (UTC)
 * @param options - Intl.DateTimeFormatOptions for formatting
 * @returns Formatted date string in client's timezone
 */
export function formatDateInTimezone(
  dateString: string,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }
): string {
  const timezone = getClientTimezone();
  
  // Ensure the date string is treated as UTC
  // Supabase returns timestamps in ISO format, but we need to ensure UTC
  let utcDateString = dateString.trim();
  
  // Check if it already has timezone info
  const hasTimezone = utcDateString.includes('Z') || 
                      /[+-]\d{2}:?\d{2}$/.test(utcDateString) ||
                      /[+-]\d{4}$/.test(utcDateString);
  
  // If it doesn't have timezone info, treat as UTC
  if (!hasTimezone) {
    // Handle PostgreSQL timestamp format (YYYY-MM-DD HH:MM:SS)
    if (utcDateString.includes(' ')) {
      utcDateString = utcDateString.replace(' ', 'T') + 'Z';
    } else if (utcDateString.includes('T') && !utcDateString.endsWith('Z')) {
      // Has T but no timezone, append Z
      utcDateString = utcDateString + 'Z';
    } else if (!utcDateString.includes('T')) {
      // Just a date, append T00:00:00Z
      utcDateString = utcDateString + 'T00:00:00Z';
    }
  }
  
  const date = new Date(utcDateString);
  
  // Validate date is valid
  if (isNaN(date.getTime())) {
    console.warn('Invalid date string:', dateString, '->', utcDateString);
    return dateString; // Return original if invalid
  }
  
  // Use Intl.DateTimeFormat for reliable timezone conversion
  const formatter = new Intl.DateTimeFormat('en-US', {
    ...options,
    timeZone: timezone,
  });
  
  return formatter.format(date);
}

/**
 * Format a date for leaderboard "Achieved" column
 * Shows date in client's timezone
 */
export function formatLeaderboardDate(dateString: string): string {
  return formatDateInTimezone(dateString, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a date for result cards (with time)
 * Shows date and time in client's timezone
 */
export function formatResultDate(date: Date): string {
  const timezone = getClientTimezone();
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  });
  return formatter.format(date);
}

/**
 * Format a date for top scores list (short format)
 * Shows month and day in client's timezone
 */
export function formatShortDate(dateString: string): string {
  return formatDateInTimezone(dateString, {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a date for profile "Playing Since" (month and year only)
 * Shows month and year in client's timezone
 */
export function formatMonthYear(dateString: string): string {
  return formatDateInTimezone(dateString, {
    month: 'short',
    year: 'numeric',
  });
}
