import { supabase } from '../lib/supabase';

const toNumbers = (values) => ({
  tele: parseFloat(values.tele) || 0,
  reddy: parseFloat(values.reddy) || 0,
  deposit: parseFloat(values.deposit) || 0,
  withdrawal: parseFloat(values.withdrawal) || 0,
});

const fromRow = (row) => ({
  id: row.id,
  date: row.session_date,
  session: row.session_slot,
  submittedBy: row.submitted_by,
  name: row.submitter_name,
  start: row.start_values,
  end: row.end_values,
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
      .select('*')
      .order('session_date', { ascending: false })
      .order('session_slot', { ascending: true }),
  );
  return rows.map(fromRow);
}

export async function fetchPendingSessions() {
  const rows = await run(
    supabase
      .from('sessions')
      .select('*')
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
export async function submitSession({ date, session, start, end, note }) {
  const row = await run(
    supabase
      .from('sessions')
      .insert({
        session_date: date,
        session_slot: session,
        start_values: toNumbers(start),
        end_values: toNumbers(end),
        review_note: note ?? null,
      })
      .select()
      .single(),
  );
  return fromRow(row);
}

export async function updateSession(id, { date, session, start, end }) {
  const row = await run(
    supabase
      .from('sessions')
      .update({
        session_date: date,
        session_slot: session,
        start_values: toNumbers(start),
        end_values: toNumbers(end),
      })
      .eq('id', id)
      .select()
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
      .select()
      .single(),
  );
  return fromRow(row);
}

export async function deleteSession(id) {
  const rows = await run(supabase.from('sessions').delete().eq('id', id).select('id'));
  if (!rows.length) throw new Error('Session could not be deleted.');
}
