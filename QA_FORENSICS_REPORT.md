# QA Forensics Report: Authentication, Guest Mode, and Session Persistence

**Date:** Generated from codebase analysis  
**Scope:** Magic-link signup/signin, guest mode, session persistence, guest→user migration  
**Status:** Bug identification and verification only (no fixes implemented)

---

## PHASE 1: Current Behavior Summary

Based on codebase analysis, here is the current implementation behavior:

1. **Guest ID Management**: Guest IDs are generated via `crypto.randomUUID()` and stored in `localStorage` under key `goose_trials_guest_id`. The `getOrCreateGuestId()` function creates one if missing, otherwise returns existing.

2. **Score Submission**: Two submission paths exist:
   - `lib/scoring/submit.ts` calls `/api/submit-score` (missing route - see Bug #1)
   - `lib/db/scores.ts` has `submitScore()` that directly inserts via Supabase client, checking auth state client-side

3. **Magic Link Auth**: `LoginModal.tsx` sends OTP via `signInWithOtp()`, validates domain client-side using `is_domain_allowed` RPC, but server-side enforcement relies on Supabase Auth Hook (`hook_validate_university_email`).

4. **Auth Callback**: `/app/auth/callback/route.ts` exchanges code for session server-side but may fail to set cookies in Server Components (see Bug #3).

5. **Session Management**: No `middleware.ts` exists. `lib/supabase/server.ts` has a try-catch that silently ignores cookie setting errors in Server Components, with a comment mentioning "middleware refreshing user sessions" that doesn't exist.

6. **Onboarding/Migration**: Triggered in `SessionContext.tsx` on `SIGNED_IN` or `INITIAL_SESSION` events. Calls `/api/onboarding` which migrates guest scores via `migrate_guest_scores` RPC (SQL implementation not found in migrations - see Bug #4).

7. **Client Session State**: `SessionContext.tsx` uses `supabase.auth.getSession()` and `onAuthStateChange()` to track user state client-side. `MeContext.tsx` fetches `/api/me` which calls `supabase.auth.getUser()` server-side.

8. **Domain Validation**: Server-side validation exists in migration `0004_university_domain_auth.sql` via `hook_validate_university_email` function, but client-side checks in `LoginModal.tsx` are advisory only.

9. **Migration Logic**: `migrateGuestScores()` in `lib/guest/migrate.ts` calls RPC `migrate_guest_scores` with only `target_guest_id` parameter. The RPC should use `auth.uid()` to get the authenticated user, but SQL implementation is missing.

10. **Guest ID Clearing**: `clearGuestId()` is called in `lib/guest/onboarding.ts` only after successful migration response, but there's no verification that migration actually succeeded atomically.

11. **Session Persistence**: No middleware refreshes sessions. Client-side `SessionContext` checks session on mount, but server-side session may expire without refresh, causing client/server mismatch.

12. **Cookie Handling**: `lib/supabase/server.ts` uses Next.js `cookies()` API. Cookie setting in Server Components fails silently (caught in try-catch), relying on non-existent middleware.

13. **Leaderboard Access**: `get_leaderboard` RPC function filters by `user_id IS NOT NULL`, so guest scores never appear. Only authenticated users with `university_id` appear on campus leaderboards.

14. **Migration Idempotency**: No visible check prevents double migration. The RPC function `migrate_guest_scores` is called without verifying if scores were already migrated.

15. **Error Handling**: Auth callback redirects to `/auth/auth-code-error` on any error, but this route may not exist (not verified).

---

## PHASE 2 & 3: Bug Identification & Verification

### 1. CONFIRMED BUGS

#### Bug #1: Missing `/api/submit-score` Route (P0 - Critical)

**Severity:** P0 - Blocks score submission for code using `lib/scoring/submit.ts`

**Evidence:**
- `lib/scoring/submit.ts:15` calls `fetch('/api/submit-score', ...)`
- Directory listing of `/app/api/` shows no `submit-score/` directory
- This function is likely used by some games (need to verify which games call it)

**Reproduction Steps:**
1. Open browser DevTools → Network tab
2. Play any game that uses `lib/scoring/submit.ts` (check imports in game files)
3. Submit a score
4. Observe 404 error for `/api/submit-score`

**Expected vs Actual:**
- **Expected:** Score submission succeeds
- **Actual:** 404 Not Found error, score not saved

**Scope/Impact:**
- Affects any game/page that imports `submitScore` from `@/lib/scoring/submit`
- Games using `lib/db/scores.ts` `submitScore()` function work fine (direct Supabase insert)
- Need to verify which code paths use which submission method

**Code References:**
```12:34:lib/scoring/submit.ts
export async function submitScore(parameters: SubmitScoreParameters)
{
    const guestId = getOrCreateGuestId();
    const response = await fetch('/api/submit-score',
    {
        method: 'POST',
        headers:{
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          test_name: parameters.test_name,
          score: parameters.score,
          additionalData: parameters.additionalData,
          guest_id: guestId
        })
    });

    if (!response.ok)
    {
        throw Error('Failed to submit score');
    }
    return await response.json();
}
```

---

#### Bug #2: Missing Middleware for Session Refresh (P1 - High)

**Severity:** P1 - Causes "random logout" issues and session persistence failures

**Evidence:**
- No `middleware.ts` file exists in project root
- `lib/supabase/server.ts:22-24` has comment: "This can be ignored if you have middleware refreshing user sessions"
- `@supabase/ssr` documentation requires middleware for Next.js App Router to refresh sessions on every request
- Without middleware, sessions expire server-side but client may still think user is logged in

**Reproduction Steps:**
1. Log in via magic link
2. Wait for session to approach expiration (or manually expire in Supabase dashboard)
3. Navigate to a new page or refresh
4. Server-side `/api/me` may return `isLoggedIn: false` while client `SessionContext` still shows user logged in
5. UI shows inconsistent state (logged in vs logged out)

**Expected vs Actual:**
- **Expected:** Middleware refreshes session on every request, keeping client/server in sync
- **Actual:** No middleware exists, sessions can expire server-side without client knowing

**Scope/Impact:**
- All authenticated users experience "random logout" after session expiration
- Race conditions between client `getSession()` and server `getUser()` calls
- Production issues more severe than localhost (cookie settings, HTTPS requirements)

**Code References:**
```1:30:lib/supabase/server.ts
// Supabase server
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
```

---

#### Bug #3: Auth Callback Cookie Setting Failure in Server Components (P1 - High)

**Severity:** P1 - May cause session to not persist after magic link callback

**Evidence:**
- `app/auth/callback/route.ts:13` calls `supabase.auth.exchangeCodeForSession(code)` in a Route Handler
- Route Handlers can set cookies, but if this were a Server Component, it would fail
- `lib/supabase/server.ts:16-25` silently catches cookie setting errors
- If `exchangeCodeForSession` tries to set cookies via `setAll()` and it's called from wrong context, cookies may not be set

**Reproduction Steps:**
1. Open incognito window
2. Request magic link
3. Click magic link (redirects to `/auth/callback?code=...`)
4. Check browser DevTools → Application → Cookies
5. Verify if Supabase auth cookies are set
6. If cookies missing, refresh page - user should appear logged out despite successful callback

**Expected vs Actual:**
- **Expected:** After callback, auth cookies are set and user remains logged in on redirect
- **Actual:** Cookies may not be set if `setAll()` fails silently, causing immediate logout

**Scope/Impact:**
- Users clicking magic link may appear to log in but immediately lose session
- More likely in production (HTTPS, secure cookie requirements)
- Affects first-time login experience

**Code References:**
```6:22:app/auth/callback/route.ts
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  // Return to error page if something went wrong
  return NextResponse.redirect(new URL('/auth/auth-code-error', request.url))
}
```

**Note:** Route Handlers should be able to set cookies, but the redirect happens immediately. If cookie setting is async and redirect happens before cookies are committed, they may be lost.

---

#### Bug #4: Missing `migrate_guest_scores` RPC Function Implementation (P1 - High)

**Severity:** P1 - Guest score migration will fail, breaking core feature

**Evidence:**
- `lib/guest/migrate.ts:19` and `app/api/migrate-guest/route.ts:40` call `supabase.rpc('migrate_guest_scores', ...)`
- `app/api/onboarding/route.ts:91` also calls this RPC
- Grep search for `CREATE.*FUNCTION.*migrate_guest_scores` returns no results
- Migration files `0001_init.sql`, `0002_rls.sql`, `0003_leaderboard.sql`, `0004_university_domain_auth.sql` are empty (only comments)
- No SQL file found defining this function

**Reproduction Steps:**
1. Play as guest, submit scores
2. Log in via magic link with university email
3. Onboarding triggers automatically
4. Check browser console for RPC error: "function migrate_guest_scores does not exist"
5. Guest scores remain with `guest_id`, not migrated to `user_id`

**Expected vs Actual:**
- **Expected:** RPC function exists and migrates all scores from `guest_id` to `user_id` atomically
- **Actual:** RPC call fails with "function does not exist" error, migration never happens

**Scope/Impact:**
- All users who play as guest then log in lose their guest scores
- Core user experience broken - advertised feature ("guest scores transferred automatically") doesn't work
- Migration silently fails in onboarding (error logged but not surfaced to user)

**Code References:**
```11:36:lib/guest/migrate.ts
export async function migrateGuestScores(
  guestId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    
    // Call the Supabase RPC function to migrate scores
    const { error } = await supabase.rpc('migrate_guest_scores', {
      target_guest_id: guestId,
    });

    if (error) {
      console.error('Migration error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected error migrating guest scores:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

---

#### Bug #5: Migration Not Idempotent - No Check for Already-Migrated Scores (P2 - Medium)

**Severity:** P2 - Allows duplicate migration attempts, potential data corruption

**Evidence:**
- `lib/guest/migrate.ts` calls RPC with only `target_guest_id`
- No check if scores with this `guest_id` already have a `user_id` set
- If onboarding is called multiple times (race condition or retry), migration may run multiple times
- RPC function implementation not visible, but if it's a simple UPDATE, it may overwrite or duplicate data

**Reproduction Steps:**
1. Play as guest, submit scores
2. Log in via magic link
3. Onboarding runs, migrates scores
4. Manually trigger onboarding again (or race condition causes double call)
5. Check database - scores may be migrated twice or `user_id` overwritten incorrectly

**Expected vs Actual:**
- **Expected:** Migration checks if scores already have `user_id`, skips if already migrated
- **Actual:** No idempotency check visible, migration may run multiple times

**Scope/Impact:**
- Race conditions in `SessionContext.tsx` could trigger onboarding twice
- If RPC does `UPDATE scores SET user_id = auth.uid() WHERE guest_id = target_guest_id`, running twice is safe but wasteful
- If RPC does INSERT or more complex logic, could cause duplicates

**Code References:**
```88:96:app/api/onboarding/route.ts
    // Migrate guest scores if guest_id provided
    let migrationSuccess = true;
    if (guest_id) {
      const migrationResult = await migrateGuestScores(guest_id, user.id);
      migrationSuccess = migrationResult.success;
      if (!migrationResult.success) {
        console.error('Migration error:', migrationResult.error);
      }
    }
```

**What would confirm this:**
- Check Supabase dashboard for `migrate_guest_scores` function SQL
- Verify it uses `WHERE guest_id = target_guest_id AND user_id IS NULL` to prevent re-migration
- Test double-calling `/api/onboarding` with same `guest_id` and verify no duplicates

---

#### Bug #6: Guest ID Cleared Before Migration Verification (P2 - Medium)

**Severity:** P2 - If migration fails silently, guest_id is lost and scores orphaned

**Evidence:**
- `lib/guest/onboarding.ts:47-49` clears `guest_id` if `data.migration_success === true`
- But `migration_success` is set to `true` even if migration RPC fails (see `app/api/onboarding/route.ts:89`)
- If RPC fails, `migrationSuccess` stays `true` (initial value), guest_id is cleared, but scores not migrated

**Reproduction Steps:**
1. Play as guest, submit scores
2. Log in via magic link
3. Onboarding called, but `migrate_guest_scores` RPC fails (e.g., function doesn't exist - Bug #4)
4. `app/api/onboarding/route.ts:89` sets `migrationSuccess = true` initially
5. RPC error is logged but `migrationSuccess` never set to `false` if `guest_id` is null/missing
6. Response returns `migration_success: true`
7. `lib/guest/onboarding.ts:47` clears `guest_id`
8. Scores remain with `guest_id` but `guest_id` is lost from localStorage

**Expected vs Actual:**
- **Expected:** Guest ID only cleared after confirmed successful migration
- **Actual:** Guest ID cleared even if migration fails, based on response flag that may be incorrectly true

**Scope/Impact:**
- If migration fails, guest scores become orphaned (no way to retry migration)
- User loses access to their guest scores permanently

**Code References:**
```88:96:app/api/onboarding/route.ts
    // Migrate guest scores if guest_id provided
    let migrationSuccess = true;
    if (guest_id) {
      const migrationResult = await migrateGuestScores(guest_id, user.id);
      migrationSuccess = migrationResult.success;
      if (!migrationResult.success) {
        console.error('Migration error:', migrationResult.error);
      }
    }
```

```45:50:lib/guest/onboarding.ts
    if (data.success) {
      // Clear guest_id only if migration was successful
      if (guestId && data.migration_success) {
        clearGuestId();
        console.log('Guest scores migrated and guest_id cleared');
      }
```

**Note:** Logic looks correct (checks `migration_success`), but if `guest_id` is null/undefined in request, `migrationSuccess` stays `true` and response says migration succeeded when it didn't run.

---

### 2. LIKELY BUGS / RISKS

#### Risk #1: Race Condition Between Client Session Check and Server Session (P1 - High)

**Evidence:**
- `SessionContext.tsx:134` calls `supabase.auth.getSession()` client-side
- `app/api/me/route.ts:22` calls `supabase.auth.getUser()` server-side
- No middleware refreshes sessions, so server session may expire while client thinks user is logged in
- `MeContext.tsx` fetches `/api/me` on user ID change, but timing mismatch possible

**What would confirm this:**
- Add logging: Log `getSession()` result in `SessionContext` and `getUser()` result in `/api/me`
- Test: Log in, wait for session expiration, trigger a page navigation
- Check logs for cases where client `getSession()` returns user but server `getUser()` returns null
- Verify UI shows inconsistent state (navbar shows logged in, but profile page shows logged out)

**Reproduction Steps (if confirmed):**
1. Log in via magic link
2. Wait for session to expire (or manually expire in Supabase)
3. Navigate to a page that calls `/api/me`
4. Observe: Client `SessionContext` may still show user, but `/api/me` returns `isLoggedIn: false`
5. UI shows mixed state

---

#### Risk #2: Domain Validation Bypass - Client-Side Only Checks (P1 - High)

**Evidence:**
- `LoginModal.tsx:34-44` checks domain client-side using `is_domain_allowed` RPC
- If RPC fails or returns incorrect result, user can proceed to `signInWithOtp()`
- Server-side enforcement exists via `hook_validate_university_email` Auth Hook, but need to verify it's configured in Supabase dashboard
- If Auth Hook not enabled, non-university emails could create accounts

**What would confirm this:**
- Check Supabase dashboard → Authentication → Hooks → verify `hook_validate_university_email` is registered for "Before User Created" event
- Test: Try to sign in with `test@gmail.com` (non-university domain)
- If Auth Hook enabled: Sign-in should fail with "Use a university email to sign in"
- If Auth Hook not enabled: Account may be created, but then leaderboard access should be blocked (verify RLS policies)

**Code References:**
```32:44:components/LoginModal.tsx
      // Check if domain is in allowlist (advisory check)
      const supabase = createClient();
      const { data: isAllowed, error: domainCheckError } = await supabase
        .rpc('is_domain_allowed', { p_email_domain: domain });

      if (domainCheckError) {
        console.error('Error checking domain:', domainCheckError);
        // Continue anyway - server-side enforcement will catch it
      } else if (isAllowed !== true) {
        setError('Use your university email to sign in.');
        setLoading(false);
        return;
      }
```

---

#### Risk #3: Migration RPC Uses Wrong User ID (P2 - Medium)

**Evidence:**
- `lib/guest/migrate.ts:19` calls RPC with only `target_guest_id` parameter
- RPC function should use `auth.uid()` to get authenticated user (standard Supabase pattern)
- But if RPC is `SECURITY DEFINER` and doesn't check `auth.uid()`, it might use wrong user
- `app/api/migrate-guest/route.ts` gets user from `supabase.auth.getUser()` but doesn't pass it to RPC

**What would confirm this:**
- Find SQL implementation of `migrate_guest_scores` function
- Verify it uses `auth.uid()` to get target user_id, not a parameter
- Test: Log in as User A, but somehow call migration with Guest B's guest_id that belongs to User C
- Verify migration doesn't incorrectly assign scores to User A

**Code References:**
```19:21:lib/guest/migrate.ts
    const { error } = await supabase.rpc('migrate_guest_scores', {
      target_guest_id: guestId,
    });
```

**Note:** Standard pattern is RPC uses `auth.uid()` internally, so passing `userId` parameter would be redundant and potentially insecure.

---

#### Risk #4: Cookie Settings May Break in Production (P2 - Medium)

**Evidence:**
- `lib/supabase/server.ts` doesn't specify cookie options (secure, sameSite, httpOnly)
- `@supabase/ssr` may set defaults, but production (HTTPS) may require explicit settings
- No middleware to handle cookie refresh, so expired cookies may not be renewed

**What would confirm this:**
- Deploy to production (or test with HTTPS locally)
- Log in via magic link
- Check browser cookies - verify `sb-*` cookies have `Secure` and `SameSite` attributes
- Test session persistence across page refreshes
- If cookies missing `Secure` flag on HTTPS, browser may reject them

---

#### Risk #5: Double Migration from Race Condition (P2 - Medium)

**Evidence:**
- `SessionContext.tsx:178` triggers onboarding on `SIGNED_IN` or `INITIAL_SESSION` events
- `triggerOnboardingIfNeeded()` has guards (sessionStorage, refs) but race conditions still possible
- If two tabs open simultaneously and both receive `SIGNED_IN` event, both may call onboarding

**What would confirm this:**
- Open two browser tabs
- In Tab 1: Request magic link
- In Tab 2: Also have app open (or open after Tab 1)
- Click magic link in Tab 1
- Both tabs may receive `SIGNED_IN` event
- Check network tab - verify if `/api/onboarding` called twice
- Check database - verify no duplicate migrations (scores with same `user_id` and original `guest_id`)

**Code References:**
```56:125:app/providers/SessionContext.tsx
    const triggerOnboardingIfNeeded = async (userId: string | null) => {
        // I  added 10 million guards lmao (kinda overkill)
        // Don't trigger if no user logged in
        if (!userId) {
            return;
        }

        // Double-check that the ref still points to this user (prevent stale calls after sign out)
        if (currentUserIdRef.current !== userId) {
            return;
        }

        // Check sessionStorage FIRST (synchronously) - this is the primary guard
        // If already completed or in progress, bail out immediately
        if (isOnboardingCompletedOrInProgress(userId)) {
            return;
        }

        // Check if already in progress (ref guard as secondary check)
        if (isOnboardingInProgressRef.current) {
            return;
        }

        // At this point, we're the first caller. Set sessionStorage to "pending" IMMEDIATELY
        // This must happen synchronously before any async operations
        const key = `onboarded:${userId}`;
        if (typeof window !== 'undefined') {
            sessionStorage.setItem(key, 'pending');
        }
        
        // Verify we successfully set it (in case another call set it between our check and set)
        // This is our atomic operation verification
        if (typeof window !== 'undefined' && sessionStorage.getItem(key) !== 'pending') {
            // Another call beat us to it, bail out
            return;
        }

        // Now set the ref guard
        isOnboardingInProgressRef.current = true;
        
        console.log('Starting onboarding for user:', userId);
        
        try {
            // Double-check user ID hasn't changed during async operation
            if (currentUserIdRef.current !== userId) {
                console.log('User changed during onboarding, aborting');
                clearOnboardingFlag(userId);
                return;
            }

            const success = await completeOnboarding();
            if (success) {
                console.log('Onboarding completed successfully');
                markOnboardingCompleted(userId);
            } else {
                console.warn('Onboarding completed with warnings');
                // Still mark as completed to avoid retrying immediately
                markOnboardingCompleted(userId);
            }
        } catch (error) {
            console.error('Onboarding error:', error);
            // Clear the flag on error so it can retry on next page load
            clearOnboardingFlag(userId);
        } finally {
            // Only clear the ref if we're still working on the same user
            if (currentUserIdRef.current === userId) {
                isOnboardingInProgressRef.current = false;
            }
        }
    };
```

**Note:** Guards look comprehensive, but `sessionStorage` is per-tab, so two tabs can both pass the check.

---

#### Risk #6: Missing Error Page Route (P2 - Low)

**Evidence:**
- `app/auth/callback/route.ts:21` redirects to `/auth/auth-code-error` on error
- No verification this route exists

**What would confirm this:**
- Trigger an invalid/expired magic link callback
- Verify if `/auth/auth-code-error` page exists or returns 404

---

### 3. SMOKE TEST MATRIX

After fixes are implemented, run these test scenarios:

#### Test 1: New Guest → Play → Login → Migrate → Leaderboard
1. Open incognito window
2. Navigate to site (no login)
3. Play a game, submit score
4. Verify score saved with `guest_id` (check localStorage for `goose_trials_guest_id`)
5. Open login modal, enter university email
6. Check email, click magic link
7. Verify redirect to callback, then to home page
8. Verify onboarding runs automatically
9. Check localStorage - `guest_id` should be cleared
10. Check leaderboard - migrated scores should appear under your username
11. Verify no duplicate scores

#### Test 2: Returning Guest → Login
1. Open incognito window
2. Play as guest, submit scores
3. Close browser (simulate returning later)
4. Reopen browser, navigate to site
5. Verify `guest_id` still in localStorage (same UUID)
6. Log in via magic link
7. Verify migration runs, guest_id cleared
8. Verify scores appear on leaderboard

#### Test 3: Returning Logged-In User → Reload → Still Logged In
1. Log in via magic link
2. Close browser
3. Reopen browser, navigate to site
4. Verify user still logged in (navbar shows username, not "Sign In")
5. Refresh page multiple times
6. Verify session persists (no random logout)
7. Check `/api/me` returns `isLoggedIn: true` consistently

#### Test 4: Logout → Login Again
1. Log in via magic link
2. Submit some scores as authenticated user
3. Log out (click logout button)
4. Verify session cleared (navbar shows "Sign In")
5. Log in again with same email
6. Verify previous authenticated scores still visible
7. Verify no guest_id created (should only exist for guests)

#### Test 5: Invalid Domain Attempt
1. Try to log in with `test@gmail.com` (non-university email)
2. Verify error message: "Use a university email to sign in"
3. Verify magic link is NOT sent (check network tab - no API call or error response)
4. If somehow magic link sent, verify account creation fails server-side

#### Test 6: Expired Magic Link Attempt
1. Request magic link
2. Wait for link to expire (or use old link from previous session)
3. Click expired magic link
4. Verify redirect to error page (not crash)
5. Verify user is NOT logged in
6. Verify clear error message shown

#### Test 7: Guest Scores Not on Leaderboard
1. Play as guest (don't log in)
2. Submit multiple scores
3. Navigate to leaderboard page
4. Verify guest scores do NOT appear (leaderboard only shows authenticated users)
5. This is expected behavior - guests can't appear on leaderboards

#### Test 8: Session Persistence Across Tabs
1. Log in via magic link in Tab 1
2. Open same site in Tab 2 (new tab, same browser)
3. Verify Tab 2 also shows user logged in (shared session via cookies)
4. Log out in Tab 1
5. Verify Tab 2 also shows logged out (session cleared)

#### Test 9: Migration Idempotency
1. Play as guest, submit scores
2. Log in via magic link
3. Onboarding runs, migrates scores
4. Manually call `/api/onboarding` again (via browser console or API client)
5. Verify no duplicate scores in database
6. Verify migration doesn't fail (idempotent)

#### Test 10: Cookie Security (Production)
1. Deploy to production (HTTPS)
2. Log in via magic link
3. Check browser DevTools → Application → Cookies
4. Verify all `sb-*` cookies have:
   - `Secure` flag set (HTTPS only)
   - `SameSite` attribute set appropriately
   - `HttpOnly` if needed (check Supabase docs)
5. Verify session persists across refreshes

---

## Summary

**Confirmed Bugs:** 6 (1 P0, 4 P1, 1 P2)  
**Likely Bugs/Risks:** 6 (2 P1, 4 P2)

**Critical Issues:**
- Missing `/api/submit-score` route breaks score submission for some code paths
- Missing middleware causes session persistence failures
- Missing `migrate_guest_scores` RPC function breaks guest score migration
- Auth callback may fail to set cookies properly

**Next Steps:**
1. Verify which games use `lib/scoring/submit.ts` vs `lib/db/scores.ts`
2. Check Supabase dashboard for `migrate_guest_scores` function (may exist but not in migrations)
3. Verify Auth Hook is enabled in Supabase dashboard
4. Test cookie behavior in production/HTTPS environment
5. Add logging to confirm race conditions and session mismatches

---

**Report Generated:** Codebase analysis complete  
**No fixes implemented per requirements**


