# 06 — Supabase Guide

> **TL;DR:** Supabase is a cloud PostgreSQL database with a built-in REST API, real-time subscriptions, and auth. The app talks to it directly from the browser using the `@supabase/supabase-js` library. Row-Level Security (RLS) is what controls who can read or write what — the frontend enforces nothing itself.

---

## Table of Contents
- [What Supabase is](#what-supabase-is)
- [Accessing the dashboard](#accessing-the-dashboard)
- [The database tables](#the-database-tables)
- [Authentication](#authentication)
- [Row-Level Security (RLS)](#row-level-security-rls)
- [How the app talks to Supabase](#how-the-app-talks-to-supabase)
- [Viewing and editing data](#viewing-and-editing-data)
- [The SQL editor](#the-sql-editor)
- [Making a schema change](#making-a-schema-change)
- [Supabase vocab glossary](#supabase-vocab-glossary)

---

## What Supabase is

Supabase gives you a hosted PostgreSQL database plus several services on top of it:

- **Database** — Standard PostgreSQL. Tables, relationships, indexes, triggers, everything.
- **Auth** — Built-in user management: sign up, sign in, email verification, password reset, JWT sessions.
- **REST API** — Automatically generated HTTP API for every table. You don't write any API code — Supabase generates it from your schema.
- **Realtime** — WebSocket subscriptions to watch for database changes (not used in this app yet).
- **Storage** — File storage (not used in this app).

The app uses Supabase Auth for logins and the REST API (via the JS client) for all database operations.

**Why Supabase instead of a custom server?** A custom backend would require maintaining an Express/Node server, writing all the API routes, managing auth tokens manually, and hosting the server somewhere. Supabase handles all of that — we focus on the React frontend instead.

---

## Accessing the dashboard

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Select the **dmpgrants** project.
3. The project reference ID is `mgpwjnxtqcnoyjgebytg`.

**Key sections:**

| Section | What you'll do there |
|---|---|
| **Table Editor** | Browse, filter, add, edit, delete rows. Like a spreadsheet view of the database. |
| **SQL Editor** | Run any SQL query. Powerful for bulk operations and schema changes. |
| **Authentication → Users** | See all registered users, add users manually, reset passwords. |
| **Authentication → Policies** | Manage Row-Level Security policies (who can read/write what). |
| **Settings → API** | Get your Project URL and anon key. |
| **Settings → Database** | Connection strings for direct PostgreSQL access. |
| **Logs** | Real-time logs of API requests and auth events. Useful for debugging. |

---

## The database tables

The app has 13 tables. Each one maps to a module in the UI.

| Table | Module | What it stores |
|---|---|---|
| `users` | — | Staff accounts (email, name, role) |
| `work_orders` | Work Orders | Maintenance and service tasks |
| `grants` | Grants | Grant opportunities and applications |
| `burials` | Burials | Deceased records with plot locations |
| `customers` | Customers | Family and contact information |
| `inventory` | Inventory | Stock items with quantities |
| `contracts` | Contracts | Pre-need and at-need agreements |
| `contract_items` | Contracts | Line items within a contract |
| `deposits` | Financial | Cash/check/card deposits received |
| `accounts_receivable` | Financial | Money owed to DMP |
| `accounts_payable` | Financial | Money DMP owes to vendors |
| `vendors` | Financial | Vendor information for AP |

**Column naming:** All columns use `snake_case` (e.g. `first_name`, `burial_date`, `created_at`). The JavaScript code uses `camelCase` (`firstName`, `burialDate`, `createdAt`). The `api.ts` layer converts between them automatically.

**Common columns on all tables:**
- `id` — UUID, auto-generated primary key
- `created_at` — timestamp, auto-set on INSERT
- `updated_at` — timestamp, updated on every change

### Burials table (example)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Auto-generated |
| `deceased_first_name` | text | Required |
| `deceased_last_name` | text | Required |
| `deceased_middle_name` | text | Optional |
| `date_of_birth` | date | Optional |
| `date_of_death` | date | Optional |
| `burial_date` | date | Required |
| `plot_location` | text | Format: `SECTION-LOT-GRAVE` (e.g. `A-14-3`) |
| `section` | text | Cemetery section |
| `lot` | text | Lot number within section |
| `grave` | text | Grave number within lot |
| `contact_name` | text | Next of kin / primary contact |
| `contact_phone` | text | |
| `contact_email` | text | |
| `permit_number` | text | State burial permit number |
| `notes` | text | Free-form notes |
| `created_at` / `updated_at` | timestamp | Auto-managed |

---

## Authentication

Supabase Auth handles user logins. There are two accounts of interest:

### Real user login
```
Email:    chughes@detroitmemorialpark.com
Password: DMP2025!
Role:     admin (stored in user_metadata)
```

To add another user:
1. Supabase dashboard → Authentication → Users → "Add user"
2. Enter email and password
3. The user can then sign in to the app
4. To set their `name` and `role`, use SQL:
   ```sql
   UPDATE auth.users
   SET raw_user_meta_data = '{"name": "Jane Smith", "role": "staff"}'::jsonb
   WHERE email = 'jsmith@detroitmemorialpark.com';
   ```

### How the JWT session works

When a user signs in:
1. Supabase verifies email/password
2. Returns a **JWT (JSON Web Token)** — a signed, time-limited token
3. The Supabase JS client stores the token in `localStorage`
4. Every API request includes the token in the `Authorization: Bearer <token>` header
5. Supabase validates the token on every request
6. RLS policies can read `auth.uid()` from the token to know who's asking

Tokens auto-refresh before expiry. If the browser is closed and reopened within the session window, the user stays logged in.

---

## Row-Level Security (RLS)

**RLS is the most important security concept to understand.**

> **What it means:** Without RLS, any user with the anon key could read/write any row in any table — the entire database would be exposed. RLS adds per-row, per-user permissions enforced by the database itself.

### How it works

RLS policies are SQL rules attached to a table. When any request comes in, PostgreSQL evaluates the policy for that user. If the policy doesn't return `true`, the operation is denied.

**Example — a table with RLS enabled:**
```sql
-- Policy: authenticated users can read all burials
CREATE POLICY "Authenticated users can read burials"
ON burials FOR SELECT
TO authenticated
USING (true);   -- 'true' means: allow for all rows

-- Policy: only the creator can delete
CREATE POLICY "Only creator can delete burial"
ON burials FOR DELETE
TO authenticated
USING (auth.uid() = created_by::uuid);
```

### Current RLS status

Check the current policies in Supabase dashboard → Authentication → Policies.

If a table has **no policies**, it depends on whether RLS is enabled:
- RLS **disabled** → all operations allowed for all users (risky!)
- RLS **enabled** with no policies → all operations **blocked** (safe but non-functional)

**Recommended minimum policies for each table:**
```sql
-- Allow authenticated users to SELECT all rows
CREATE POLICY "read_all" ON table_name FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to INSERT
CREATE POLICY "insert_authenticated" ON table_name FOR INSERT TO authenticated WITH CHECK (true);

-- Allow authenticated users to UPDATE
CREATE POLICY "update_authenticated" ON table_name FOR UPDATE TO authenticated USING (true);

-- Allow authenticated users to DELETE
CREATE POLICY "delete_authenticated" ON table_name FOR DELETE TO authenticated USING (true);
```

For a more restrictive policy (e.g., only admins can delete):
```sql
CREATE POLICY "only_admin_delete"
ON burials FOR DELETE TO authenticated
USING (
  (SELECT role FROM auth.users WHERE id = auth.uid()) = 'admin'
  OR
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND raw_user_meta_data->>'role' = 'admin'
  )
);
```

---

## How the app talks to Supabase

The Supabase JS client is initialized once in `src/lib/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

All queries go through `src/lib/api.ts`, which wraps the Supabase client:

```ts
// Example of what api.get('/burials') does under the hood:
const { data, error } = await supabase
  .from('burials')
  .select('*')
  .order('burial_date', { ascending: false });
```

The `api.ts` wrapper:
1. Calls the Supabase client method
2. If `error` is non-null, throws a structured `ApiError`
3. Transforms snake_case column names to camelCase on the response
4. Returns the typed data

React Query hooks in `src/hooks/useData.ts` call `api.ts` functions and manage caching.

---

## Viewing and editing data

The **Table Editor** in the Supabase dashboard is the easiest way to browse data.

1. Go to Supabase → Table Editor → select a table
2. You can filter rows using the filter controls at the top
3. Click any row to edit it inline
4. Click the "+ Insert row" button to add data

> ⚠️ **Careful with direct edits.** Editing data directly in the dashboard bypasses the app's validation. Column names are in snake_case here (e.g. `burial_date`), not camelCase.

---

## The SQL editor

The SQL Editor lets you run any PostgreSQL query. It's useful for:

- Bulk updates
- Complex queries across multiple tables
- Schema changes
- Debugging

**How to open it:** Supabase dashboard → SQL Editor → "New Query"

**Example queries:**

```sql
-- Count burials per month in 2025
SELECT
  DATE_TRUNC('month', burial_date) AS month,
  COUNT(*) AS burial_count
FROM burials
WHERE burial_date >= '2025-01-01'
GROUP BY month
ORDER BY month;

-- Find all overdue receivables
SELECT *
FROM accounts_receivable
WHERE status = 'overdue'
ORDER BY due_date ASC;

-- Update a user's role
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  raw_user_meta_data,
  '{role}',
  '"admin"'
)
WHERE email = 'user@detroitmemorialpark.com';
```

---

## Making a schema change

> ⚠️ Schema changes affect the live production database. Be careful.

**Process for adding a column:**

1. Open SQL Editor in Supabase dashboard.
2. Write and preview your ALTER TABLE statement:
   ```sql
   ALTER TABLE burials
   ADD COLUMN cemetery_location text DEFAULT 'east';
   ```
3. Run it.
4. Update the TypeScript type in `src/types/index.ts` to include the new field.
5. Update `src/lib/supabase.ts` (the `Database` type) if needed.
6. Update any forms/tables in the relevant page component.
7. Test locally, then push to trigger a Vercel deploy.

**Process for adding a table:**

1. Create the table in SQL Editor:
   ```sql
   CREATE TABLE reports (
     id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
     title text NOT NULL,
     type text NOT NULL,
     generated_at timestamptz DEFAULT now(),
     data jsonb,
     created_by uuid REFERENCES auth.users(id)
   );
   ```
2. Enable RLS and add policies:
   ```sql
   ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "auth_read" ON reports FOR SELECT TO authenticated USING (true);
   CREATE POLICY "auth_insert" ON reports FOR INSERT TO authenticated WITH CHECK (true);
   ```
3. Add the TypeScript type, API hooks, and UI.

---

## Supabase vocab glossary

| Term | Definition |
|---|---|
| **PostgreSQL** | The industry-standard open-source relational database that Supabase uses under the hood |
| **RLS (Row-Level Security)** | Database-enforced rules controlling which rows a user can read, insert, update, or delete |
| **JWT (JSON Web Token)** | A signed token that proves who you are; passed in every API request |
| **anon key** | The public API key — safe to expose in frontend code; RLS controls what it can access |
| **service_role key** | A bypass key with full database access — NEVER put this in frontend code or commit it |
| **Schema** | The structure of the database: which tables exist, which columns, what types |
| **Policy** | An RLS rule; SQL expression that must evaluate to `true` for an operation to proceed |
| **auth.uid()** | SQL function that returns the UUID of the currently authenticated user |
| **UUID** | Universally Unique Identifier — a random 128-bit string used as a primary key |
| **Trigger** | A database function that runs automatically on INSERT/UPDATE/DELETE |
| **Foreign key** | A column that references the primary key of another table, creating a relationship |

---

← [05 Vercel](05-vercel.md) | Next: [07 Deployment Pipeline](07-deployment.md) →
