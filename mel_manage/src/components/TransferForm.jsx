import { useState } from 'react'
import { OWNER } from '../functions/transfersApi'
import { profileLabel } from '../functions/profilesApi'
import { simLabel } from '../functions/simsApi'

// One side of a transfer: the Owner, or a person and one of their SIMs.
// `keep` is the side as first loaded, so an edited transfer keeps a person
// or SIM that has since been deactivated or reassigned.
function PartyPicker({ id, title, value, keep, profiles, sims, onChange }) {
  const people = profiles.filter((p) => p.active || p.id === keep.user)
  const simOptions =
    value.user && value.user !== OWNER
      ? sims.filter(
          (s) =>
            (s.active && s.assigned_to === value.user) ||
            (value.user === keep.user && s.id === keep.simId),
        )
      : []

  const changeUser = (user) => {
    const own = user && user !== OWNER ? sims.filter((s) => s.active && s.assigned_to === user) : []
    onChange({ user, simId: own.length === 1 ? own[0].id : null })
  }

  return (
    <fieldset className="transfer-party">
      <legend>{title}</legend>
      <div className="field">
        <label htmlFor={`${id}-user`}>Person</label>
        <select id={`${id}-user`} value={value.user} onChange={(e) => changeUser(e.target.value)}>
          <option value="">Choose…</option>
          <option value={OWNER}>Owner</option>
          {people.map((p) => <option key={p.id} value={p.id}>{profileLabel(p)}</option>)}
        </select>
      </div>
      {value.user && value.user !== OWNER && (
        <div className="field">
          <label htmlFor={`${id}-sim`}>SIM</label>
          <select
            id={`${id}-sim`}
            value={value.simId ? String(value.simId) : ''}
            onChange={(e) => onChange({ ...value, simId: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">{simOptions.length ? 'Choose SIM…' : 'No SIMs assigned'}</option>
            {simOptions.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {simLabel(s)}{s.active ? '' : ' — inactive'}
              </option>
            ))}
          </select>
        </div>
      )}
    </fieldset>
  )
}

// Add / edit form. onSubmit(values) must throw an Error on failure.
function TransferForm({ initial, profiles, sims, submitLabel, onSubmit, onCancel }) {
  const [date, setDate] = useState(initial.date)
  const [time, setTime] = useState(initial.time)
  const [from, setFrom] = useState({ user: initial.fromUser, simId: initial.fromSimId })
  const [to, setTo] = useState({ user: initial.toUser, simId: initial.toSimId })
  const [amount, setAmount] = useState(initial.amount ? String(initial.amount) : '')
  const [note, setNote] = useState(initial.note)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const validate = () => {
    if (!date) return 'Choose a date.'
    if (!from.user || !to.user) return 'Choose who the money is from and to.'
    if (from.user === OWNER && to.user === OWNER) return 'The Owner can only be on one side.'
    if (from.user !== OWNER && !from.simId) return 'Choose the From SIM.'
    if (to.user !== OWNER && !to.simId) return 'Choose the To SIM.'
    if (from.simId && from.simId === to.simId) return 'From and To must be different SIMs.'
    if (!(Number(amount) > 0)) return 'Enter an amount greater than 0.'
    return ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const problem = validate()
    setError(problem)
    if (problem) return
    setBusy(true)
    try {
      await onSubmit({
        date,
        time,
        fromUser: from.user,
        fromSimId: from.simId,
        toUser: to.user,
        toSimId: to.simId,
        amount: Number(amount),
        note: note.trim(),
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="transfer-form" onSubmit={handleSubmit}>
      <div className="transfer-row">
        <div className="field">
          <label htmlFor="transfer-date">Date</label>
          <input type="date" id="transfer-date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="transfer-time">Time</label>
          <input type="time" id="transfer-time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="transfer-amount">Amount (telebirr)</label>
          <input
            id="transfer-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
      </div>
      <div className="transfer-row">
        <PartyPicker
          id="transfer-from"
          title="From"
          value={from}
          keep={{ user: initial.fromUser, simId: initial.fromSimId }}
          profiles={profiles}
          sims={sims}
          onChange={setFrom}
        />
        <PartyPicker
          id="transfer-to"
          title="To"
          value={to}
          keep={{ user: initial.toUser, simId: initial.toSimId }}
          profiles={profiles}
          sims={sims}
          onChange={setTo}
        />
      </div>
      <div className="field">
        <label htmlFor="transfer-note">Note (optional)</label>
        <textarea id="transfer-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {from.user === OWNER && <p className="muted">This will be marked as Working capital in.</p>}
      {to.user === OWNER && <p className="muted">This will be marked as Capital out.</p>}
      <div className="actions">
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
        {onCancel && <button className="btn btn-ghost" type="button" onClick={onCancel}>Cancel</button>}
      </div>
      {error && <p className="notice error">{error}</p>}
    </form>
  )
}

export default TransferForm
