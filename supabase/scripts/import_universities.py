import json
import os
import pathlib
import sys
import urllib.parse
from typing import Any, Dict, List, Optional

import psycopg

try:
    # Optional: supports loading DATABASE_URL or SUPABASE_DB_URL from a .env file
    from dotenv import load_dotenv
    # Load .env from project root (go up two levels from script location)
    script_dir = pathlib.Path(__file__).parent.absolute()
    project_root = script_dir.parent.parent
    env_path = project_root / '.env'
    # override=True ensures .env file values take precedence over existing env vars
    load_dotenv(env_path, override=True)
except Exception:
    pass


CREATE_TABLES_SQL = """
create table if not exists public.universities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text null,
  alpha_two_code text null,
  website text null,
  created_at timestamptz default now(),
  -- we dedupe universities by (name, country) for imports
  constraint universities_name_country_key unique (name, country)
);

create table if not exists public.university_domains (
  domain text primary key,
  university_id uuid not null references public.universities(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists idx_university_domains_university
  on public.university_domains(university_id);
"""

# Ensure the unique constraint exists (in case table was created without it)
ENSURE_CONSTRAINT_SQL = """
do $$
begin
  if not exists (
    select 1 from pg_constraint 
    where conname = 'universities_name_country_key'
  ) then
    alter table public.universities 
    add constraint universities_name_country_key unique (name, country);
  end if;
end $$;
"""


UPSERT_UNIVERSITY_SQL = """
insert into public.universities (name, country, alpha_two_code, website)
values (%s, %s, %s, %s)
on conflict (name, country) do update
  set alpha_two_code = coalesce(excluded.alpha_two_code, public.universities.alpha_two_code),
      website = coalesce(excluded.website, public.universities.website)
returning id;
"""

INSERT_DOMAIN_SQL = """
insert into public.university_domains (domain, university_id, is_primary)
values (%s, %s, %s)
on conflict (domain) do nothing;
"""


def normalize_domain(d: str) -> str:
    d = (d or "").strip().lower()
    # remove trailing slash or protocol if present in dataset variants
    d = d.replace("http://", "").replace("https://", "")
    d = d.strip("/")
    # PostgreSQL text can be very long, but domains should be reasonable
    # Truncate if absurdly long (max 253 chars per RFC, but allow some buffer)
    if len(d) > 255:
        d = d[:255]
    return d


def normalize_website(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    url = url.strip()
    return url or None


def load_json(path: str) -> List[Dict[str, Any]]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise ValueError("Expected a JSON array of university objects.")
    return data


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python import_universities.py <path_to_university_json>")
        sys.exit(1)

    json_path = sys.argv[1]
    # Check for DATABASE_URL first (common convention), then SUPABASE_DB_URL for backwards compatibility
    db_url = os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL")

    if not db_url:
        print("ERROR: DATABASE_URL or SUPABASE_DB_URL is not set.")
        print('Example: DATABASE_URL="postgresql://postgres:PASS@db.xxx.supabase.co:5432/postgres"')
        print("\nTip: Make sure you have a .env file in the project root with DATABASE_URL set,")
        print("     or set it as an environment variable in your shell.")
        print("\nNote: If you get IPv4/IPv6 connection errors, use the Session Pooler connection string")
        print("     from Supabase Dashboard → Database → Connection Pooling → Session mode")
        sys.exit(1)
    
    # Extract hostname for diagnostic message (masked for security)
    try:
        parsed = urllib.parse.urlparse(db_url)
        hostname = parsed.hostname or "unknown"
        print(f"Connecting to database at: {hostname}")
    except Exception:
        pass

    data = load_json(json_path)

    inserted_unis = 0
    inserted_domains = 0
    skipped = 0

    print("Loading data...")
    print(f"Total entries to process: {len(data)}")
    
    with psycopg.connect(db_url, connect_timeout=30) as conn:
        print("Connected. Setting up database...")
        conn.execute("set statement_timeout = '0'")  # allow long import
        with conn.cursor() as cur:
            # Ensure tables exist (safe to run)
            cur.execute(CREATE_TABLES_SQL)
            # Ensure the unique constraint exists (in case table was created without it)
            cur.execute(ENSURE_CONSTRAINT_SQL)
            conn.commit()
            print("Database setup complete. Starting import...")

            for idx, entry in enumerate(data, 1):
                # Use savepoint for each entry so failures don't rollback previous work
                savepoint_name = f"sp_entry_{idx}"
                try:
                    cur.execute(f"SAVEPOINT {savepoint_name}")
                    
                    name = (entry.get("name") or "").strip()
                    if not name:
                        skipped += 1
                        cur.execute(f"RELEASE SAVEPOINT {savepoint_name}")
                        continue

                    country = entry.get("country")
                    country = country.strip() if isinstance(country, str) else None

                    alpha_two_code = entry.get("alpha_two_code")
                    alpha_two_code = alpha_two_code.strip() if isinstance(alpha_two_code, str) else None

                    web_pages = entry.get("web_pages") or []
                    website = normalize_website(web_pages[0] if isinstance(web_pages, list) and web_pages else None)

                    # upsert university and get id
                    cur.execute(UPSERT_UNIVERSITY_SQL, (name, country, alpha_two_code, website))
                    result = cur.fetchone()
                    if not result:
                        raise ValueError("Failed to get university ID from upsert")
                    uni_id = result[0]
                    inserted_unis += 1

                    domains = entry.get("domains") or []
                    if not isinstance(domains, list):
                        domains = []

                    # mark first domain as primary if present
                    for i, d in enumerate(domains):
                        dom = normalize_domain(str(d))
                        if not dom:
                            continue
                        # Validate uni_id is valid UUID
                        if not uni_id:
                            raise ValueError(f"Invalid university_id: {uni_id}")
                        try:
                            cur.execute(INSERT_DOMAIN_SQL, (dom, uni_id, i == 0))
                            inserted_domains += 1
                        except Exception as domain_err:
                            # Log domain-specific errors but continue
                            print(f"  Warning: Failed to insert domain '{dom}': {domain_err}")
                            # Don't skip the whole entry, just this domain
                            continue

                    # Release savepoint on success
                    cur.execute(f"RELEASE SAVEPOINT {savepoint_name}")

                except Exception as e:
                    # Rollback to savepoint to undo just this entry
                    skipped += 1
                    try:
                        cur.execute(f"ROLLBACK TO SAVEPOINT {savepoint_name}")
                    except Exception:
                        pass  # Savepoint might not exist if error happened early
                    
                    import traceback
                    error_msg = str(e)
                    error_type = type(e).__name__
                    print(f"\n[Entry {idx}/{len(data)}] Skipping entry due to error ({error_type}): {error_msg}")
                    print(f"Entry: {entry}")
                    # Print full traceback for debugging
                    traceback.print_exc()
                
                # commit in chunks to avoid huge transactions
                if (inserted_unis % 500) == 0:
                    conn.commit()
                    print(f"Progress: {inserted_unis} universities, {inserted_domains} domains processed...")

            conn.commit()

    print("Done.")
    print(f"Universities processed (upsert attempts): {inserted_unis}")
    print(f"Domains insert attempts: {inserted_domains}")
    print(f"Skipped/errored entries: {skipped}")


if __name__ == "__main__":
    main()

