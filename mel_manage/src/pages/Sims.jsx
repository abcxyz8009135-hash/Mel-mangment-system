import { useCallback, useEffect, useState } from 'react'
import { fetchSims, createSim, updateSim, setSimBalance } from '../functions/simsApi'
import { fetchProfiles, profileLabel } from '../functions/profilesApi'
import { fmt } from '../functions/sessionOptions'

const EMPTY_SIM = { name: '', phone: '', assignedTo: '' }

// Active users, plus the current assignee if they have since been deactivated.
function AssigneeSelect({ id, label, value, profiles, disabled, onChange }) {
  const options = profiles.filter((p) => p.active || p.id === value)
  return (
    <select id={id} aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <option value="">— Unassigned —</option>
      {options.map((p) => <option key={p.id} value={p.id}>{profileLabel(p)}</option>)}
    </select>
  )
}

function Sims() {
  const [data, setData] = useState({ loading: true, sims: [], error: '' })
  const [profiles, setProfiles] = useState([])
  const [newSim, setNewSim] = useState(EMPTY_SIM)
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState(EMPTY_SIM)
  // { id, value } while a balance is being typed in.
  const [balanceEdit, setBalanceEdit] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)

  const reload = useCallback(
    () =>
      fetchSims()
        .then((sims) => setData({ loading: false, sims, error: '' }))
        .catch((err) => setData((prev) => ({ ...prev, loading: false, error: err.message }))),
    [],
  )

  useEffect(() => {
    reload()
    fetchProfiles()
      .then(setProfiles)
      .catch((err) => setNotice({ type: 'error', text: `Could not load users: ${err.message}` }))
  }, [reload])

  const perform = async (action, successText) => {
    setBusy(true)
    try {
      await action()
      setNotice({ type: 'success', text: successText })
      await reload()
      return true
    } catch (err) {
      setNotice({ type: 'error', text: err.message })
      return false
    } finally {
      setBusy(false)
    }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newSim.name.trim()) return
    if (await perform(() => createSim(newSim), `${newSim.name.trim()} added.`)) setNewSim(EMPTY_SIM)
  }

  const startEdit = (sim) => {
    setEditingId(sim.id)
    setDraft({ name: sim.name, phone: sim.phone })
  }

  const handleSave = async (sim) => {
    if (!draft.name.trim()) return
    const fields = { name: draft.name.trim(), phone: draft.phone.trim() }
    if (await perform(() => updateSim(sim.id, fields), `${fields.name} saved.`)) setEditingId(null)
  }

  const assign = (sim, userId) => {
    const who = profiles.find((p) => p.id === userId)
    return perform(
      () => updateSim(sim.id, { assigned_to: userId || null }),
      who ? `${sim.name} assigned to ${who.full_name}.` : `${sim.name} is now unassigned.`,
    )
  }

  const handleSetBalance = async (sim) => {
    const amount = Number(balanceEdit.value)
    if (balanceEdit.value.trim() === '' || !Number.isFinite(amount)) {
      setNotice({ type: 'error', text: 'Enter the balance as a number.' })
      return
    }
    if (await perform(() => setSimBalance(sim.id, amount), `${sim.name} balance set to ${fmt(amount)}.`)) {
      setBalanceEdit(null)
    }
  }

  const toggleActive = (sim) =>
    perform(
      () => updateSim(sim.id, { active: !sim.active }),
      `${sim.name} ${sim.active ? 'deactivated' : 'reactivated'}.`,
    )

  return (
    <div className="page">
      <form className="card" onSubmit={handleAdd}>
        <h2>Add SIM</h2>
        <div className="sim-form">
          <div className="field">
            <label htmlFor="sim-name">Name</label>
            <input
              id="sim-name"
              placeholder="e.g. Phone A"
              value={newSim.name}
              onChange={(e) => setNewSim((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="sim-phone">Phone number</label>
            <input
              id="sim-phone"
              type="tel"
              placeholder="e.g. 0911 000 001"
              value={newSim.phone}
              onChange={(e) => setNewSim((prev) => ({ ...prev, phone: e.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="sim-assigned">Assigned to</label>
            <AssigneeSelect
              id="sim-assigned"
              value={newSim.assignedTo}
              profiles={profiles}
              onChange={(assignedTo) => setNewSim((prev) => ({ ...prev, assignedTo }))}
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy}>Add</button>
        </div>
      </form>

      {notice && <p className={`notice ${notice.type}`}>{notice.text}</p>}
      {data.error && <p className="notice error">{data.error}</p>}

      <div className="card">
        <h2>SIMs</h2>
        <p className="muted sim-hint">
          Staff only see the SIMs assigned to them on the session form. Deactivated SIMs disappear from the
          session form but stay on sessions that already use them. Balance is the telebirr on the SIM now. Use Set
          to enter it by hand; after that it updates by itself — transfers received and sent move it, and the end of
          the next approved session replaces it.
        </p>
        {data.loading && <p className="empty">Loading…</p>}
        {!data.loading && data.sims.length === 0 && <p className="empty">No SIMs yet.</p>}
        {data.sims.length > 0 && (
          <table className="table sim-table">
            <thead>
              <tr><th>Name</th><th>Phone number</th><th>Balance</th><th>Assigned to</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {data.sims.map((sim) =>
                editingId === sim.id ? (
                  <tr key={sim.id}>
                    <td>
                      <input
                        aria-label="Name"
                        value={draft.name}
                        onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                      />
                    </td>
                    <td>
                      <input
                        aria-label="Phone number"
                        type="tel"
                        value={draft.phone}
                        onChange={(e) => setDraft((prev) => ({ ...prev, phone: e.target.value }))}
                      />
                    </td>
                    <td>{fmt(sim.balance)}</td>
                    <td></td>
                    <td></td>
                    <td className="sim-actions">
                      <button className="btn btn-small btn-primary" disabled={busy} onClick={() => handleSave(sim)}>Save</button>
                      <button className="btn btn-small btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={sim.id} className={sim.active ? '' : 'inactive'}>
                    <td>{sim.name}</td>
                    <td>{sim.phone || '—'}</td>
                    <td>
                      {balanceEdit?.id === sim.id ? (
                        <form
                          className="sim-balance-form"
                          onSubmit={(e) => {
                            e.preventDefault()
                            handleSetBalance(sim)
                          }}
                        >
                          <input
                            aria-label={`${sim.name} balance`}
                            inputMode="decimal"
                            autoFocus
                            value={balanceEdit.value}
                            onChange={(e) => setBalanceEdit({ id: sim.id, value: e.target.value })}
                          />
                          <button className="btn btn-small btn-primary" type="submit" disabled={busy}>Save</button>
                          <button className="btn btn-small btn-ghost" type="button" onClick={() => setBalanceEdit(null)}>
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <span className="sim-balance">
                          {fmt(sim.balance)}
                          <button
                            className="btn btn-small btn-ghost"
                            onClick={() => setBalanceEdit({ id: sim.id, value: String(Number(sim.balance) || 0) })}
                          >
                            Set
                          </button>
                        </span>
                      )}
                    </td>
                    <td>
                      <AssigneeSelect
                        label={`${sim.name} assigned to`}
                        value={sim.assigned_to ?? ''}
                        profiles={profiles}
                        disabled={busy}
                        onChange={(userId) => assign(sim, userId)}
                      />
                    </td>
                    <td>
                      <span className={`badge ${sim.active ? 'badge-approved' : 'badge-rejected'}`}>
                        {sim.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="sim-actions">
                      <button className="btn btn-small" onClick={() => startEdit(sim)}>Edit</button>
                      <button className="btn btn-small" disabled={busy} onClick={() => toggleActive(sim)}>
                        {sim.active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default Sims
