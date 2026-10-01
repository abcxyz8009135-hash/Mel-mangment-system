import { useEffect, useState } from 'react'
import { fetchSessionsForDate } from '../functions/sessionsApi'
import { fmt, todayString } from '../functions/sessionOptions'

const signClass = (n) => (n > 0 ? 'positive' : n < 0 ? 'negative' : '')

function totals(entries) {
  const t = { count: 0, profit: 0, commission: 0, difference: 0, complaints: 0, Match: 0, Over: 0, Short: 0 }
  entries.forEach(({ result: r }) => {
    t.count += 1
    t.profit += Number(r.sessionProfit) || 0
    t.commission += Number(r.totalCommission) || 0
    t.difference += Number(r.difference) || 0
    t.complaints += Number(r.complaintsTotal) || 0
    // Status after complaints; older sessions only have `status`.
    t[r.adjustedStatus ?? r.status] += 1
  })
  return t
}

function breakdown(entries, keyOf) {
  const groups = {}
  entries.forEach((e) => {
    const key = keyOf(e)
    if (!groups[key]) groups[key] = []
    groups[key].push(e)
  })
  return Object.keys(groups)
    .sort((a, b) => a.localeCompare(b))
    .map((key) => ({ key, ...totals(groups[key]) }))
}

function BreakdownTable({ title, label, rows }) {
  return (
    <section className="card">
      <h3>{title}</h3>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>{label}</th><th>Sessions</th><th>Profit</th><th>Commission</th><th>Difference</th><th>Complaints</th>
              <th>Match</th><th>Over</th><th>Short</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td>{r.key}</td>
                <td>{r.count}</td>
                <td className={signClass(r.profit)}>{fmt(r.profit)}</td>
                <td>{fmt(r.commission)}</td>
                <td className={signClass(r.difference)}>{fmt(r.difference)}</td>
                <td>{fmt(r.complaints)}</td>
                <td>{r.Match}</td>
                <td>{r.Over}</td>
                <td>{r.Short}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Summary() {
  const [date, setDate] = useState(todayString)
  const [data, setData] = useState({ loading: true, entries: [], error: '' })

  useEffect(() => {
    let cancelled = false
    fetchSessionsForDate(date)
      .then((entries) => !cancelled && setData({ loading: false, entries, error: '' }))
      .catch((err) => !cancelled && setData({ loading: false, entries: [], error: err.message }))
    return () => {
      cancelled = true
    }
  }, [date])

  const changeDate = (value) => {
    setDate(value)
    setData((prev) => ({ ...prev, loading: true }))
  }

  // Totals count approved sessions only; pending ones are flagged separately.
  const approved = data.entries.filter((e) => e.approvalStatus === 'approved')
  const pendingCount = data.entries.filter((e) => e.approvalStatus === 'pending').length
  const day = totals(approved)

  return (
    <div className="page">
      <div className="card history-toolbar">
        <h2>Daily Summary</h2>
        <div className="field">
          <label htmlFor="summary-date">Date</label>
          <input type="date" id="summary-date" value={date} onChange={(e) => changeDate(e.target.value)} />
        </div>
      </div>

      {data.error && <p className="notice error">{data.error}</p>}
      {pendingCount > 0 && (
        <p className="notice warning">
          {pendingCount} session(s) on this day are still waiting for approval and are not counted below.
        </p>
      )}
      {data.loading && <div className="card empty">Loading…</div>}
      {!data.loading && !data.error && approved.length === 0 && (
        <div className="card empty">No approved sessions on this day.</div>
      )}

      {!data.loading && approved.length > 0 && (
        <>
          <div className="summary-tiles">
            <div className="card tile"><span className="muted">Sessions</span><strong>{day.count}</strong></div>
            <div className="card tile">
              <span className="muted">Total profit</span>
              <strong className={signClass(day.profit)}>{fmt(day.profit)}</strong>
            </div>
            <div className="card tile"><span className="muted">Total commission</span><strong>{fmt(day.commission)}</strong></div>
            <div className="card tile">
              <span className="muted">Total difference</span>
              <strong className={signClass(day.difference)}>{fmt(day.difference)}</strong>
            </div>
            <div className="card tile"><span className="muted">Total complaints</span><strong>{fmt(day.complaints)}</strong></div>
            <div className="card tile">
              <span className="muted">Status after complaints</span>
              <span className="tile-badges">
                <span className="badge badge-match">{day.Match} Match</span>
                <span className="badge badge-over">{day.Over} Over</span>
                <span className="badge badge-short">{day.Short} Short</span>
              </span>
            </div>
          </div>

          <BreakdownTable title="By staff" label="Staff" rows={breakdown(approved, (e) => e.name)} />
          <BreakdownTable title="By SIM" label="SIM" rows={breakdown(approved, (e) => e.simName || 'No SIM')} />
        </>
      )}
    </div>
  )
}

export default Summary
