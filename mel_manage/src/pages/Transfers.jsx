import { useCallback, useEffect, useState } from 'react'
import TransferForm from '../components/TransferForm'
import { fetchTransfersInRange, createTransfer, updateTransfer, deleteTransfer, OWNER, KIND_LABELS } from '../functions/transfersApi'
import { fetchPeople } from '../functions/profilesApi'
import { fetchSims, simLabel } from '../functions/simsApi'
import { fmt, todayString, nowTimeString } from '../functions/sessionOptions'
import { useAuth } from '../auth/AuthContext'

const monthStart = () => `${todayString().slice(0, 8)}01`

const newTransfer = (fromUser = '', fromSimId = null) => ({
  date: todayString(),
  time: nowTimeString(),
  fromUser,
  fromSimId,
  toUser: '',
  toSimId: null,
  amount: '',
  note: '',
})

// Telebirr transfers between the Owner, the admin and staff. Each one moves
// the balance of the SIMs on either side (kept by the database).
// The admin sees, adds, edits and deletes every transfer. Staff send from
// their own SIMs and see the transfers they are part of.
function Transfers() {
  const { profile, isAdmin } = useAuth()
  const [profiles, setProfiles] = useState([])
  const [sims, setSims] = useState([])
  const [from, setFrom] = useState(monthStart)
  const [to, setTo] = useState(todayString)
  const [data, setData] = useState({ loading: true, transfers: [], error: '' })
  const [editing, setEditing] = useState(null)
  const [formKey, setFormKey] = useState(0)
  const [notice, setNotice] = useState(null)
  const invalidRange = !from || !to || from > to

  useEffect(() => {
    fetchPeople()
      .then(setProfiles)
      .catch((err) => setNotice({ type: 'error', text: `Could not load users: ${err.message}` }))
  }, [])

  // SIMs are reloaded after every change so the balances stay current.
  const reloadSims = useCallback(
    () =>
      fetchSims()
        .then(setSims)
        .catch((err) => setNotice({ type: 'error', text: `Could not load SIMs: ${err.message}` })),
    [],
  )

  useEffect(() => {
    reloadSims()
  }, [reloadSims])

  const ownSims = sims.filter((s) => s.active && s.assigned_to === profile.id)

  const reload = useCallback(() => {
    if (invalidRange) return Promise.resolve()
    return fetchTransfersInRange(from, to)
      .then((transfers) => setData({ loading: false, transfers, error: '' }))
      .catch((err) => setData({ loading: false, transfers: [], error: err.message }))
  }, [from, to, invalidRange])

  useEffect(() => {
    reload()
  }, [reload])

  const personName = (user) =>
    user === OWNER ? 'Owner' : profiles.find((p) => p.id === user)?.full_name ?? 'Unknown user'
  const simName = (simId) => sims.find((s) => s.id === simId)?.name
  const side = (user, simId) => (
    <>
      {personName(user)}
      {simId && <span className="muted"> · {simName(simId) ?? 'Unknown SIM'}</span>}
    </>
  )

  const handleAdd = async (values) => {
    await createTransfer(values)
    setNotice({ type: 'success', text: 'Transfer saved.' })
    setFormKey((k) => k + 1)
    await Promise.all([reload(), reloadSims()])
  }

  const handleEdit = async (values) => {
    await updateTransfer(editing.id, values)
    setEditing(null)
    setNotice({ type: 'success', text: 'Transfer updated.' })
    await Promise.all([reload(), reloadSims()])
  }

  const handleDelete = async (t) => {
    if (!window.confirm(`Delete the transfer of ${fmt(t.amount)} on ${t.date}? This cannot be undone.`)) return
    try {
      await deleteTransfer(t.id)
      if (editing?.id === t.id) setEditing(null)
      setNotice({ type: 'success', text: 'Transfer deleted.' })
      await Promise.all([reload(), reloadSims()])
    } catch (err) {
      setNotice({ type: 'error', text: err.message })
    }
  }

  const changeRange = (setter) => (value) => {
    setter(value)
    setData((prev) => ({ ...prev, loading: true }))
  }

  const capitalIn = data.transfers.filter((t) => t.kind === 'capital_in').reduce((sum, t) => sum + t.amount, 0)
  const capitalOut = data.transfers.filter((t) => t.kind === 'capital_out').reduce((sum, t) => sum + t.amount, 0)
  const ready = !invalidRange && !data.loading

  return (
    <div className="page">
      <div className="card">
        <h2>{editing ? 'Edit transfer' : 'New transfer'}</h2>
        {editing ? (
          <TransferForm
            key={`edit-${editing.id}`}
            initial={editing}
            profiles={profiles}
            sims={sims}
            submitLabel="Save changes"
            onSubmit={handleEdit}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <TransferForm
            // Staff start with their own SIM picked once the SIMs have loaded.
            key={`new-${formKey}-${sims.length}`}
            initial={
              isAdmin
                ? newTransfer()
                : newTransfer(profile.id, ownSims.length === 1 ? ownSims[0].id : null)
            }
            profiles={profiles}
            sims={sims}
            sender={isAdmin ? undefined : profile.id}
            submitLabel="Save transfer"
            onSubmit={handleAdd}
          />
        )}
        {!isAdmin && (
          <p className="muted transfer-hint">
            Send from your own SIM. Only the admin can change or delete a transfer once it is saved.
          </p>
        )}
      </div>

      {!isAdmin && ownSims.length > 0 && (
        <div className="card">
          <h2>Your SIMs</h2>
          <table className="table">
            <thead>
              <tr><th>SIM</th><th>Balance</th></tr>
            </thead>
            <tbody>
              {ownSims.map((s) => (
                <tr key={s.id}><td>{simLabel(s)}</td><td>{fmt(s.balance)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {notice && <p className={`notice ${notice.type}`}>{notice.text}</p>}

      <div className="card history-toolbar">
        <h2>Transfers</h2>
        <div className="history-filters">
          <div className="field">
            <label htmlFor="transfers-from">From</label>
            <input type="date" id="transfers-from" value={from} onChange={(e) => changeRange(setFrom)(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="transfers-to">To</label>
            <input type="date" id="transfers-to" value={to} onChange={(e) => changeRange(setTo)(e.target.value)} />
          </div>
        </div>
      </div>

      {invalidRange && <p className="notice error">Choose a From date that is on or before the To date.</p>}
      {!invalidRange && data.error && <p className="notice error">{data.error}</p>}
      {!invalidRange && data.loading && <div className="card empty">Loading…</div>}
      {ready && !data.error && data.transfers.length === 0 && (
        <div className="card empty">No transfers in this range.</div>
      )}

      {ready && data.transfers.length > 0 && (
        <>
          <div className="summary-tiles">
            <div className="card tile"><span className="muted">Transfers</span><strong>{data.transfers.length}</strong></div>
            <div className="card tile"><span className="muted">Working capital in</span><strong>{fmt(capitalIn)}</strong></div>
            <div className="card tile"><span className="muted">Capital out</span><strong>{fmt(capitalOut)}</strong></div>
          </div>

          <div className="card">
            <div className="table-scroll">
              <table className="table transfer-table">
                <thead>
                  <tr>
                    <th>Date</th><th>From</th><th>To</th><th>Amount</th><th>Type</th><th>Note</th>
                    {isAdmin && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {data.transfers.map((t) => (
                    <tr key={t.id} className={editing?.id === t.id ? 'editing' : ''}>
                      <td>
                        {t.date}
                        {t.time && <span className="muted"> · {t.time}</span>}
                      </td>
                      <td>{side(t.fromUser, t.fromSimId)}</td>
                      <td>{side(t.toUser, t.toSimId)}</td>
                      <td>{fmt(t.amount)}</td>
                      <td>
                        {t.kind && (
                          <span className={`badge ${t.kind === 'capital_in' ? 'badge-approved' : 'badge-pending'}`}>
                            {KIND_LABELS[t.kind]}
                          </span>
                        )}
                      </td>
                      <td className="transfer-note">{t.note}</td>
                      {isAdmin && (
                        <td className="sim-actions">
                          <button
                            className="btn btn-small"
                            onClick={() => {
                              setEditing(t)
                              window.scrollTo({ top: 0, behavior: 'smooth' })
                            }}
                          >
                            Edit
                          </button>
                          <button className="btn btn-small btn-danger" onClick={() => handleDelete(t)}>Delete</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default Transfers
