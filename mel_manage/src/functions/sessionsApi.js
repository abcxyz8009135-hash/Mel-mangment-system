import { supabase } from '../lib/supabase';

const toNumbers = (values) => ({
  tele: parseFloat(values.tele) || 0,
  reddy: parseFloat(values.reddy) || 0,
  deposit: parseFloat(values.deposit) || 0,
  withdrawal: parseFloat(values.withdrawal) || 0,
});

// Every session query also pulls in its SIM's name and number.
const COLUMNS = '*, sim:sims(id, name, phone)';

const fromRow = (row) => ({
  id: row.id,
  date: row.session_date,
  session: row.session_slot,
  // Postgres returns "HH:MM:SS"; the form and lists use "HH:MM".
  time: row.session_time ? row.session_time.slice(0, 5) : null,
  simId: row.sim_id,
  simName: row.sim?.name ?? null,
  simPhone: row.sim?.phone ?? null,
  submittedBy: row.submitted_by,
  name: row.submitter_name,
  start: row.start_values,
  end: row.end_values,
  complaints: row.complaints ?? [],
  note: row.note ?? null,
  result: row.result,
  approvalStatus: row.approval_status,
  reviewerName: row.reviewer_name,
  reviewedAt: row.reviewed_at,
  reviewNote: row.review_note,
  savedAt: row.created_at,
  updatedAt: row.updated_at,
});

function friendlyError(error) {
  if (error.code === '23505') {
    return 'This date and session already has an entry that is approved or waiting for approval.';
  }
  return error.message;
}

async function run(query) {
  const { data, error } = await query;
  if (error) throw new Error(friendlyError(error));
  return data;
}

export async function fetchSessions() {
  const rows = await run(
    supabase
      .from('sessions')
      .select(COLUMNS)
      .order('session_date', { ascending: false })
      .order('session_slot', { ascending: true }),
  );
  return rows.map(fromRow);
}

// Sessions from `from` to `to`, both dates included.
export async function fetchSessionsInRange(from, to) {
  const rows = await run(
    supabase
      .from('sessions')
      .select(COLUMNS)
      .gte('session_date', from)
      .lte('session_date', to)
      .order('session_date', { ascending: true })
      .order('session_slot', { ascending: true }),
  );
  return rows.map(fromRow);
}

// End values of the latest approved session before this date + slot, or
// null if there is none. Used to prefill the next session's start point.
export async function fetchPreviousEndValues(date, slot) {
  const sameDay = await run(
    supabase
      .from('sessions')
      .select('end_values')
      .eq('approval_status', 'approved')
      .eq('session_date', date)
      .lt('session_slot', slot)
      .order('session_slot', { ascending: false })
      .limit(1),
  );
  if (sameDay.length) return sameDay[0].end_values;

  const earlier = await run(
    supabase
      .from('sessions')
      .select('end_values')
      .eq('approval_status', 'approved')
      .lt('session_date', date)
      .order('session_date', { ascending: false })
      .order('session_slot', { ascending: false })
      .limit(1),
  );
  return earlier.length ? earlier[0].end_values : null;
}

export async function fetchPendingSessions() {
  const rows = await run(
    supabase
      .from('sessions')
      .select(COLUMNS)
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: true }),
  );
  return rows.map(fromRow);
}

export async function fetchPendingCount() {
  const { count, error } = await supabase
    .from('sessions')
    .select('id', { count: 'exact', head: true })
    .eq('approval_status', 'pending');
  if (error) throw new Error(friendlyError(error));
  return count ?? 0;
}

// The database fills in the submitter, recalculates the result and decides
// the approval status itself, so none of those are sent from here.
export async function submitSession({ date, session, time, simId, start, end, complaints, note }) {
  const row = await run(
    supabase
      .from('sessions')
      .insert({
        session_date: date,
        session_slot: session,
        session_time: time || null,
        sim_id: simId || null,
        start_values: toNumbers(start),
        end_values: toNumbers(end),
        complaints: complaints ?? [],
        note: note || null,
      })
      .select(COLUMNS)
      .single(),
  );
  return fromRow(row);
}

export async function updateSession(id, { date, session, time, simId, start, end, complaints, note }) {
  const row = await run(
    supabase
      .from('sessions')
      .update({
        session_date: date,
        session_slot: session,
        session_time: time || null,
        sim_id: simId || null,
        start_values: toNumbers(start),
        end_values: toNumbers(end),
        complaints: complaints ?? [],
        note: note || null,
      })
      .eq('id', id)
      .select(COLUMNS)
      .single(),
  );
  return fromRow(row);
}

export async function reviewSession(id, approvalStatus, note) {
  const row = await run(
    supabase
      .from('sessions')
      .update({ approval_status: approvalStatus, review_note: note || null })
      .eq('id', id)
      .select(COLUMNS)
      .single(),
  );
  return fromRow(row);
}

export async function deleteSession(id) {
  const rows = await run(supabase.from('sessions').delete().eq('id', id).select('id'));
  if (!rows.length) throw new Error('Session could not be deleted.');
}
