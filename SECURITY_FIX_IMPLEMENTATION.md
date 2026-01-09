# Score Submission Security Fix - Implementation Summary

This document summarizes the comprehensive security fixes applied to prevent score manipulation and ensure server-authoritative score submission.

## Overview

**Problem**: Clients could directly insert scores into the database, allowing score manipulation and cheating.

**Solution**: Implemented server-side score submission with validation, database constraints, and proper RLS policies.

## Implementation Phases

### Phase 0: Immediate Containment ✅

**File**: `supabase/migrations/0008_security_fix_phase0_revoke_inserts.sql`

- Revoked INSERT permissions from `anon` and `authenticated` roles on `public.scores`
- Clients can no longer directly insert scores
- Server uses `service_role` key which bypasses RLS

**To apply**: Run this migration in Supabase SQL editor immediately to stop all browser writes.

### Phase 1: Server-Authoritative Score Submission ✅

**Files**:
- `app/api/submit-score/route.ts` (NEW) - Server-side API endpoint
- `lib/db/scores.ts` (UPDATED) - Now calls API endpoint instead of direct inserts

**Features**:
- ✅ All score submissions go through `/api/submit-score` POST endpoint
- ✅ Score validation per game with realistic bounds
- ✅ User authentication handled server-side
- ✅ Guest ID validation (UUID format)
- ✅ Determines if score is new personal best
- ✅ Uses `supabaseAdmin` (service_role key) for database writes

**Score Validation Ranges**:
- `reaction-time`: 50ms - 5000ms
- `chimp`: 1 - 50 levels
- `number-memory`: 1 - 30 digits
- `aim-trainer`: 1 - 1000 hits
- `pathfinding`: 1 - 100 rounds
- `hanoi`: 0.01s - 3600s
- `tetris`: 0.01s - 3600s

### Phase 2: Row Level Security Policies ✅

**File**: `supabase/migrations/0009_security_fix_phase2_rls_policies.sql`

- Enabled RLS on `scores` table
- `users_read_own_scores`: Users can read their own scores
- `public_read_all_scores`: Public read access for leaderboards
- **No INSERT policies for clients** - only server can insert

### Phase 3: Database Constraints ✅

**File**: `supabase/migrations/0010_security_fix_phase3_database_constraints.sql`

- ✅ `score_positive`: Scores must be >= 0
- ✅ `score_bounds_by_game`: Per-game score bounds constraints
- ✅ `scores_user_or_guest`: Must have either user_id OR guest_id (not both, not neither)
- ✅ `scores_test_slug_fkey`: Foreign key to tests table (if exists)
- ✅ Added `created_at` column if missing (for auditing)
- ✅ Performance indexes for leaderboard queries

**Safety Net**: Even if server validation has bugs, database constraints will reject invalid data.

### Phase 4: Abuse Detection & Audit ✅

**File**: `supabase/migrations/0011_security_fix_phase4_abuse_detection.sql`

- Creates `suspicious_scores` view to identify potentially compromised scores
- Identifies scores outside realistic bounds
- Provides queries to find repeat offenders
- Optional: Adds `is_suspicious` column to flag suspicious scores
- Queries included to review before taking action

## Migration Order

Apply migrations in this order:

1. `0008_security_fix_phase0_revoke_inserts.sql` - **DO THIS FIRST** (immediate containment)
2. `0009_security_fix_phase2_rls_policies.sql`
3. `0010_security_fix_phase3_database_constraints.sql`
4. `0011_security_fix_phase4_abuse_detection.sql`

## Verification Steps

### Step 1: Verify Client Inserts Are Blocked

1. Open browser DevTools → Console
2. Run this in the console:
```javascript
fetch('https://your-supabase-url.supabase.co/rest/v1/scores', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': 'YOUR_ANON_KEY',
    'Authorization': 'Bearer YOUR_ANON_KEY'
  },
  body: JSON.stringify({
    test_slug: 'reaction-time',
    score_value: 999999,
    user_id: null,
    guest_id: 'test-guest-id'
  })
}).then(r => console.log(r.status, r.statusText));
```

**Expected Result**: `403 Forbidden` or `401 Unauthorized`

**If you see `201 Created`**: The fix is not applied correctly. Check:
- Did you run migration 0008?
- Is RLS enabled on the scores table?
- Are the INSERT permissions revoked?

### Step 2: Verify API Endpoint Works

1. Play a game normally
2. Submit a score
3. Check Network tab - should see `POST /api/submit-score` returning `200 OK`
4. Verify score appears in database with correct validation

### Step 3: Test Score Validation

Try submitting invalid scores through the API:

```javascript
// Too high score
fetch('/api/submit-score', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    testSlug: 'reaction-time',
    scoreValue: 999999,
    guestId: 'your-guest-id'
  })
}).then(r => r.json()).then(console.log);

// Should return: { success: false, error: "Score 999999 is outside acceptable range..." }
```

### Step 4: Verify Database Constraints

Try inserting invalid data directly with service_role (should fail):

```sql
-- This should fail due to constraint
INSERT INTO scores (test_slug, score_value, user_id, guest_id)
VALUES ('reaction-time', -100, NULL, 'test-id');
-- Expected: constraint violation error

-- This should fail due to constraint
INSERT INTO scores (test_slug, score_value, user_id, guest_id)
VALUES ('reaction-time', 999999, NULL, 'test-id');
-- Expected: constraint violation error
```

## Files Changed

### New Files
- `app/api/submit-score/route.ts` - Server-side score submission endpoint
- `supabase/migrations/0008_security_fix_phase0_revoke_inserts.sql`
- `supabase/migrations/0009_security_fix_phase2_rls_policies.sql`
- `supabase/migrations/0010_security_fix_phase3_database_constraints.sql`
- `supabase/migrations/0011_security_fix_phase4_abuse_detection.sql`

### Modified Files
- `lib/db/scores.ts` - Now calls API endpoint instead of direct Supabase inserts
- Removed unused imports (`createClient` from supabase/client)

### Deprecated (Still Present, But Unused)
- `lib/db/scores.ts::submitGuestScore()` - Deprecated, use `submitScore()` instead
- `lib/scoring/submit.ts` - Old implementation, not used by any games

## Security Improvements

1. **Server-Authoritative**: All scores validated and inserted server-side
2. **Input Validation**: Multi-layer validation (API + database constraints)
3. **No Client Trust**: Client-provided scores are validated, not trusted
4. **Audit Trail**: `created_at` timestamps and suspicious score detection
5. **Defense in Depth**: API validation + RLS policies + database constraints

## Next Steps (Optional Enhancements)

1. **Rate Limiting**: Add rate limiting to `/api/submit-score` to prevent spam
2. **Replay Protection**: Add nonces/timestamps to prevent replay attacks
3. **Game-Specific Validation**: Some games might need additional validation (e.g., verifying game state)
4. **Suspicious Score Review**: Implement a review process for flagged scores
5. **Analytics**: Log all score submissions for anomaly detection

## Important Notes

- ⚠️ **Service Role Key**: Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client
- ⚠️ **Guest IDs**: Guest IDs come from client but are validated (UUID format)
- ⚠️ **Score Bounds**: Current bounds are conservative - adjust if legitimate players are hitting limits
- ⚠️ **Backward Compatibility**: Existing games continue to work, they now use the secure API endpoint

## Testing Checklist

- [ ] Run Phase 0 migration (revoke inserts)
- [ ] Verify client inserts return 403
- [ ] Test score submission through games
- [ ] Verify scores appear in database
- [ ] Test invalid score rejection
- [ ] Run Phase 2-4 migrations
- [ ] Verify RLS policies work
- [ ] Verify database constraints work
- [ ] Run abuse detection queries
- [ ] Review suspicious scores

## Support

If you encounter issues:
1. Check Supabase logs for detailed error messages
2. Verify environment variables are set correctly
3. Ensure migrations ran in correct order
4. Check browser console for client-side errors
5. Review server logs for API endpoint errors

