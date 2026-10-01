import { useCallback, useEffect, useState } from 'react'
import { fetchSims, createSim, updateSim } from '../functions/simsApi'

const EMPTY_SIM = { name: '', phone: '' }

function Sims() {
  const [data, setData] = useState({ loading: true, sims: [], error: '' })
  const [newSim, setNewSim] = useState(EMPTY_SIM)
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState(EMPTY_SIM)
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
          <button className="btn btn-primary" type="submit" disabled={busy}>Add</button>
        </div>
      </form>

      {notice && <p className={`notice ${notice.type}`}>{notice.text}</p>}
      {data.error && <p className="notice error">{data.error}</p>}

      <div className="card">
        <h2>SIMs</h2>
        <p className="muted sim-hint">
          Deactivated SIMs disappear from the session form but stay on sessions that already use them.
        </p>
        {data.loading && <p className="empty">Loading…</p>}
        {!data.loading && data.sims.length === 0 && <p className="empty">No SIMs yet.</p>}
        {data.sims.length > 0 && (
          <table className="table sim-table">
            <thead>
              <tr><th>Name</th><th>Phone number</th><th>Status</th><th></th></tr>
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
