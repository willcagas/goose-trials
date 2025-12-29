Absolutely — here is a **single, clean backend-context document** you can drop straight into Cursor (or a Notion / README) so the frontend has full clarity on how the leaderboard system works and what assumptions are locked in.

I’ve rewritten it slightly to be **concise, authoritative, and implementation-oriented**, without changing any logic.

---

# Goose Trials — Leaderboard Backend Context (Supabase + Next.js)

This document defines the **exact backend model and contracts** for Goose Trials leaderboards.
Frontend code should treat this as canonical.

---

## Assumptions (Locked for v1)

* Users can play as **guests** (`guest_id`)
* Users appear on leaderboards **only after magic-link email authentication**
* A user’s **university is derived from their email domain**
* Leaderboards exist for:

  * **Campus** (users from the same university)
  * **Global** (all universities)
* No manual university selection by users

---

## Leaderboard Rules (Very Important)

For each `test_slug`:

* Each user appears **at most once**
* The leaderboard uses the user’s **best score**

  * `MIN(score_value)` if `tests.lower_is_better = true`
  * `MAX(score_value)` otherwise
* Ties are broken by the **earliest time the best score was achieved**
* Leaderboards are **read-only derivations** from `scores` (no manual ranking table)

This prevents spam runs and guarantees fairness.

---

## Database Structure

### 1. Universities

```sql
create table if not exists public.universities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text null,
  alpha_two_code text null,
  website text null,
  created_at timestamptz default now()
);
```

---

### 2. University Domains

Maps verified email domains to universities.

```sql
create table if not exists public.university_domains (
  domain text primary key,
  university_id uuid not null references public.universities(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists idx_university_domains_university
  on public.university_domains(university_id);
```

A university may have **multiple domains**.

---

### 3. Profiles → University Link

```sql
alter table public.profiles
add column if not exists university_id uuid
  references public.universities(id)
  on delete set null;

create index if not exists idx_profiles_university_id
  on public.profiles(university_id);
```

> `profiles.email` already exists and is used to derive university.

---

## University Assignment (On Login)

### Rule

A user’s university is **derived from their email domain**, not chosen manually.

### Matching Logic

Given `emailDomain`:

* Match if `emailDomain = domain`
* OR `emailDomain LIKE '%.domain'` (subdomain case)
* Prefer the **longest matching domain** (most specific)

### SQL Helper

```sql
create or replace function public.find_university_by_domain(p_email_domain text)
returns uuid
language sql
stable
as $$
  select ud.university_id
  from public.university_domains ud
  where lower(p_email_domain) = ud.domain
     or lower(p_email_domain) like ('%.' || ud.domain)
  order by length(ud.domain) desc
  limit 1;
$$;
```

### Backend Flow (Auth Callback / API Route)

1. User completes magic-link login
2. Extract email → `emailDomain`
3. Call `find_university_by_domain(emailDomain)`
4. Update `profiles.university_id`

If no match:

* `university_id` remains `NULL`
* User does not appear on campus leaderboards

---

## Performance Indexes on Scores

```sql
create index if not exists idx_scores_test_user_value
  on public.scores(test_slug, user_id, score_value);

create index if not exists idx_scores_test_user_created
  on public.scores(test_slug, user_id, created_at);

create index if not exists idx_scores_test_guest_value
  on public.scores(test_slug, guest_id, score_value);
```

---

## Core Views

### 1. Best Score Per User Per Test

```sql
create or replace view public.user_best_scores as
with joined as (
  select
    s.test_slug,
    s.user_id,
    s.score_value,
    s.created_at,
    t.lower_is_better
  from public.scores s
  join public.tests t on t.slug = s.test_slug
  where s.user_id is not null
),
best as (
  select
    test_slug,
    user_id,
    case
      when bool_or(lower_is_better) then min(score_value)
      else max(score_value)
    end as best_score
  from joined
  group by test_slug, user_id
),
best_with_time as (
  select distinct on (j.test_slug, j.user_id)
    j.test_slug,
    j.user_id,
    b.best_score,
    j.created_at as achieved_at
  from joined j
  join best b
    on b.test_slug = j.test_slug
   and b.user_id = j.user_id
   and b.best_score = j.score_value
  order by j.test_slug, j.user_id, j.created_at asc
)
select * from best_with_time;
```

---

### 2. Global Leaderboard (Ranks Computed Here)

```sql
create or replace view public.leaderboard_global as
select
  ubs.test_slug,
  ubs.user_id,
  p.username,
  p.avatar_url,
  p.university_id,
  ubs.best_score,
  ubs.achieved_at,
  rank() over (
    partition by ubs.test_slug
    order by
      case when t.lower_is_better then ubs.best_score end asc,
      case when not t.lower_is_better then ubs.best_score end desc,
      ubs.achieved_at asc
  ) as rank
from public.user_best_scores ubs
join public.tests t on t.slug = ubs.test_slug
join public.profiles p on p.id = ubs.user_id
where p.university_id is not null;
```

This view:

* Has **one row per user per test**
* Already contains `rank`
* Is filterable by `university_id`

---

## Leaderboard RPC (Frontend Contract)

This is the **only function the frontend should call**.

```sql
create or replace function public.get_leaderboard(
  p_test_slug text,
  p_limit int default 50,
  p_user_id uuid default null,
  p_university_id uuid default null
)
returns table (
  test_slug text,
  user_id uuid,
  username text,
  avatar_url text,
  university_id uuid,
  best_score double precision,
  achieved_at timestamptz,
  rank bigint,
  is_you boolean
)
language sql
stable
as $$
  with lb as (
    select
      l.*,
      (l.user_id = p_user_id) as is_you
    from public.leaderboard_global l
    where l.test_slug = p_test_slug
      and (p_university_id is null or l.university_id = p_university_id)
  ),
  topn as (
    select * from lb order by rank limit p_limit
  ),
  you as (
    select * from lb where user_id = p_user_id
  )
  select * from topn
  union all
  select * from you
  where p_user_id is not null
    and not exists (select 1 from topn where user_id = p_user_id)
  order by rank;
$$;
```

### Behavior

* Always returns **Top N**
* Also returns **the logged-in user’s row** if not already included
* `is_you = true` allows frontend highlighting
* Supports both campus and global views

### Usage

* **Campus leaderboard:** pass `p_university_id`
* **Global leaderboard:** pass `null`

---

## Frontend Usage Pattern

### Leaderboard Landing

* Query `public.tests`
* Link to `/leaderboard/[testSlug]`

### Per-Test Leaderboard Page

1. Fetch `/api/me` → `{ userId, universityId }`
2. Call `get_leaderboard` for:

   * Campus (`p_university_id = universityId`)
   * Global (`p_university_id = null`)
3. Toggle between datasets client-side
4. Highlight `is_you = true`

---

## Guest → User Migration

On login:

1. Require authenticated user
2. Update:

   ```sql
   update scores
   set user_id = <auth_user_id>, guest_id = null
   where guest_id = <current_guest_id>;
   ```
3. No deduplication required — best-score view handles it

---

## Result

You now have:

* Campus leaderboards (auto-created per university)
* Global leaderboards
* One-query “Top 50 + Me”
* No per-university provisioning
* No user-selected school spoofing
