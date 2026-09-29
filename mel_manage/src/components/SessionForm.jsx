import { useState } from 'react'
import Form from './Form'
import Results from './Results'
import { calcSession } from '../functions/calcBalance'
import { SESSIONS } from '../functions/sessionOptions'

// Date + session picker, start/end forms, preview and submit.
// onSubmit(values) must return { type, text } or throw an Error.
function SessionForm({ initial, submitLabel, onSubmit, onCancel, intro }) {
  const [date, setDate] = useState(initial.date)
  const [session, setSession] = useState(initial.session)
  const [start, setStart] = useState(initial.start)
  const [end, setEnd] = useState(initial.end)
  const [result, setResult] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

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
    setResult(calcSession(start, end))
    setMessage(null)
  }

  const handleSubmit = async () => {
    setBusy(true)
    setMessage(null)
    try {
      setMessage(await onSubmit({ date, session, start, end }))
      setSubmitted(true)
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  const handleReset = () => {
    setStart(initial.start)
    setEnd(initial.end)
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
        {intro && <div className="session-intro">{intro}</div>}
      </div>

      <div className="forms">
        <Form title="Starting Point" prefix="start" values={start} onChange={updateStart} />
        <Form title="End Point" prefix="end" values={end} onChange={updateEnd} />
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
