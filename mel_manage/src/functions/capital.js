const num = (v) => Number(v) || 0;

// Capital rows: one per SIM plus Reddy. Starting is typed in by the admin
// (`starts`, by row key); Current is each SIM's stored balance and the
// Reddy of the latest approved session. Inactive SIMs only show while
// they still hold money.
export function capitalRows(sims, latestReddy, starts = {}) {
  const simRows = sims
    .filter((s) => s.active || num(s.balance) !== 0)
    .map((s) => ({ key: `sim-${s.id}`, label: s.name, current: num(s.balance) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return [...simRows, { key: 'reddy', label: 'Reddy', current: num(latestReddy) }].map((r) => ({
    ...r,
    start: starts[r.key] ?? '',
  }));
}

export function capitalTotals(rows) {
  const start = rows.reduce((sum, r) => sum + (parseFloat(r.start) || 0), 0);
  const current = rows.reduce((sum, r) => sum + num(r.current), 0);
  return { start, current, net: current - start };
}
