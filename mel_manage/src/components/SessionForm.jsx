import { useEffect, useState } from 'react'
import Form from './Form'
import Results from './Results'
import { calcSession, parseComplaints } from '../functions/calcBalance'
import { SESSIONS, EMPTY_VALUES } from '../functions/sessionOptions'
import { fetchPreviousEndValues } from '../functions/sessionsApi'
import { fetchSims, simLabel } from '../functions/simsApi'

// Date + session + SIM picker, start/end forms, complaints, preview and submit.
// onSubmit(values) must return { type, text } or throw an Error.
// With prefillStart, the start point is filled from the previous approved
// session's end point (or 0) whenever the date or session changes.
function SessionForm({ initial, submitLabel, onSubmit, onCancel, intro, requireSim = true, prefillStart = false }) {
  const [date, setDate] = useState(initial.date)
  const [session, setSession] = useState(initial.session)
  const [simId, setSimId] = useState(initial.simId ? String(initial.simId) : '')
  const [sims, setSims] = useState([])
  const [start, setStart] = useState(initial.start)
  const [end, setEnd] = useState(initial.end)
  const [complaintsText, setComplaintsText] = useState((initial.complaints ?? []).join(', '))
  const [prefilled, setPrefilled] = useState(null)
  const [result, setResult] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    fetchSims()
      .then(setSims)
      .catch((err) => setMessage({ type: 'error', text: `Could not load SIMs: ${err.message}` }))
  }, [])

  useEffect(() => {
    if (!prefillStart) return
    let cancelled = false
    fetchPreviousEndValues(date, session)
      .then((previous) => {
        if (cancelled) return
        const values = Object.fromEntries(
          Object.keys(EMPTY_VALUES).map((key) => [key, String(previous?.[key] ?? 0)]),
        )
        setPrefilled(values)
        setStart(values)
        setResult(null)
        setSubmitted(false)
      })
      .catch((err) => {
        if (!cancelled) setMessage({ type: 'error', text: `Could not load the previous session: ${err.message}` })
      })
    return () => {
      cancelled = true
    }
  }, [prefillStart, date, session])

  // Active SIMs, plus the one already on this session if it has since been deactivated.
  const simOptions = sims.filter((s) => s.active || String(s.id) === simId)

  // Any change invalidates the preview so a stale result can't be submitted.
  const changed = () => {
    setResult(null)
    setSubmitted(false)
  }
  const updateStart = (key, value) => {
    setStart((prev) => ({ ...prev, [key]: value }))
    changed()
  }
  const updateEnd = (key, value) => {
    setEnd((prev) => ({ ...prev, [key]: value }))
    changed()
  }

  const handleCalculate = () => {
    const complaints = parseComplaints(complaintsText)
    if (complaints.error) {
      setResult(null)
      setMessage({ type: 'error', text: complaints.error })
      return
    }
    setResult(calcSession(start, end, complaints.values))
    setMessage(null)
  }

  const handleSubmit = async () => {
    if (requireSim && !simId) {
      setMessage({ type: 'error', text: 'Choose a SIM.' })
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      setMessage(
        await onSubmit({
          date,
          session,
          simId: simId ? Number(simId) : null,
          start,
          end,
          complaints: result.complaints,
        }),
      )
      setSubmitted(true)
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  const handleReset = () => {
    setStart(prefilled ?? initial.start)
    setEnd(initial.end)
    setComplaintsText((initial.complaints ?? []).join(', '))
    setResult(null)
    setSubmitted(false)
    setMessage(null)
  }

  return (
    <div className="page">
      <div className="card session-bar">
        <div className="field">
          <label htmlFor="session-date">Date</label>
          <input
            type="date"
            id="session-date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value)
              changed()
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="session-select">Session</label>
          <select
            id="session-select"
            value={session}
            onChange={(e) => {
              setSession(e.target.value)
              changed()
            }}
          >
            {SESSIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="session-sim">SIM</label>
          <select
            id="session-sim"
            value={simId}
            onChange={(e) => {
              setSimId(e.target.value)
              changed()
            }}
          >
            <option value="">{requireSim ? 'Choose SIM…' : '— none —'}</option>
            {simOptions.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {simLabel(s)}{s.active ? '' : ' — inactive'}
              </option>
            ))}
          </select>
        </div>
        {intro && <div className="session-intro">{intro}</div>}
      </div>

      <div className="forms">
        <Form title="Starting Point" prefix="start" values={start} onChange={updateStart} />
        <Form title="End Point" prefix="end" values={end} onChange={updateEnd} />
      </div>

      <div className="card">
        <div className="field">
          <label htmlFor="session-complaints">Complaints worked (optional)</label>
          <input
            id="session-complaints"
            inputMode="decimal"
            placeholder="e.g. 200, 150, 75"
            value={complaintsText}
            onChange={(e) => {
              setComplaintsText(e.target.value)
              changed()
            }}
          />
          <span className="muted">Separate amounts with commas. Their total is added to the difference.</span>
        </div>
      </div>

      <div className="actions">
        <button className="btn btn-primary" onClick={handleCalculate}>Calculate</button>
        <button className="btn" onClick={handleSubmit} disabled={!result || submitted || busy}>
          {busy ? 'Saving…' : submitLabel}
        </button>
        {onCancel ? (
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        ) : (
          <button className="btn btn-ghost" onClick={handleReset}>Reset</button>
        )}
      </div>
      {message && <p className={`notice ${message.type}`}>{message.text}</p>}

      {result && <Results result={result} />}
    </div>
  )
}

export default SessionForm
