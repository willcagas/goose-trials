import json
import os
import sys
from typing import Any, Dict, List, Optional

import psycopg

try:
    # Optional: supports loading SUPABASE_DB_URL from a .env file
    from dotenv import load_dotenv
    load_dotenv()
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
    db_url = os.environ.get("SUPABASE_DB_URL")

    if not db_url:
        print("ERROR: SUPABASE_DB_URL is not set.")
        print('Example: export SUPABASE_DB_URL="postgresql://postgres:PASS@db.xxx.supabase.co:5432/postgres"')
        sys.exit(1)

    data = load_json(json_path)

    inserted_unis = 0
    inserted_domains = 0
    skipped = 0

    with psycopg.connect(db_url) as conn:
        conn.execute("set statement_timeout = '0'")  # allow long import
        with conn.cursor() as cur:
            # Ensure tables exist (safe to run)
            cur.execute(CREATE_TABLES_SQL)
            conn.commit()

            for entry in data:
                try:
                    name = (entry.get("name") or "").strip()
                    if not name:
                        skipped += 1
                        continue

                    country = entry.get("country")
                    country = country.strip() if isinstance(country, str) else None

                    alpha_two_code = entry.get("alpha_two_code")
                    alpha_two_code = alpha_two_code.strip() if isinstance(alpha_two_code, str) else None

                    web_pages = entry.get("web_pages") or []
                    website = normalize_website(web_pages[0] if isinstance(web_pages, list) and web_pages else None)

                    # upsert university and get id
                    cur.execute(UPSERT_UNIVERSITY_SQL, (name, country, alpha_two_code, website))
                    uni_id = cur.fetchone()[0]
                    inserted_unis += 1

                    domains = entry.get("domains") or []
                    if not isinstance(domains, list):
                        domains = []

                    # mark first domain as primary if present
                    for i, d in enumerate(domains):
                        dom = normalize_domain(str(d))
                        if not dom:
                            continue
                        cur.execute(INSERT_DOMAIN_SQL, (dom, uni_id, i == 0))
                        inserted_domains += 1

                except Exception as e:
                    # keep going, but print the error context
                    skipped += 1
                    print(f"Skipping entry due to error: {e}\nEntry: {entry}")
                    conn.rollback()
                else:
                    # commit in chunks to avoid huge transactions
                    if (inserted_unis % 500) == 0:
                        conn.commit()

            conn.commit()

    print("Done.")
    print(f"Universities processed (upsert attempts): {inserted_unis}")
    print(f"Domains insert attempts: {inserted_domains}")
    print(f"Skipped/errored entries: {skipped}")


if __name__ == "__main__":
    main()

