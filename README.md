This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Import University Data

To import university data from a JSON file into Supabase:

### 1. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 2. Set up your Supabase connection

Get your connection string from: **Supabase Dashboard → Project Settings → Database → Connection string**

Then either:

**Option A: Use environment variable**
```bash
export SUPABASE_DB_URL="postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres"
```

**Option B: Create a `.env` file** (recommended)
```env
SUPABASE_DB_URL=postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres
```

### 3. Run the import script

```bash
python import_universities.py path/to/world_universities_and_domains.json
```

The script will:
- Create the `universities` and `university_domains` tables if they don't exist
- Import universities with deduplication by `(name, country)`
- Import domains with conflict handling
- Commit in chunks for stability

### 4. Verify the import

Run these queries in the Supabase SQL editor:

```sql
-- Count universities
select count(*) from public.universities;

-- Count domains
select count(*) from public.university_domains;

-- Test a domain lookup
select u.name, d.domain
from public.university_domains d
join public.universities u on u.id = d.university_id
where d.domain = 'uwaterloo.ca';
```