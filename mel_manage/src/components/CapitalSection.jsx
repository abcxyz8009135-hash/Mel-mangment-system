import { useEffect, useRef, useState } from 'react'
import { fetchSims, fetchCapitalAfterTransfer } from '../functions/simsApi'
import { fetchLatestEndValues } from '../functions/sessionsApi'
import { fetchOwnerTransfers, compareTransfers } from '../functions/transfersApi'
import { fmt } from '../functions/sessionOptions'
import { capitalRows, capitalTotals } from '../functions/capital'

const signClass = (n) => (n > 0 ? 'positive' : n < 0 ? 'negative' : '')

const transferLabel = (t, sims) =>
  `${t.date}${t.time ? ` ${t.time}` : ''} · ${fmt(t.amount)} to ${sims.find((s) => s.id === t.toSimId)?.name ?? 'a SIM'}`

// Capital from a Working capital in to now. Starting is every SIM's
// balance and the Reddy right after that transfer; Current is the
// balances now. Not tied to the Summary's date range.
function CapitalSection() {
  const [owner, setOwner] = useState({ loading: true, transfers: [], sims: [], error: '' })
  const [startId, setStartId] = useState('')
  const [capital, setCapital] = useState(null)
  const [status, setStatus] = useState({ busy: false, error: '' })
  // Bumped on every calculation and choice, so a late answer is dropped.
  const request = useRef(0)

  useEffect(() => {
    Promise.all([fetchOwnerTransfers(), fetchSims()])
      .then(([transfers, sims]) => {
        setOwner({ loading: false, transfers, sims, error: '' })
        const latest = transfers.find((t) => t.kind === 'capital_in')
        if (latest) setStartId(String(latest.id))
      })
      .catch((err) => setOwner((prev) => ({ ...prev, loading: false, error: err.message })))
  }, [])

  const capitalIns = owner.transfers.filter((t) => t.kind === 'capital_in')

  const clear = () => {
    request.current += 1
    setCapital(null)
    setStatus({ busy: false, error: '' })
  }

  const calculate = async () => {
    const id = ++request.current
    setStatus({ busy: true, error: '' })
    try {
      const [start, sims, latest, transfers] = await Promise.all([
        fetchCapitalAfterTransfer(Number(startId)),
        fetchSims(),
        fetchLatestEndValues(),
        fetchOwnerTransfers(),
      ])
      if (id !== request.current) return
      setOwner({ loading: false, transfers, sims, error: '' })
      const from = transfers.find((t) => t.id === Number(startId))
      if (!from) throw new Error('That Working capital in no longer exists. Choose another one.')
      // The starting transfer is inside Starting; only later owner money is listed.
      const since = transfers.filter((t) => compareTransfers(t, from) > 0)
      const total = (kind) => since.filter((t) => t.kind === kind).reduce((sum, t) => sum + t.amount, 0)
      setCapital({
        from,
        rows: capitalRows(sims, start, latest?.reddy),
        ownerIn: total('capital_in'),
        ownerOut: total('capital_out'),
      })
      setStatus({ busy: false, error: '' })
    } catch (err) {
      if (id === request.current) setStatus({ busy: false, error: err.message })
    }
  }

  const t = capital && capitalTotals(capital.rows)
  const withoutOwner = capital && t.net - (capital.ownerIn - capital.ownerOut)

  return (
    <section className="card">
      <h2>Capital</h2>
      {owner.error && <p className="notice error">{owner.error}</p>}
      {owner.loading && <p className="muted">Loading…</p>}
      {!owner.loading && !owner.error && capitalIns.length === 0 && (
        <p className="muted">
          No Working capital in recorded yet. Record one on the Transfers page; capital is counted from there.
        </p>
      )}

      {capitalIns.length > 0 && (
        <div className="capital-controls">
          <div className="field">
            <label htmlFor="capital-start">Starting from Working capital in</label>
            <select
              id="capital-start"
              value={startId}
              onChange={(e) => {
                setStartId(e.target.value)
                clear()
              }}
            >
              {capitalIns.map((c) => (
                <option key={c.id} value={String(c.id)}>{transferLabel(c, owner.sims)}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" onClick={calculate} disabled={status.busy || !startId}>
            {status.busy ? 'Calculating…' : capital ? 'Recalculate capital' : 'Calculate capital'}
          </button>
          {capital && <button className="btn btn-ghost" onClick={clear}>Hide</button>}
        </div>
      )}
      {status.error && <p className="notice error">{status.error}</p>}

      {capital && (
        <>
          <div className="table-scroll">
            <table className="table capital-table">
              <thead>
                <tr><th></th><th>Starting</th><th>Current</th><th>Change</th></tr>
              </thead>
              <tbody>
                {capital.rows.map((r) => (
                  <tr key={r.key}>
                    <td>{r.label}</td>
                    <td>{fmt(r.start)}</td>
                    <td>{fmt(r.current)}</td>
                    <td className={signClass(r.current - r.start)}>{fmt(r.current - r.start)}</td>
                  </tr>
                ))}
                <tr className="capital-total">
                  <td>Total</td>
                  <td>{fmt(t.start)}</td>
                  <td>{fmt(t.current)}</td>
                  <td className={signClass(t.net)}>{fmt(t.net)}</td>
                </tr>
                <tr>
                  <td colSpan={3}>Working capital in since then</td>
                  <td>{fmt(capital.ownerIn)}</td>
                </tr>
                <tr>
                  <td colSpan={3}>Capital out since then</td>
                  <td>{fmt(-capital.ownerOut)}</td>
                </tr>
                <tr className="capital-total">
                  <td colSpan={3}>Change excluding owner money</td>
                  <td className={signClass(withoutOwner)}>{fmt(withoutOwner)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="muted capital-hint">
            Starting: each SIM&apos;s balance right after the Working capital in of {transferLabel(capital.from, owner.sims)}
            {' '}(that money included), and the Reddy of the latest approved session before it. Current: each SIM&apos;s
            balance on the SIMs page now, and the Reddy of the latest approved session.
          </p>
        </>
      )}
    </section>
  )
}

export default CapitalSection
