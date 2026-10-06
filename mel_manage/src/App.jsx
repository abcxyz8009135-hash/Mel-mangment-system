import { useCallback, useEffect, useState } from 'react'
import './App.css'
import Header from './components/Header'
import Home from './pages/Home'
import History from './pages/History'
import Approvals from './pages/Approvals'
import Summary from './pages/Summary'
import Sims from './pages/Sims'
import Transfers from './pages/Transfers'
import Login from './pages/Login'
import { useAuth } from './auth/AuthContext'
import { fetchPendingCount } from './functions/sessionsApi'

const PENDING_REFRESH_MS = 60_000

function App() {
  const { profile, isAdmin, loading } = useAuth()
  const [page, setPage] = useState('Home')
  const [pendingCount, setPendingCount] = useState(0)

  const refreshPending = useCallback(() => {
    fetchPendingCount().then(setPendingCount).catch(() => {})
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    refreshPending()
    const timer = setInterval(refreshPending, PENDING_REFRESH_MS)
    return () => clearInterval(timer)
  }, [isAdmin, refreshPending])

  if (loading) return <div className="login-wrap"><p className="muted">Loading…</p></div>
  if (!profile) return <Login />

  const pages = isAdmin ? ['Home', 'History', 'Approvals', 'Summary', 'Transfers', 'SIMs'] : ['Home', 'History', 'Transfers']
  const current = pages.includes(page) ? page : 'Home'

  const navigate = (p) => {
    setPage(p)
    if (isAdmin) refreshPending()
  }

  return (
    <>
      <Header pages={pages} page={current} onNavigate={navigate} pendingCount={pendingCount} />
      <main className="container">
        {current === 'Home' && <Home onSubmitted={isAdmin ? refreshPending : undefined} />}
        {current === 'History' && <History onChanged={isAdmin ? refreshPending : undefined} />}
        {current === 'Approvals' && <Approvals onChanged={refreshPending} />}
        {current === 'Summary' && <Summary />}
        {current === 'Transfers' && <Transfers />}
        {current === 'SIMs' && <Sims />}
      </main>
    </>
  )
}

export default App
