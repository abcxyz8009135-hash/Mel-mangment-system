import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { AuthContext } from './AuthContext'

export function AuthProvider({ children }) {
  // undefined = still checking, null = logged out
  const [session, setSession] = useState(undefined)
  const [profileState, setProfileState] = useState({ userId: null, profile: null })
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id ?? null

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data) {
          setAuthError('Your account has no profile yet. Ask the admin to set it up.')
          supabase.auth.signOut()
        } else if (!data.active) {
          setAuthError('Your account has been deactivated.')
          supabase.auth.signOut()
        } else {
          setAuthError('')
          setProfileState({ userId, profile: data })
        }
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const profile = userId && profileState.userId === userId ? profileState.profile : null
  const loading = session === undefined || (userId !== null && profile === null && !authError)

  const signIn = async (email, password) => {
    setAuthError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
  }

  const signOut = () => supabase.auth.signOut()

  const value = {
    user: session?.user ?? null,
    profile,
    isAdmin: profile?.role === 'admin',
    loading,
    authError,
    signIn,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
