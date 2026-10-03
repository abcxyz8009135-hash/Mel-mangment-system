import { supabase } from '../lib/supabase';

// All users, active first. Only the admin can read other people's profiles.
export async function fetchProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, active')
    .order('active', { ascending: false })
    .order('full_name', { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export const profileLabel = (p) => `${p.full_name}${p.role === 'admin' ? ' (admin)' : ''}${p.active ? '' : ' — inactive'}`;
