function NavBar({ pages, page, onNavigate, pendingCount }) {
  return (
    <nav className="nav">
      {pages.map((p) => (
        <button
          key={p}
          className={`nav-link ${page === p ? 'active' : ''}`}
          onClick={() => onNavigate(p)}
        >
          {p}
          {p === 'Approvals' && pendingCount > 0 && <span className="nav-badge">{pendingCount}</span>}
        </button>
      ))}
    </nav>
  )
}

export default NavBar
