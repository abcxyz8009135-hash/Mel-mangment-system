import { useCallback, useEffect, useState } from 'react'
import SessionListItem from '../components/SessionListItem'
import { fetchPendingSessions, reviewSession } from '../functions/sessionsApi'

function Approvals({ onChanged }) {
  const [data, setData] = useState({ loading: true, entries: [], error: '' })
  const [openId, setOpenId] = useState(null)
  const [notes, setNotes] = useState({})
  const [busyId, setBusyId] = useState(null)
  const [notice, setNotice] = useState(null)

  const reload = useCallback(
    () =>
      fetchPendingSessions()
        .then((entries) => setData({ loading: false, entries, error: '' }))
        .catch((err) => setData((prev) => ({ ...prev, loading: false, error: err.message }))),
    [],
  )

  useEffect(() => {
    reload()
  }, [reload])

  const handleReview = async (entry, status) => {
    const note = notes[entry.id]?.trim()
    if (status === 'rejected' && !note && !window.confirm('Reject without a note?')) return
    setBusyId(entry.id)
    try {
      await reviewSession(entry.id, status, note)
      setNotice({
        type: status === 'approved' ? 'success' : 'warning',
        text: `${entry.session} for ${entry.date} by ${entry.name} ${status}.`,
      })
      setOpenId(null)
      await reload()
      onChanged?.()
    } catch (err) {
      setNotice({ type: 'error', text: err.message })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="page">
      <div className="card history-toolbar">
        <h2>Waiting for Approval</h2>
        <span className="muted">Sessions that are Over or Short. Approved sessions move to History.</span>
      </div>

      {notice && <p className={`notice ${notice.type}`}>{notice.text}</p>}
      {data.error && <p className="notice error">{data.error}</p>}
      {data.loading && <div className="card empty">Loading…</div>}
      {!data.loading && !data.error && data.entries.length === 0 && (
        <div className="card empty">Nothing waiting for approval.</div>
      )}

      <ul className="history-list">
        {data.entries.map((entry) => (
          <SessionListItem
            key={entry.id}
            entry={entry}
            isOpen={openId === entry.id}
            onToggle={() => setOpenId(openId === entry.id ? null : entry.id)}
          >
            <div className="review">
              <div className="field">
                <label htmlFor={`note-${entry.id}`}>Note (shown to {entry.name})</label>
                <textarea
                  id={`note-${entry.id}`}
                  rows={2}
                  value={notes[entry.id] || ''}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [entry.id]: e.target.value }))}
                />
              </div>
              <div className="actions">
                <button
                  className="btn btn-primary"
                  disabled={busyId === entry.id}
                  onClick={() => handleReview(entry, 'approved')}
                >
                  Approve
                </button>
                <button
                  className="btn btn-danger"
                  disabled={busyId === entry.id}
                  onClick={() => handleReview(entry, 'rejected')}
                >
                  Reject
                </button>
              </div>
            </div>
          </SessionListItem>
        ))}
      </ul>
    </div>
  )
}

export default Approvals
