import { DEPOSIT_RATE, WITHDRAWAL_RATE, MATCH_TOLERANCE } from '../functions/calcBalance'
import { fmt } from '../functions/sessionOptions'

const signClass = (n) => (n > 0 ? 'positive' : n < 0 ? 'negative' : '')

function Results({ result: r }) {
  return (
    <div className="results">
      {r.warnings?.length > 0 && (
        <ul className="notice warning">
          {r.warnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}

      <div className="results-grid">
        <section className="card">
          <h3>1. Session Profit</h3>
          <div className="row"><span>Start total (Tele + Reddy)</span><span>{fmt(r.startTotal)}</span></div>
          <div className="row"><span>End total (Tele + Reddy)</span><span>{fmt(r.endTotal)}</span></div>
          <div className="row total">
            <span>Session profit</span>
            <span className={signClass(r.sessionProfit)}>{fmt(r.sessionProfit)}</span>
          </div>
        </section>

        <section className="card">
          <h3>2. Deposit &amp; Withdrawal</h3>
          <div className="row"><span>Deposit in session</span><span>{fmt(r.depositInSession)}</span></div>
          <div className="row sub"><span>Commission ({DEPOSIT_RATE * 100}%)</span><span>{fmt(r.depositCommission)}</span></div>
          <div className="row"><span>Withdrawal in session</span><span>{fmt(r.withdrawalInSession)}</span></div>
          <div className="row sub"><span>Commission ({WITHDRAWAL_RATE * 100}%)</span><span>{fmt(r.withdrawalCommission)}</span></div>
          <div className="row total"><span>Total commission</span><span>{fmt(r.totalCommission)}</span></div>
        </section>

        <section className="card">
          <h3>3. Comparison</h3>
          <div className="row"><span>Session profit</span><span>{fmt(r.sessionProfit)}</span></div>
          <div className="row"><span>Total commission</span><span>{fmt(r.totalCommission)}</span></div>
          <div className="row total">
            <span>Difference</span>
            <span className={signClass(r.difference)}>{fmt(r.difference)}</span>
          </div>
          <div className="status">
            <span className={`badge badge-${r.status.toLowerCase()}`}>{r.status}</span>
            <span className="muted">tolerance ±{MATCH_TOLERANCE} birr</span>
          </div>
        </section>

        <section className="card">
          <h3>4. Expected End Balances</h3>
          <table className="table">
            <thead>
              <tr><th></th><th>Expected</th><th>Actual</th><th>Gap</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>Tele Birr</td><td>{fmt(r.expectedTele)}</td><td>{fmt(r.actualTele)}</td>
                <td className={signClass(r.teleGap)}>{fmt(r.teleGap)}</td>
              </tr>
              <tr>
                <td>Reddy</td><td>{fmt(r.expectedReddy)}</td><td>{fmt(r.actualReddy)}</td>
                <td className={signClass(r.reddyGap)}>{fmt(r.reddyGap)}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    </div>
  )
}

export default Results
