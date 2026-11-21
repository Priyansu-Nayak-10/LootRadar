import { useState } from 'react'
import { hasSupabaseConfig, supabase } from '../lib/supabase'

export default function Account({ session }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  if (!hasSupabaseConfig || !supabase) {
    return (
      <section className="form-panel collection-section">
        <h2 className="form-heading">Account unavailable</h2>
        <p className="empty-state">Supabase environment variables are not configured.</p>
      </section>
    )
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/#/discover`,
          },
        })
        if (error) throw error
        setMessage('Check your email and confirm your account before signing in.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (error) throw error
        setPassword('')
        setMessage('Signed in successfully.')
      }
    } catch (error) {
      setMessage(error.message || 'The account request could not be completed.')
    } finally {
      setLoading(false)
    }
  }

  async function signOut() {
    setLoading(true)
    setMessage('')
    const { error } = await supabase.auth.signOut()
    setLoading(false)
    if (error) setMessage(error.message)
  }

  if (session) {
    return (
      <section className="form-panel collection-section">
        <h2 className="form-heading">Your account</h2>
        <p className="account-email">{session.user.email}</p>
        {message && <p className="form-message" role="status">{message}</p>}
        <button type="button" className="form-submit" onClick={signOut} disabled={loading}>
          {loading ? 'Signing out...' : 'Sign out'}
        </button>
      </section>
    )
  }

  return (
    <section className="form-panel collection-section">
      <h2 className="form-heading">{mode === 'signup' ? 'Create account' : 'Sign in'}</h2>
      <div className="auth-mode-tabs" aria-label="Account mode">
        <button
          type="button"
          className={mode === 'signin' ? 'is-selected' : ''}
          aria-pressed={mode === 'signin'}
          onClick={() => setMode('signin')}
        >
          Sign in
        </button>
        <button
          type="button"
          className={mode === 'signup' ? 'is-selected' : ''}
          aria-pressed={mode === 'signup'}
          onClick={() => setMode('signup')}
        >
          Sign up
        </button>
      </div>
      <form className="form-grid" onSubmit={handleSubmit}>
        <label className="form-field is-wide">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label className="form-field is-wide">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            minLength={6}
            required
          />
        </label>
        {message && <p className="form-message" role="status">{message}</p>}
        <button type="submit" className="form-submit" disabled={loading}>
          {loading ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </button>
      </form>
    </section>
  )
}
