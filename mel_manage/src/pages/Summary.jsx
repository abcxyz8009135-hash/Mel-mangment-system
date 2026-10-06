import { useEffect, useRef, useState } from 'react'
import { fetchSessionsInRange, fetchLatestEndValues } from '../functions/sessionsApi'
import { fetchSims } from '../functions/simsApi'
import { fetchTransfersInRange } from '../functions/transfersApi'
import { fmt, todayString } from '../functions/sessionOptions'
import { capitalRows, capitalTotals } from '../functions/capital'

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

function breakdown(entries, keyOf, sort = (a, b) => a.localeCompare(b)) {
  const groups = {}
  entries.forEach((e) => {
    const key = keyOf(e)
    if (!groups[key]) groups[key] = []
    groups[key].push(e)
  })
  return Object.keys(groups)
    .sort(sort)
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

// Starting capital typed in by the admin vs the balances now. Starting
// values are not saved.
function CapitalTable({ rows, ownerIn, ownerOut, endsBeforeToday, onChange }) {
  const t = capitalTotals(rows)
  const withoutOwner = t.net - (ownerIn - ownerOut)
  return (
    <section className="card">
      <h3>Capital</h3>
      <div className="table-scroll">
        <table className="table capital-table">
          <thead>
            <tr><th></th><th>Starting</th><th>Current</th><th>Change</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const change = r.current - (parseFloat(r.start) || 0)
              return (
                <tr key={r.key}>
                  <td>{r.label}</td>
                  <td>
                    <input
                      aria-label={`${r.label} starting`}
                      inputMode="decimal"
                      placeholder="0"
                      value={r.start}
                      onChange={(e) => onChange(r.key, e.target.value)}
                    />
                  </td>
                  <td>{fmt(r.current)}</td>
                  <td className={signClass(change)}>{fmt(change)}</td>
                </tr>
              )
            })}
            <tr className="capital-total">
              <td>Total</td>
              <td>{fmt(t.start)}</td>
              <td>{fmt(t.current)}</td>
              <td className={signClass(t.net)}>{fmt(t.net)}</td>
            </tr>
            <tr>
              <td colSpan={3}>Owner money in</td>
              <td>{fmt(ownerIn)}</td>
            </tr>
            <tr>
              <td colSpan={3}>Owner money out</td>
              <td>{fmt(-ownerOut)}</td>
            </tr>
            <tr className="capital-total">
              <td colSpan={3}>Change excluding owner money</td>
              <td className={signClass(withoutOwner)}>{fmt(withoutOwner)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="muted capital-hint">
        Starting: type in the capital at the start of the range (not saved). Current: each SIM&apos;s balance on
        the SIMs page right now, and the Reddy of the latest approved session. Owner money: transfers from and to the
        Owner in this range.
      </p>
      {endsBeforeToday && (
        <p className="notice warning">Current is the balance now, not at the end of the range.</p>
      )}
    </section>
  )
}

function Summary() {
  const [from, setFrom] = useState(todayString)
  const [to, setTo] = useState(todayString)
  const [data, setData] = useState({ loading: true, entries: [], error: '' })
  // null until the admin clicks "Calculate capital"; cleared when the range changes.
  const [capital, setCapital] = useState(null)
  // Typed-in starting values by row key. Kept when the range changes or the
  // capital is recalculated.
  const [starts, setStarts] = useState({})
  const [capitalStatus, setCapitalStatus] = useState({ busy: false, error: '' })
  // Bumped on every calculation and range change, so a late answer for an old range is dropped.
  const capitalRequest = useRef(0)
  const invalidRange = !from || !to || from > to

  useEffect(() => {
    if (invalidRange) return
    let cancelled = false
    fetchSessionsInRange(from, to)
      .then((entries) => !cancelled && setData({ loading: false, entries, error: '' }))
      .catch((err) => !cancelled && setData({ loading: false, entries: [], error: err.message }))
    return () => {
      cancelled = true
    }
  }, [from, to, invalidRange])

  const clearCapital = () => {
    capitalRequest.current += 1
    setCapital(null)
    setCapitalStatus({ busy: false, error: '' })
  }

  const changeRange = (setter) => (value) => {
    setter(value)
    setData((prev) => ({ ...prev, loading: true }))
    clearCapital()
  }

  const resetToToday = () => {
    const today = todayString()
    if (from === today && to === today) return
    setFrom(today)
    setTo(today)
    setData((prev) => ({ ...prev, loading: true }))
    clearCapital()
  }

  const updateStart = (key, value) => setStarts((prev) => ({ ...prev, [key]: value }))

  const singleDay = from === to
  const rangeText = singleDay ? 'on this day' : 'in this range'

  // Totals count approved sessions only; pending ones are flagged separately.
  const approved = data.entries.filter((e) => e.approvalStatus === 'approved')
  const pendingCount = data.entries.filter((e) => e.approvalStatus === 'pending').length
  const day = totals(approved)
  const ready = !invalidRange && !data.loading

  const calculateCapital = async () => {
    const request = ++capitalRequest.current
    setCapitalStatus({ busy: true, error: '' })
    try {
      const [sims, latest, transfers] = await Promise.all([
        fetchSims(),
        fetchLatestEndValues(),
        fetchTransfersInRange(from, to),
      ])
      if (request !== capitalRequest.current) return
      const ownerTotal = (kind) => transfers.filter((t) => t.kind === kind).reduce((sum, t) => sum + t.amount, 0)
      setCapital({ sims, reddy: latest?.reddy, ownerIn: ownerTotal('capital_in'), ownerOut: ownerTotal('capital_out') })
      setCapitalStatus({ busy: false, error: '' })
    } catch (err) {
      if (request === capitalRequest.current) setCapitalStatus({ busy: false, error: err.message })
    }
  }

  return (
    <div className="page">
      <div className="card history-toolbar">
        <h2>Summary</h2>
        <div className="history-filters">
          <div className="field">
            <label htmlFor="summary-from">From</label>
            <input type="date" id="summary-from" value={from} onChange={(e) => changeRange(setFrom)(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="summary-to">To</label>
            <input type="date" id="summary-to" value={to} onChange={(e) => changeRange(setTo)(e.target.value)} />
          </div>
          <button className="btn btn-ghost" onClick={resetToToday}>Today</button>
        </div>
      </div>

      {invalidRange && <p className="notice error">Choose a From date that is on or before the To date.</p>}
      {!invalidRange && data.error && <p className="notice error">{data.error}</p>}
      {ready && pendingCount > 0 && (
        <p className="notice warning">
          {pendingCount} session(s) {rangeText} are still waiting for approval and are not counted below.
        </p>
      )}
      {!invalidRange && data.loading && <div className="card empty">Loading…</div>}
      {ready && !data.error && approved.length === 0 && (
        <div className="card empty">No approved sessions {rangeText}.</div>
      )}

      {ready && approved.length > 0 && (
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

          <div className="actions">
            <button className="btn btn-primary" onClick={calculateCapital} disabled={capitalStatus.busy}>
              {capitalStatus.busy ? 'Calculating…' : capital ? 'Recalculate capital' : 'Calculate capital'}
            </button>
            {capital && <button className="btn btn-ghost" onClick={clearCapital}>Hide</button>}
          </div>
          {capitalStatus.error && <p className="notice error">{capitalStatus.error}</p>}
          {capital && (
            <CapitalTable
              rows={capitalRows(capital.sims, capital.reddy, starts)}
              ownerIn={capital.ownerIn}
              ownerOut={capital.ownerOut}
              endsBeforeToday={to < todayString()}
              onChange={updateStart}
            />
          )}

          {!singleDay && (
            <BreakdownTable
              title="By day"
              label="Date"
              rows={breakdown(approved, (e) => e.date, (a, b) => b.localeCompare(a))}
            />
          )}
          <BreakdownTable title="By staff" label="Staff" rows={breakdown(approved, (e) => e.name)} />
          <BreakdownTable title="By SIM" label="SIM" rows={breakdown(approved, (e) => e.simName || 'No SIM')} />
        </>
      )}
    </div>
  )
}

export default Summary
