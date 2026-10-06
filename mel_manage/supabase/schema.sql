-- =====================================================================
-- Mel Management — database schema
-- Run ONCE per Supabase project: Dashboard → SQL Editor → New query →
-- paste this whole file → Run.
-- Each business (copy of the app) has its own Supabase project, so
-- run this in both projects.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Profiles: one row per login. Role is set by the database owner only.
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete restrict,
  full_name   text not null,
  role        text not null default 'staff' check (role in ('admin', 'staff')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Create a profile automatically whenever a user is added in the dashboard.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------------------------------------------------------------------
-- Helpers used by access rules
-- ---------------------------------------------------------------------
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active and role = 'admin');
$$;


-- ---------------------------------------------------------------------
-- Session calculation (authoritative copy).
-- KEEP IN SYNC with src/functions/calcBalance.js — rates, tolerance and
-- formulas must match. The app's copy is only a preview; this one decides
-- Match / Over / Short and therefore whether approval is needed.
-- ---------------------------------------------------------------------
create or replace function public.num_or_zero(v jsonb, k text)
returns numeric
language sql
immutable
as $$
  select coalesce(nullif(v ->> k, '')::numeric, 0);
$$;

create or replace function public.clean_values(v jsonb)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'tele',       public.num_or_zero(v, 'tele'),
    'reddy',      public.num_or_zero(v, 'reddy'),
    'deposit',    public.num_or_zero(v, 'deposit'),
    'withdrawal', public.num_or_zero(v, 'withdrawal')
  );
$$;

-- Complaints: a list of positive amounts. Anything else is rejected.
create or replace function public.clean_complaints(v jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  item jsonb;
  n numeric;
  cleaned jsonb := '[]'::jsonb;
begin
  if v is null or jsonb_typeof(v) = 'null' then
    return cleaned;
  end if;
  if jsonb_typeof(v) <> 'array' then
    raise exception 'Complaints must be a list of amounts.';
  end if;

  for item in select value from jsonb_array_elements(v) loop
    begin
      n := (item #>> '{}')::numeric;
    exception when others then
      raise exception 'Complaint amounts must be numbers.';
    end;
    if n is null or n <= 0 then
      raise exception 'Complaint amounts must be positive numbers.';
    end if;
    cleaned := cleaned || to_jsonb(n);
  end loop;

  return cleaned;
end;
$$;

-- The two-argument version from before complaints existed.
drop function if exists public.calc_session(jsonb, jsonb);

create or replace function public.calc_session(s jsonb, e jsonb, c jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  deposit_rate    constant numeric := 0.03;
  withdrawal_rate constant numeric := 0.02;
  match_tolerance constant numeric := 150;

  s_tele numeric := public.num_or_zero(s, 'tele');
  s_reddy numeric := public.num_or_zero(s, 'reddy');
  s_deposit numeric := public.num_or_zero(s, 'deposit');
  s_withdrawal numeric := public.num_or_zero(s, 'withdrawal');
  e_tele numeric := public.num_or_zero(e, 'tele');
  e_reddy numeric := public.num_or_zero(e, 'reddy');
  e_deposit numeric := public.num_or_zero(e, 'deposit');
  e_withdrawal numeric := public.num_or_zero(e, 'withdrawal');

  start_total numeric;
  end_total numeric;
  session_profit numeric;
  deposit_in numeric;
  withdrawal_in numeric;
  deposit_comm numeric;
  withdrawal_comm numeric;
  total_comm numeric;
  diff numeric;
  status text;
  expected_tele numeric;
  expected_reddy numeric;
  warnings text[] := '{}';

  complaint_list jsonb := coalesce(c, '[]'::jsonb);
  complaint_count integer := jsonb_array_length(coalesce(c, '[]'::jsonb));
  complaints_total numeric := coalesce(
    (select sum((x #>> '{}')::numeric) from jsonb_array_elements(coalesce(c, '[]'::jsonb)) as x), 0);
  adjusted_diff numeric;
  adjusted_status text;
begin
  start_total := s_tele + s_reddy;
  end_total := e_tele + e_reddy;
  session_profit := end_total - start_total;

  deposit_in := e_deposit - s_deposit;
  withdrawal_in := e_withdrawal - s_withdrawal;
  deposit_comm := deposit_in * deposit_rate;
  withdrawal_comm := withdrawal_in * withdrawal_rate;
  total_comm := deposit_comm + withdrawal_comm;

  diff := session_profit - total_comm;
  status := case
    when diff > match_tolerance then 'Over'
    when diff < -match_tolerance then 'Short'
    else 'Match'
  end;

  -- Complaints worked in the session are added to the difference.
  adjusted_diff := diff + complaints_total;
  adjusted_status := case
    when adjusted_diff > match_tolerance then 'Over'
    when adjusted_diff < -match_tolerance then 'Short'
    else 'Match'
  end;

  expected_tele := s_tele + (deposit_in - withdrawal_in);
  expected_reddy := s_reddy + (withdrawal_in * (1 + withdrawal_rate) - deposit_in * (1 - deposit_rate));

  if deposit_in < 0 then
    warnings := array_append(warnings, 'End deposit is lower than start deposit.');
  end if;
  if withdrawal_in < 0 then
    warnings := array_append(warnings, 'End withdrawal is lower than start withdrawal.');
  end if;

  return jsonb_build_object(
    'startTotal', start_total,
    'endTotal', end_total,
    'sessionProfit', session_profit,
    'depositInSession', deposit_in,
    'withdrawalInSession', withdrawal_in,
    'depositCommission', deposit_comm,
    'withdrawalCommission', withdrawal_comm,
    'totalCommission', total_comm,
    'difference', diff,
    'status', status,
    'complaints', complaint_list,
    'complaintCount', complaint_count,
    'complaintsTotal', complaints_total,
    'adjustedDifference', adjusted_diff,
    'adjustedStatus', adjusted_status,
    'expectedTele', expected_tele,
    'expectedReddy', expected_reddy,
    'actualTele', e_tele,
    'actualReddy', e_reddy,
    'teleGap', e_tele - expected_tele,
    'reddyGap', e_reddy - expected_reddy,
    'warnings', to_jsonb(warnings)
  );
end;
$$;


-- ---------------------------------------------------------------------
-- SIMs / phones. Managed by the admin from the app's SIMs page.
-- Deactivate instead of deleting so old sessions keep pointing to them.
-- ---------------------------------------------------------------------
create table if not exists public.sims (
  id          bigint generated always as identity primary key,
  name        text not null,
  phone       text not null default '',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Dummy SIMs for a fresh install; rename them on the SIMs page.
insert into public.sims (name, phone)
select v.name, v.phone
from (values ('Phone A', '0911 000 001'), ('Phone B', '0911 000 002'), ('Phone C', '0911 000 003')) as v (name, phone)
where not exists (select 1 from public.sims);

-- The one user (staff or admin) a SIM is assigned to; empty = unassigned.
-- Staff can only submit sessions on their own SIMs.
alter table public.sims add column if not exists assigned_to uuid references public.profiles (id) on delete restrict;
create index if not exists sims_assigned_idx on public.sims (assigned_to);


-- ---------------------------------------------------------------------
-- Sessions
-- ---------------------------------------------------------------------
create table if not exists public.sessions (
  id               bigint generated always as identity primary key,
  session_date     date not null,
  session_slot     text not null check (session_slot in ('Session 1', 'Session 2', 'Session 3', 'Session 4')),
  session_time     time,                   -- time of day entered by the submitter
  sim_id           bigint references public.sims (id) on delete restrict,
  submitted_by     uuid not null references public.profiles (id) on delete restrict,
  submitter_name   text not null,          -- copy of the name at submission time
  start_values     jsonb not null,
  end_values       jsonb not null,
  complaints       jsonb not null default '[]'::jsonb,
  note             text,                   -- submitter's optional note
  result           jsonb not null,
  calc_status      text not null check (calc_status in ('Match', 'Over', 'Short')),
  approval_status  text not null check (approval_status in ('pending', 'approved', 'rejected')),
  reviewed_by      uuid references public.profiles (id) on delete restrict,
  reviewer_name    text,
  reviewed_at      timestamptz,
  review_note      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Upgrades for projects created before SIMs and Session 4 existed.
-- Old sessions keep an empty SIM.
alter table public.sessions add column if not exists sim_id bigint references public.sims (id) on delete restrict;
alter table public.sessions drop constraint if exists sessions_session_slot_check;
alter table public.sessions add constraint sessions_session_slot_check
  check (session_slot in ('Session 1', 'Session 2', 'Session 3', 'Session 4'));

alter table public.sessions add column if not exists complaints jsonb not null default '[]'::jsonb;

-- Upgrades for projects created before session time and notes existed.
-- Old sessions keep an empty time and note.
alter table public.sessions add column if not exists session_time time;
alter table public.sessions add column if not exists note text;

create index if not exists sessions_sim_idx on public.sessions (sim_id);

-- Only one pending-or-approved entry per date + session. Rejected entries
-- free the slot so the session can be resubmitted.
create unique index if not exists sessions_one_active_per_slot
  on public.sessions (session_date, session_slot)
  where approval_status in ('pending', 'approved');

create index if not exists sessions_date_idx on public.sessions (session_date desc);
create index if not exists sessions_status_idx on public.sessions (approval_status);
create index if not exists sessions_submitter_idx on public.sessions (submitted_by);

-- On insert: stamp the submitter, recalculate, and decide approval.
create or replace function public.sessions_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid() and active;
  if me.id is null then
    raise exception 'Your account is not active.';
  end if;

  -- Staff must pick an active SIM assigned to them. The admin may use any
  -- SIM, or leave it empty so old browser data (which has no SIM) can be
  -- imported.
  if new.sim_id is null then
    if me.role <> 'admin' then
      raise exception 'Choose a SIM.';
    end if;
  elsif not exists (select 1 from public.sims where id = new.sim_id and active) then
    raise exception 'That SIM is not active.';
  elsif me.role <> 'admin'
        and not exists (select 1 from public.sims where id = new.sim_id and assigned_to = me.id) then
    raise exception 'That SIM is not assigned to you.';
  end if;

  new.submitted_by := me.id;
  new.submitter_name := me.full_name;
  new.start_values := public.clean_values(new.start_values);
  new.end_values := public.clean_values(new.end_values);
  new.complaints := public.clean_complaints(new.complaints);
  new.note := nullif(btrim(new.note), '');
  new.result := public.calc_session(new.start_values, new.end_values, new.complaints);
  -- Status after complaints; this is what decides approval.
  new.calc_status := new.result ->> 'adjustedStatus';
  new.created_at := now();
  new.updated_at := now();

  if me.role = 'admin' then
    -- Admin submissions are approved by the admin themself; a note is kept.
    new.approval_status := 'approved';
    new.reviewed_by := me.id;
    new.reviewer_name := me.full_name;
    new.reviewed_at := now();
  else
    new.approval_status := case when new.calc_status = 'Match' then 'approved' else 'pending' end;
    new.reviewed_by := null;
    new.reviewer_name := null;
    new.reviewed_at := null;
    new.review_note := null;
  end if;

  return new;
end;
$$;

drop trigger if exists sessions_before_insert on public.sessions;
create trigger sessions_before_insert
  before insert on public.sessions
  for each row execute function public.sessions_before_insert();

-- On update (admin only, see policies): keep submitter fields fixed,
-- recalculate, and stamp the reviewer when the approval status changes.
create or replace function public.sessions_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();

  if new.sim_id is distinct from old.sim_id and new.sim_id is not null
     and not exists (select 1 from public.sims where id = new.sim_id and active) then
    raise exception 'That SIM is not active.';
  end if;

  new.submitted_by := old.submitted_by;
  new.submitter_name := old.submitter_name;
  new.created_at := old.created_at;
  new.start_values := public.clean_values(new.start_values);
  new.end_values := public.clean_values(new.end_values);
  new.complaints := public.clean_complaints(new.complaints);
  new.note := nullif(btrim(new.note), '');
  new.result := public.calc_session(new.start_values, new.end_values, new.complaints);
  -- Status after complaints; this is what decides approval.
  new.calc_status := new.result ->> 'adjustedStatus';
  new.updated_at := now();

  if new.approval_status is distinct from old.approval_status then
    new.reviewed_by := me.id;
    new.reviewer_name := me.full_name;
    new.reviewed_at := now();
  else
    new.reviewed_by := old.reviewed_by;
    new.reviewer_name := old.reviewer_name;
    new.reviewed_at := old.reviewed_at;
  end if;

  return new;
end;
$$;

drop trigger if exists sessions_before_update on public.sessions;
create trigger sessions_before_update
  before update on public.sessions
  for each row execute function public.sessions_before_update();


-- ---------------------------------------------------------------------
-- Change log: every insert, edit, approval, rejection and delete.
-- Only admins can read it; nobody can write to it except the trigger.
-- ---------------------------------------------------------------------
create table if not exists public.audit_log (
  id               bigint generated always as identity primary key,
  action           text not null,        -- insert | update | approve | reject | delete | set_balance
  session_id       bigint,               -- no FK so the log survives deletes
  changed_by       uuid,
  changed_by_name  text,
  changed_at       timestamptz not null default now(),
  old_data         jsonb,
  new_data         jsonb
);

create or replace function public.sessions_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  who_name text;
  act text;
begin
  select full_name into who_name from public.profiles where id = auth.uid();

  if tg_op = 'INSERT' then
    insert into public.audit_log (action, session_id, changed_by, changed_by_name, new_data)
    values ('insert', new.id, auth.uid(), who_name, to_jsonb(new));
  elsif tg_op = 'UPDATE' then
    act := case
      when new.approval_status is distinct from old.approval_status and new.approval_status = 'approved' then 'approve'
      when new.approval_status is distinct from old.approval_status and new.approval_status = 'rejected' then 'reject'
      else 'update'
    end;
    insert into public.audit_log (action, session_id, changed_by, changed_by_name, old_data, new_data)
    values (act, new.id, auth.uid(), who_name, to_jsonb(old), to_jsonb(new));
  else
    insert into public.audit_log (action, session_id, changed_by, changed_by_name, old_data)
    values ('delete', old.id, auth.uid(), who_name, to_jsonb(old));
  end if;

  return null;
end;
$$;

drop trigger if exists sessions_audit on public.sessions;
create trigger sessions_audit
  after insert or update or delete on public.sessions
  for each row execute function public.sessions_audit();


-- ---------------------------------------------------------------------
-- Money transfers (telebirr) between the owner, the admin and staff.
-- They move SIM balances (see "SIM balances" below). The admin records
-- and edits any transfer; staff record transfers from their own SIMs and
-- see the ones they are part of.
-- A person side names that person's SIM; the Owner side (user = null)
-- has no SIM. From Owner = working capital in, to Owner = capital out.
-- ---------------------------------------------------------------------
create table if not exists public.transfers (
  id               bigint generated always as identity primary key,
  transfer_date    date not null,
  transfer_time    time,
  from_user        uuid references public.profiles (id) on delete restrict,  -- null = Owner
  from_sim_id      bigint references public.sims (id) on delete restrict,
  to_user          uuid references public.profiles (id) on delete restrict,  -- null = Owner
  to_sim_id        bigint references public.sims (id) on delete restrict,
  amount           numeric not null check (amount > 0),
  kind             text generated always as (
                     case
                       when from_user is null then 'capital_in'
                       when to_user is null then 'capital_out'
                     end
                   ) stored,
  note             text,
  created_by       uuid not null references public.profiles (id) on delete restrict,
  created_by_name  text not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint transfers_parties_check check (
    (from_user is null) = (from_sim_id is null)
    and (to_user is null) = (to_sim_id is null)
    and not (from_user is null and to_user is null)
    and from_sim_id is distinct from to_sim_id
  )
);

create index if not exists transfers_date_idx on public.transfers (transfer_date desc);

-- Stamp who entered it and check each SIM belongs to its person. On an
-- edit, a side that did not change is not re-checked, so a SIM that was
-- since reassigned or deactivated stays valid on old transfers.
create or replace function public.transfers_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles;
  check_from boolean := true;
  check_to boolean := true;
begin
  select * into me from public.profiles where id = auth.uid() and active;
  if me.id is null then
    raise exception 'Your account is not active.';
  end if;

  if tg_op = 'INSERT' then
    new.created_by := me.id;
    new.created_by_name := me.full_name;
    new.created_at := now();
  else
    new.created_by := old.created_by;
    new.created_by_name := old.created_by_name;
    new.created_at := old.created_at;
    check_from := new.from_user is distinct from old.from_user or new.from_sim_id is distinct from old.from_sim_id;
    check_to := new.to_user is distinct from old.to_user or new.to_sim_id is distinct from old.to_sim_id;
  end if;

  if check_from and new.from_sim_id is not null
     and not exists (select 1 from public.sims where id = new.from_sim_id and active and assigned_to = new.from_user) then
    raise exception 'The From SIM must be an active SIM assigned to that person.';
  end if;
  if check_to and new.to_sim_id is not null
     and not exists (select 1 from public.sims where id = new.to_sim_id and active and assigned_to = new.to_user) then
    raise exception 'The To SIM must be an active SIM assigned to that person.';
  end if;

  new.note := nullif(btrim(new.note), '');
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists transfers_before_write on public.transfers;
create trigger transfers_before_write
  before insert or update on public.transfers
  for each row execute function public.transfers_before_write();

-- Transfers go in the same change log as sessions.
alter table public.audit_log add column if not exists transfer_id bigint;  -- no FK, like session_id

create or replace function public.transfers_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  who_name text;
begin
  select full_name into who_name from public.profiles where id = auth.uid();

  if tg_op = 'INSERT' then
    insert into public.audit_log (action, transfer_id, changed_by, changed_by_name, new_data)
    values ('insert', new.id, auth.uid(), who_name, to_jsonb(new));
  elsif tg_op = 'UPDATE' then
    insert into public.audit_log (action, transfer_id, changed_by, changed_by_name, old_data, new_data)
    values ('update', new.id, auth.uid(), who_name, to_jsonb(old), to_jsonb(new));
  else
    insert into public.audit_log (action, transfer_id, changed_by, changed_by_name, old_data)
    values ('delete', old.id, auth.uid(), who_name, to_jsonb(old));
  end if;

  return null;
end;
$$;

drop trigger if exists transfers_audit on public.transfers;
create trigger transfers_audit
  after insert or update or delete on public.transfers
  for each row execute function public.transfers_audit();


-- ---------------------------------------------------------------------
-- SIM balances: each SIM's current telebirr balance, kept by the
-- database. It starts from the SIM's latest reading, which is either
--   * the end telebirr of its latest approved session, or
--   * a balance the admin entered by hand on the SIMs page,
-- whichever is later, and adds transfers received and subtracts
-- transfers sent after that reading (all transfers if there is none).
-- On the same day a transfer counts as after a session unless both have
-- a time and the transfer's is earlier; it counts as after a hand-entered
-- balance only if its time is later. A session counts as after a
-- hand-entered balance only if its date is later, or it is the same day
-- and its time is later.
-- It is worked out again from scratch whenever a session or transfer on
-- the SIM changes, so edits, approvals and deletes can't make it drift.
-- The app can read it but only change it through set_sim_balance().
-- ---------------------------------------------------------------------
alter table public.sims add column if not exists balance numeric not null default 0;
alter table public.sims add column if not exists balance_updated_at timestamptz;
-- The last balance entered by hand, and the local date and time it was entered.
alter table public.sims add column if not exists balance_set_amount numeric;
alter table public.sims add column if not exists balance_set_date date;
alter table public.sims add column if not exists balance_set_time time;

create or replace function public.refresh_sim_balance(p_sim bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sim public.sims;
  last_session public.sessions;
  use_hand_entered boolean;
  base numeric;
  moved numeric;
begin
  select * into sim from public.sims where id = p_sim;
  if sim.id is null then
    return;
  end if;

  select * into last_session
  from public.sessions
  where sim_id = p_sim and approval_status = 'approved'
  order by session_date desc, session_slot desc
  limit 1;

  use_hand_entered := sim.balance_set_date is not null and (
    last_session.id is null
    or last_session.session_date < sim.balance_set_date
    or (last_session.session_date = sim.balance_set_date
        and (last_session.session_time is null or last_session.session_time <= sim.balance_set_time))
  );

  if use_hand_entered then
    base := sim.balance_set_amount;
    select coalesce(sum(case when t.to_sim_id = p_sim then t.amount else -t.amount end), 0)
    into moved
    from public.transfers t
    where (t.to_sim_id = p_sim or t.from_sim_id = p_sim)
      and (t.transfer_date > sim.balance_set_date
           or (t.transfer_date = sim.balance_set_date and t.transfer_time > sim.balance_set_time));
  else
    base := public.num_or_zero(last_session.end_values, 'tele');
    select coalesce(sum(case when t.to_sim_id = p_sim then t.amount else -t.amount end), 0)
    into moved
    from public.transfers t
    where (t.to_sim_id = p_sim or t.from_sim_id = p_sim)
      and (
        last_session.id is null
        or t.transfer_date > last_session.session_date
        or (t.transfer_date = last_session.session_date
            and (t.transfer_time is null or last_session.session_time is null
                 or t.transfer_time >= last_session.session_time))
      );
  end if;

  update public.sims
  set balance = base + moved,
      balance_updated_at = now()
  where id = p_sim;
end;
$$;

create or replace function public.sessions_refresh_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'INSERT' then
    perform public.refresh_sim_balance(old.sim_id);
  end if;
  if tg_op <> 'DELETE' then
    perform public.refresh_sim_balance(new.sim_id);
  end if;
  return null;
end;
$$;

drop trigger if exists sessions_refresh_balance on public.sessions;
create trigger sessions_refresh_balance
  after insert or update or delete on public.sessions
  for each row execute function public.sessions_refresh_balance();

create or replace function public.transfers_refresh_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'INSERT' then
    perform public.refresh_sim_balance(old.from_sim_id);
    perform public.refresh_sim_balance(old.to_sim_id);
  end if;
  if tg_op <> 'DELETE' then
    perform public.refresh_sim_balance(new.from_sim_id);
    perform public.refresh_sim_balance(new.to_sim_id);
  end if;
  return null;
end;
$$;

drop trigger if exists transfers_refresh_balance on public.transfers;
create trigger transfers_refresh_balance
  after insert or update or delete on public.transfers
  for each row execute function public.transfers_refresh_balance();

revoke execute on function public.refresh_sim_balance(bigint) from public, anon, authenticated;

-- Admin only: set a SIM's balance by hand. p_date / p_time are the admin's
-- local date and time, so they line up with session and transfer times.
-- Each change goes in the change log.
create or replace function public.set_sim_balance(p_sim bigint, p_amount numeric, p_date date, p_time time)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  old_sim public.sims;
  who_name text;
begin
  if not public.is_admin() then
    raise exception 'Only the admin can set a SIM balance.';
  end if;
  if p_amount is null or p_date is null or p_time is null then
    raise exception 'Enter the balance.';
  end if;

  select * into old_sim from public.sims where id = p_sim;
  if old_sim.id is null then
    raise exception 'SIM not found.';
  end if;

  update public.sims
  set balance_set_amount = p_amount, balance_set_date = p_date, balance_set_time = p_time
  where id = p_sim;
  perform public.refresh_sim_balance(p_sim);

  select full_name into who_name from public.profiles where id = auth.uid();
  insert into public.audit_log (action, changed_by, changed_by_name, old_data, new_data)
  values (
    'set_balance', auth.uid(), who_name,
    jsonb_build_object('sim_id', p_sim, 'balance', old_sim.balance),
    jsonb_build_object('sim_id', p_sim, 'balance', p_amount, 'date', p_date, 'time', p_time)
  );
end;
$$;

revoke execute on function public.set_sim_balance(bigint, numeric, date, time) from public, anon;
grant execute on function public.set_sim_balance(bigint, numeric, date, time) to authenticated;

-- Fill in every SIM's balance (on first run, and again on every re-run).
select public.refresh_sim_balance(id) from public.sims;


-- ---------------------------------------------------------------------
-- Everyone's name, for choosing who a transfer goes to. Staff cannot read
-- other profiles directly.
-- ---------------------------------------------------------------------
create or replace function public.people()
returns table (id uuid, full_name text, role text, active boolean)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.role, p.active
  from public.profiles p
  where public.is_active_user()
  order by p.active desc, p.full_name;
$$;

revoke execute on function public.people() from public, anon;
grant execute on function public.people() to authenticated;


-- ---------------------------------------------------------------------
-- Access rules (row level security)
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.audit_log enable row level security;
alter table public.sims enable row level security;
alter table public.transfers enable row level security;

-- Logged-out visitors get nothing.
revoke all on public.profiles, public.sessions, public.audit_log, public.sims, public.transfers from anon;
-- SIMs are deactivated, never deleted, and their balance is only set by
-- the database.
revoke delete on public.sims from authenticated;
revoke insert, update on public.sims from authenticated;
grant insert (name, phone, active, assigned_to) on public.sims to authenticated;
grant update (name, phone, active, assigned_to) on public.sims to authenticated;
-- Nobody writes to profiles or the log from the app.
revoke insert, update, delete on public.profiles, public.audit_log from authenticated;

drop policy if exists "profiles: read own or admin" on public.profiles;
create policy "profiles: read own or admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- Everyone active sees approved history; submitters see their own
-- pending/rejected entries; the admin sees everything.
drop policy if exists "sessions: read" on public.sessions;
create policy "sessions: read" on public.sessions
  for select to authenticated
  using (
    public.is_admin()
    or submitted_by = auth.uid()
    or (approval_status = 'approved' and public.is_active_user())
  );

drop policy if exists "sessions: submit" on public.sessions;
create policy "sessions: submit" on public.sessions
  for insert to authenticated
  with check (public.is_active_user() and submitted_by = auth.uid());

drop policy if exists "sessions: admin update" on public.sessions;
create policy "sessions: admin update" on public.sessions
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "sessions: admin delete" on public.sessions;
create policy "sessions: admin delete" on public.sessions
  for delete to authenticated
  using (public.is_admin());

-- Everyone active can read all SIMs (inactive ones are still shown on
-- old sessions); only the admin adds or edits them.
drop policy if exists "sims: read" on public.sims;
create policy "sims: read" on public.sims
  for select to authenticated
  using (public.is_active_user());

drop policy if exists "sims: admin insert" on public.sims;
create policy "sims: admin insert" on public.sims
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists "sims: admin update" on public.sims;
create policy "sims: admin update" on public.sims
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- The admin sees and changes every transfer. Staff see the transfers they
-- sent or received, and record new ones from their own SIMs (the trigger
-- checks the SIM is theirs); they cannot edit or delete.
drop policy if exists "transfers: admin all" on public.transfers;
create policy "transfers: admin all" on public.transfers
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "transfers: staff read own" on public.transfers;
create policy "transfers: staff read own" on public.transfers
  for select to authenticated
  using (public.is_active_user() and (from_user = auth.uid() or to_user = auth.uid()));

drop policy if exists "transfers: staff send" on public.transfers;
create policy "transfers: staff send" on public.transfers
  for insert to authenticated
  with check (public.is_active_user() and from_user = auth.uid());

drop policy if exists "audit: admin read" on public.audit_log;
create policy "audit: admin read" on public.audit_log
  for select to authenticated
  using (public.is_admin());


-- ---------------------------------------------------------------------
-- Owner tools — run these in the SQL Editor only. They are blocked from
-- the app.
--
--   select public.set_user_profile('someone@example.com', 'Full Name', 'staff');
--   select public.set_user_profile('you@example.com', 'Your Name', 'admin');
--   select public.set_user_active('someone@example.com', false);  -- deactivate
-- ---------------------------------------------------------------------
create or replace function public.set_user_profile(p_email text, p_full_name text, p_role text default 'staff')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
begin
  select id into uid from auth.users where lower(email) = lower(p_email);
  if uid is null then
    raise exception 'No user with email %. Add them under Authentication → Users first.', p_email;
  end if;

  insert into public.profiles (id, full_name, role)
  values (uid, p_full_name, p_role)
  on conflict (id) do update set full_name = excluded.full_name, role = excluded.role;
end;
$$;

create or replace function public.set_user_active(p_email text, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set active = p_active
  where id = (select id from auth.users where lower(email) = lower(p_email));

  if not found then
    raise exception 'No profile for email %', p_email;
  end if;
end;
$$;

revoke execute on function public.set_user_profile(text, text, text) from public, anon, authenticated;
revoke execute on function public.set_user_active(text, boolean) from public, anon, authenticated;
