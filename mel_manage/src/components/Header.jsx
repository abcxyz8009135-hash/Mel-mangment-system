import NavBar from './NavBar'
import { useAuth } from '../auth/AuthContext'
import { BUSINESS_NAME } from '../lib/supabase'

function Header({ pages, page, onNavigate, pendingCount }) {
  const { profile, signOut } = useAuth()

  return (
    <header className="header">
      <div className="header-inner">
        <h1>{BUSINESS_NAME}</h1>
        <NavBar pages={pages} page={page} onNavigate={onNavigate} pendingCount={pendingCount} />
        <div className="user-chip">
          <span>
            {profile.full_name} <span className="muted">· {profile.role}</span>
          </span>
          <button className="btn btn-ghost btn-small" onClick={signOut}>Log out</button>
        </div>
      </div>
    </header>
  )
}

export default Header
