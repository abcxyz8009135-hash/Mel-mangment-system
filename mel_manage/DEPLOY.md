# Setup & Deployment

The app is one codebase deployed once per business. Each business has:

- its **own Supabase project** (database + logins), and
- its **own Vercel site**, pointed at that Supabase project.

Nothing is shared between the two copies.

Menu names below match the Supabase and Vercel dashboards at the time of writing; if a label has moved, search the dashboard for it.

---

## 1. Create the Supabase project

1. Sign in at https://supabase.com and click **New project**.
   - For the other business: they should create it **in their own Supabase account**
     and invite you to their organization (Organization → Team → Invite) while you help set it up.
     You can remove yourself afterwards.
2. Choose a name and region (the closest region to Ethiopia is usually Europe, e.g. Frankfurt), set a database password, and save that password somewhere safe.
3. When the project is ready, open **SQL Editor → New query**, paste the whole of
   [`supabase/schema.sql`](supabase/schema.sql) and click **Run**. It should finish with “Success”.
   The script is safe to run again.

## 2. Turn off public sign-ups

**Authentication → Sign In / Providers** → turn **off** “Allow new users to sign up”.
Only you can create accounts after this.

## 3. Create accounts

For each person:

1. **Authentication → Users → Add user → Create new user**.
   Enter their email and a password, and tick **Auto Confirm User**.
2. In **SQL Editor**, set their name and role:

   ```sql
   select public.set_user_profile('abebe@example.com', 'Abebe Kebede', 'staff');
   ```

   For yourself (the approver) use `'admin'`:

   ```sql
   select public.set_user_profile('you@example.com', 'Your Name', 'admin');
   ```

**To remove someone**, deactivate them. Deleting is blocked on purpose, because their sessions must keep pointing to them:

```sql
select public.set_user_active('abebe@example.com', false);   -- reactivate with true
```

## 4. Get the connection values

**Project Settings → API** (or **API Keys**):

- **Project URL** → `VITE_SUPABASE_URL`
- **anon / public** key (or **publishable** key) → `VITE_SUPABASE_ANON_KEY`

The public key is meant to be visible in the browser; the database access rules protect the data.
**Never** use the `service_role` / secret key in the app.

## 5. Run locally (optional)

Copy `.env.example` to `.env.local`, fill in the values, then:

```bash
npm install
npm run dev
```

## 6. Deploy to Vercel

1. Put the project on GitHub (Vercel deploys from a Git repository).
2. At https://vercel.com: **Add New → Project** → import the repository.
   - **Root Directory:** `mel_manage`
   - **Framework preset:** Vite (detected automatically)
3. Under **Environment Variables** add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   and `VITE_BUSINESS_NAME`.
4. Click **Deploy**.

**Second business:** create a *second* Vercel project from the *same* repository, with that business's Supabase values and name. Every code change then deploys to both sites automatically.

## 7. First login and old data

1. Open the site and sign in as the admin.
2. If you open it in the browser you used for the old version, **History** shows an
   “Import to database” button that uploads sessions saved in that browser.
   Imported sessions are recorded as submitted by you, with a note containing the original name.

---

## Everyday reference

| Who | Can |
|---|---|
| Staff | Submit sessions; see approved history and their own pending/rejected sessions |
| Admin | Everything staff can, plus approve/reject, edit and delete any session, manage SIMs, and see the daily Summary |

- Every new session must name the **SIM** it was worked on. The admin adds, renames and deactivates SIMs on the **SIMs** page; a fresh install starts with three dummy SIMs (Phone A/B/C) to rename. Sessions from before SIMs existed show "No SIM".
- There are **4 sessions** per day.
- The **Starting Point** fills in automatically from the end point of the latest *approved* earlier session (any SIM), or 0 if there is none. It refills when the date or session changes; the values can still be edited.
- **Complaints** (optional) are entered as amounts separated by commas. Their total is added to the difference, and the status *after* complaints decides whether the session needs approval.
- **Summary** (admin only) shows one day's totals, split by staff and by SIM. Only approved sessions are counted; pending ones are flagged above the totals.

- A **Match** session (difference within ±150 birr) goes straight to history.
- An **Over** or **Short** session waits on the **Approvals** page until the admin approves it.
- A rejected session frees its date + session slot, so it can be submitted again.
- Every submission, edit, approval, rejection and deletion is recorded in the `audit_log` table
  (Supabase → **Table Editor → audit_log**).

## Changing the rates or tolerance

The calculation exists in two places and **both must be changed together**:

1. `src/functions/calcBalance.js`: the on-screen preview.
2. `calc_session()` in `supabase/schema.sql`: the one that decides Match / Over / Short.
   After editing, re-run the file in the SQL Editor **of each Supabase project**.

## Free plan notes

- Supabase's free plan allows 2 active projects per account, and pauses a project after about a week with no activity. Daily use keeps it awake; a paused project can be resumed from the dashboard.
- Back up regularly: **Table Editor → sessions → Export → CSV**.
