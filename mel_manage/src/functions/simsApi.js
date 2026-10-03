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

export const simLabel = (sim) => (sim.phone ? `${sim.name} (${sim.phone})` : sim.name);
