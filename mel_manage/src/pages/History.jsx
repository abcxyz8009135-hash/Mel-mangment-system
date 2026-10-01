import { useCallback, useEffect, useState } from 'react'
import SessionListItem from '../components/SessionListItem'
import SessionForm from '../components/SessionForm'
import { useAuth } from '../auth/AuthContext'
import { fetchSessions, updateSession, deleteSession, submitSession } from '../functions/sessionsApi'
import { loadLocalHistory, saveLocalHistory } from '../functions/localHistory'
import { SESSIONS } from '../functions/sessionOptions'

function groupByDate(entries) {
  const groups = {}
  entries.forEach((e) => {
    if (!groups[e.date]) groups[e.date] = []
    groups[e.date].push(e)
  })
  return Object.keys(groups)
    .sort((a, b) => b.localeCompare(a))
    .map((date) => ({
      date,
      entries: groups[date].sort((a, b) => a.session.localeCompare(b.session)),
    }))
}

function History({ onChanged }) {
  const { profile, isAdmin } = useAuth()
  const [data, setData] = useState({ loading: true, entries: [], error: '' })
  const [filter, setFilter] = useState('All')
  const [nameFilter, setNameFilter] = useState('All')
  const [simFilter, setSimFilter] = useState('All')
  const [openId, setOpenId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [notice, setNotice] = useState(null)
  const [localCount, setLocalCount] = useState(() => loadLocalHistory().length)
  const [importing, setImporting] = useState(false)

  const reload = useCallback(
    () =>
      fetchSessions()
        .then((entries) => setData({ loading: false, entries, error: '' }))
        .catch((err) => setData((prev) => ({ ...prev, loading: false, error: err.message }))),
    [],
  )

  useEffect(() => {
    reload()
  }, [reload])

  const approved = data.entries.filter((e) => e.approvalStatus === 'approved')
  const others = data.entries.filter((e) =>
    isAdmin ? e.approvalStatus === 'rejected' : e.submittedBy === profile.id && e.approvalStatus !== 'approved',
  )

  const names = [...new Set(approved.map((e) => e.name))].sort((a, b) => a.localeCompare(b))
  const simNames = [...new Set(approved.map((e) => e.simName).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const visible = approved.filter(
    (e) =>
      (filter === 'All' || e.session === filter) &&
      (nameFilter === 'All' || e.name === nameFilter) &&
      (simFilter === 'All' || e.simName === simFilter),
  )
  const groups = groupByDate(visible)

  const toggle = (id) => {
    setOpenId(openId === id ? null : id)
    setEditingId(null)
  }

  const handleDelete = async (entry) => {
    if (!window.confirm(`Delete ${entry.session} on ${entry.date} by ${entry.name}? This cannot be undone.`)) return
    try {
      await deleteSession(entry.id)
      setOpenId(null)
      setNotice({ type: 'success', text: 'Session deleted.' })
      await reload()
      onChanged?.()
    } catch (err) {
      setNotice({ type: 'error', text: err.message })
    }
  }

  const handleEdit = (entry) => async (values) => {
    await updateSession(entry.id, values)
    setEditingId(null)
    setNotice({ type: 'success', text: `${values.session} for ${values.date} updated.` })
    await reload()
    return { type: 'success', text: 'Saved.' }
  }

  const handleImport = async () => {
    const local = loadLocalHistory()
    if (!window.confirm(`Upload ${local.length} session(s) saved in this browser to the database?`)) return
    setImporting(true)
    const failed = []
    let imported = 0
    for (const entry of local) {
      try {
        await submitSession({
          date: entry.date,
          session: entry.session,
          start: entry.start,
          end: entry.end,
          note: `Imported from browser. Original name: ${entry.name || 'unknown'}`,
        })
        imported += 1
      } catch (err) {
        failed.push({ ...entry, importError: err.message })
      }
    }
    saveLocalHistory(failed)
    setLocalCount(failed.length)
    setImporting(false)
    setNotice({
      type: failed.length ? 'warning' : 'success',
      text: `Imported ${imported} session(s).${failed.length ? ` ${failed.length} could not be imported (usually because that date and session already exists) and were kept in this browser.` : ''}`,
    })
    reload()
  }

  const renderItem = (entry, showApproval) => (
    <SessionListItem
      key={entry.id}
      entry={entry}
      isOpen={openId === entry.id}
      onToggle={() => toggle(entry.id)}
      showApproval={showApproval}
    >
      {isAdmin &&
        (editingId === entry.id ? (
          <div className="card editor">
            <h3>Edit session</h3>
            <SessionForm
              initial={{
                date: entry.date,
                session: entry.session,
                simId: entry.simId,
                start: entry.start,
                end: entry.end,
                complaints: entry.complaints,
              }}
              submitLabel="Save changes"
              requireSim={false}
              onSubmit={handleEdit(entry)}
              onCancel={() => setEditingId(null)}
            />
          </div>
        ) : (
          <div className="actions">
            <button className="btn" onClick={() => setEditingId(entry.id)}>Edit</button>
            <button className="btn btn-danger" onClick={() => handleDelete(entry)}>Delete</button>
          </div>
        ))}
    </SessionListItem>
  )

  return (
    <div className="page">
      <div className="card history-toolbar">
        <h2>Session History</h2>
        <div className="history-filters">
          <div className="field">
            <label htmlFor="history-filter">Session</label>
            <select id="history-filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="All">All sessions</option>
              {SESSIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="history-name-filter">Submitted by</label>
            <select id="history-name-filter" value={nameFilter} onChange={(e) => setNameFilter(e.target.value)}>
              <option value="All">Everyone</option>
              {names.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="history-sim-filter">SIM</label>
            <select id="history-sim-filter" value={simFilter} onChange={(e) => setSimFilter(e.target.value)}>
              <option value="All">All SIMs</option>
              {simNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
      </div>

      {isAdmin && localCount > 0 && (
        <div className="card import-card">
          <span>{localCount} session(s) from the old version are saved in this browser only.</span>
          <button className="btn btn-primary" onClick={handleImport} disabled={importing}>
            {importing ? 'Importing…' : 'Import to database'}
          </button>
        </div>
      )}

      {notice && <p className={`notice ${notice.type}`}>{notice.text}</p>}
      {data.error && <p className="notice error">{data.error}</p>}
      {data.loading && <div className="card empty">Loading…</div>}

      {others.length > 0 && (
        <div className="history-group">
          <h3 className="history-date">{isAdmin ? 'Rejected sessions' : 'My pending & rejected submissions'}</h3>
          <ul className="history-list">{others.map((e) => renderItem(e, true))}</ul>
        </div>
      )}

      {!data.loading && groups.length === 0 && (
        <div className="card empty">No approved sessions yet.</div>
      )}

      {groups.map(({ date, entries }) => (
        <div key={date} className="history-group">
          <h3 className="history-date">{date}</h3>
          <ul className="history-list">{entries.map((e) => renderItem(e, false))}</ul>
        </div>
      ))}
    </div>
  )
}

export default History
