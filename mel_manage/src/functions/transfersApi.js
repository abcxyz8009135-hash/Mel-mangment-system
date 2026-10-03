import { supabase } from '../lib/supabase';

// A side of a transfer is the Owner (user = null, no SIM) or a person + SIM.
export const OWNER = 'owner';

export const KIND_LABELS = { capital_in: 'Working capital in', capital_out: 'Capital out' };

const fromRow = (row) => ({
  id: row.id,
  date: row.transfer_date,
  // Postgres returns "HH:MM:SS"; the form and list use "HH:MM".
  time: row.transfer_time ? row.transfer_time.slice(0, 5) : '',
  fromUser: row.from_user ?? OWNER,
  fromSimId: row.from_sim_id,
  toUser: row.to_user ?? OWNER,
  toSimId: row.to_sim_id,
  amount: Number(row.amount),
  kind: row.kind,
  note: row.note ?? '',
  createdByName: row.created_by_name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toRow = ({ date, time, fromUser, fromSimId, toUser, toSimId, amount, note }) => ({
  transfer_date: date,
  transfer_time: time || null,
  from_user: fromUser === OWNER ? null : fromUser,
  from_sim_id: fromUser === OWNER ? null : fromSimId,
  to_user: toUser === OWNER ? null : toUser,
  to_sim_id: toUser === OWNER ? null : toSimId,
  amount,
  note: note || null,
});

function friendlyError(error) {
  if (error.message.includes('transfers_parties_check')) {
    return 'Choose a SIM for each person, use the Owner on one side at most, and pick two different SIMs.';
  }
  return error.message;
}

async function run(query) {
  const { data, error } = await query;
  if (error) throw new Error(friendlyError(error));
  return data;
}

// Transfers from `from` to `to`, both dates included, newest first.
export async function fetchTransfersInRange(from, to) {
  const rows = await run(
    supabase
      .from('transfers')
      .select('*')
      .gte('transfer_date', from)
      .lte('transfer_date', to)
      .order('transfer_date', { ascending: false })
      .order('transfer_time', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false }),
  );
  return rows.map(fromRow);
}

export async function createTransfer(values) {
  return fromRow(await run(supabase.from('transfers').insert(toRow(values)).select().single()));
}

export async function updateTransfer(id, values) {
  return fromRow(await run(supabase.from('transfers').update(toRow(values)).eq('id', id).select().single()));
}

export async function deleteTransfer(id) {
  const rows = await run(supabase.from('transfers').delete().eq('id', id).select('id'));
  if (!rows.length) throw new Error('Transfer could not be deleted.');
}
