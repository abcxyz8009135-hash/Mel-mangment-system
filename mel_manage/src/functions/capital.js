const num = (v) => Number(v) || 0;

// Default capital rows for sessions sorted oldest first (date, then slot).
// Each SIM's telebirr comes from its own first and last session; Reddy comes
// from the first and last session overall. SIMs with no session are left out.
// Values are strings so they can go straight into inputs.
export function defaultCapital(entries) {
  if (!entries.length) return [];

  const sims = new Map();
  entries.forEach((e) => {
    const key = e.simId ?? 'none';
    const current = String(num(e.end?.tele));
    if (sims.has(key)) {
      sims.get(key).current = current;
    } else {
      sims.set(key, { key: `sim-${key}`, label: e.simName || 'No SIM', start: String(num(e.start?.tele)), current });
    }
  });

  const first = entries[0];
  const last = entries[entries.length - 1];
  const reddy = {
    key: 'reddy',
    label: 'Reddy',
    start: String(num(first.start?.reddy)),
    current: String(num(last.end?.reddy)),
  };

  const simRows = [...sims.values()].sort((a, b) => a.label.localeCompare(b.label));
  return [...simRows, reddy];
}

export function capitalTotals(rows) {
  const start = rows.reduce((sum, r) => sum + (parseFloat(r.start) || 0), 0);
  const current = rows.reduce((sum, r) => sum + (parseFloat(r.current) || 0), 0);
  return { start, current, net: current - start };
}
