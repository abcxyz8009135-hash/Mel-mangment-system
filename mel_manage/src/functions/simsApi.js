import { supabase } from '../lib/supabase';

async function run(query) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

// All SIMs, active first. Inactive ones are still needed to show old sessions.
export async function fetchSims() {
  return run(
    supabase
      .from('sims')
      .select('*')
      .order('active', { ascending: false })
      .order('name', { ascending: true }),
  );
}

export async function createSim({ name, phone, assignedTo }) {
  return run(
    supabase
      .from('sims')
      .insert({ name: name.trim(), phone: phone.trim(), assigned_to: assignedTo || null })
      .select()
      .single(),
  );
}

export async function updateSim(id, fields) {
  return run(supabase.from('sims').update(fields).eq('id', id).select().single());
}

// Admin only: set a SIM's balance by hand. It is stamped with this
// device's local date and time, like sessions and transfers.
export async function setSimBalance(id, amount) {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const { error } = await supabase.rpc('set_sim_balance', {
    p_sim: id,
    p_amount: amount,
    p_date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    p_time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
  });
  if (error) throw new Error(error.message);
}

// Admin only: every SIM's balance and the Reddy right after a transfer
// (that transfer included): { reddy, sims: { [simId]: balance } }.
export async function fetchCapitalAfterTransfer(transferId) {
  const { data, error } = await supabase.rpc('capital_after_transfer', { p_transfer: transferId });
  if (error) throw new Error(error.message);
  return data;
}

export const simLabel = (sim) => (sim.phone ? `${sim.name} (${sim.phone})` : sim.name);
