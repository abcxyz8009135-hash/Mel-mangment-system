import Results from './Results'
import { FIELD_LABELS, fmt } from '../functions/sessionOptions'

const APPROVAL_LABELS = { pending: 'Waiting for approval', rejected: 'Rejected', approved: 'Approved' }

// One clickable row in a session list; expands to show full details.
// `children` is rendered under the details (action buttons, editors, ...).
function SessionListItem({ entry, isOpen, onToggle, showApproval = false, children }) {
  const r = entry.result
  // Sessions saved before complaints existed only have `status`.
  const finalStatus = r.adjustedStatus ?? r.status

  return (
    <li className={`history-item ${isOpen ? 'open' : ''}`}>
      <button className="history-summary" onClick={onToggle}>
        <span className="history-session">
          {entry.session}
          {entry.time && <span className="muted"> · {entry.time}</span>}
        </span>
        <span className="history-name">{entry.name}</span>
        <span className="history-sim">{entry.simName || 'No SIM'}</span>
        <span className="history-stat">Profit {fmt(r.sessionProfit)}</span>
        <span className="history-stat">Commission {fmt(r.totalCommission)}</span>
        <span className={`badge badge-${finalStatus.toLowerCase()}`}>{finalStatus}</span>
        {showApproval && (
          <span className={`badge badge-${entry.approvalStatus}`}>{APPROVAL_LABELS[entry.approvalStatus]}</span>
        )}
        <span className="chevron">{isOpen ? '▾' : '▸'}</span>
      </button>

      {isOpen && (
        <div className="history-details">
          <table className="table inputs-table">
            <thead>
              <tr><th></th><th>Start</th><th>End</th></tr>
            </thead>
            <tbody>
              {Object.keys(FIELD_LABELS).map((key) => (
                <tr key={key}>
                  <td>{FIELD_LABELS[key]}</td>
                  <td>{fmt(entry.start[key])}</td>
                  <td>{fmt(entry.end[key])}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <Results result={r} />

          <div className="meta">
            <span>Submitted by <strong>{entry.name}</strong> on {new Date(entry.savedAt).toLocaleString()}</span>
            <span>
              SIM: <strong>{entry.simName || '—'}</strong>
              {entry.simPhone && <> ({entry.simPhone})</>}
            </span>
            {entry.reviewedAt && entry.approvalStatus !== 'pending' && (
              <span>
                {entry.approvalStatus === 'rejected' ? 'Rejected' : 'Approved'} by{' '}
                <strong>{entry.reviewerName}</strong> on {new Date(entry.reviewedAt).toLocaleString()}
              </span>
            )}
            {entry.time && <span>Session time: <strong>{entry.time}</strong></span>}
            {entry.note && <span>Note from {entry.name}: {entry.note}</span>}
            {entry.reviewNote && <span>Review note: {entry.reviewNote}</span>}
          </div>

          {children}
        </div>
      )}
    </li>
  )
}

export default SessionListItem
