# Supabase Setup Guide

This guide walks you through creating a Supabase project and configuring it for **SupplyTrack**.

---

## 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign in (or create a free account).
2. Click **"New Project"**.
3. Fill in:
   - **Name**: `supplytrack` (or any name you prefer)
   - **Database Password**: choose a strong password and save it somewhere safe
   - **Region**: pick the region closest to you
4. Click **"Create new project"** and wait ~2 minutes for provisioning.

---

## 2. Run the Schema SQL

Once the project is ready:

1. In the left sidebar, go to **SQL Editor**.
2. Click **"New query"**.
3. Copy the entire contents of [`initialize/relational_db.sql`](./relational_db.sql) and paste it into the editor.
4. Click **"Run"** (or press `Ctrl+Enter`).

You should see confirmation that all tables were created successfully.

---

## 3. Get Your API Keys

1. In the left sidebar, go to **Project Settings → API**.
2. Copy the following values:

| Variable | Where to find it |
|---|---|
| `API_URL` | **Project URL** (e.g. `https://xyzxyz.supabase.co`) |
| `ANON_API_KEY` | **anon / public** key under "Project API keys" |
| `SERVICE_ROLE_KEY` | **service_role** key under "Project API keys" |

> [!CAUTION]
> The `SERVICE_ROLE_KEY` bypasses all Row Level Security policies. **Never expose it in frontend code or commit it to version control.**

---

## 4. Configure Your `.env` File

In the **root of the project**, copy `.env.example` to `.env`:

```bash
# Windows (PowerShell)
Copy-Item .env.example .env

# macOS / Linux
cp .env.example .env
```

Then open `.env` and fill in your values:

```env
API_URL="https://<your-project-ref>.supabase.co"
ANON_API_KEY="<your-supabase-anon-key>"
SERVICE_ROLE_KEY="<your-supabase-service-role-key>"
```

---

## 5. (Optional) Seed the Database

A data generation script is included to populate the database with realistic test data.

1. Make sure your `.env` is configured.
2. Install dependencies if you haven't already:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the seed script:
   ```bash
   python scripts/generate_data.py
   ```

This will populate the `product`, `supplier`, `transport_method`, `users`, `supplier_product`, `orders`, `order_item`, and `carbon_goal` tables with synthetic data.

---

## 6. (Optional) Enable Row Level Security

By default, Supabase enables RLS on new tables but with no policies, so no reads/writes are possible from the client. If you're using the **anon key** in a production context:

1. In the Supabase dashboard, go to **Authentication → Policies**.
2. Add appropriate `SELECT`, `INSERT`, `UPDATE`, and `DELETE` policies for each table.

For this course project, you can also **disable RLS** on each table for simplicity:

> In **Table Editor**, click a table → **Edit Table** → toggle off **Enable Row Level Security**.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `401 Unauthorized` from API | Check that `ANON_API_KEY` is correct and the `.env` file is loaded |
| `relation "public.orders" does not exist` | Re-run the SQL from Step 2 |
| Tables show in the dashboard but queries fail | Ensure RLS is disabled or correct policies are set |
| `SERVICE_ROLE_KEY` not working | Make sure you copied the full key with no extra spaces |
