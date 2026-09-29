function SetupNeeded() {
  return (
    <div className="login-wrap">
      <div className="card login-card">
        <h1>Setup needed</h1>
        <p>
          The database connection is not configured. Set <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> (see <code>DEPLOY.md</code>).
        </p>
      </div>
    </div>
  )
}

export default SetupNeeded
