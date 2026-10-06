const num = (v) => Number(v) || 0;

// Capital rows from a starting point to now: one per SIM plus Reddy.
// `start` is { reddy, sims: { [simId]: balance } } at the starting point;
// Current is each SIM's stored balance and `currentReddy`. Inactive SIMs
// only show while they hold money at either end.
export function capitalRows(sims, start, currentReddy) {
  const simRows = sims
    .map((s) => ({ key: `sim-${s.id}`, label: s.name, active: s.active, start: num(start.sims?.[s.id]), current: num(s.balance) }))
    .filter((r) => r.active || r.start !== 0 || r.current !== 0)
    .sort((a, b) => a.label.localeCompare(b.label));
  return [...simRows, { key: 'reddy', label: 'Reddy', start: num(start.reddy), current: num(currentReddy) }];
}

export function capitalTotals(rows) {
  const start = rows.reduce((sum, r) => sum + r.start, 0);
  const current = rows.reduce((sum, r) => sum + r.current, 0);
  return { start, current, net: current - start };
}
