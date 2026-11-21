import { useEffect, useState } from 'react'
import { hasSupabaseConfig, supabase } from '../lib/supabase'

export default function Account({ session }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [telegramConnection, setTelegramConnection] = useState(null)
  const [telegramLink, setTelegramLink] = useState('')
  const [telegramLoading, setTelegramLoading] = useState(false)

  useEffect(() => {
    if (!session || !supabase) return
    let cancelled = false

    supabase
      .from('telegram_connections')
      .select('chat_id, username, connected_at')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setTelegramConnection(data)
      })

    return () => {
      cancelled = true
    }
  }, [session])

  function createCode() {
    const bytes = new Uint8Array(6)
    crypto.getRandomValues(bytes)
    return [...bytes].map((byte) => byte.toString(36).padStart(2, '0')).join('').slice(0, 8).toUpperCase()
  }

  async function connectTelegram() {
    if (!session || !supabase) return
    setTelegramLoading(true)
    setMessage('')

    try {
      const code = createCode()
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
      const { error } = await supabase
        .from('telegram_link_codes')
        .upsert({
          user_id: session.user.id,
          code,
          expires_at: expiresAt,
          used_at: null,
        }, { onConflict: 'user_id' })
      if (error) throw error

      setTelegramLink(`https://t.me/GameRadar7_bot?start=${encodeURIComponent(code)}`)
      setMessage('One-time Telegram link created. It expires in 15 minutes.')
    } catch (error) {
      setMessage(error.message || 'Could not create a Telegram link.')
    } finally {
      setTelegramLoading(false)
    }
  }

  async function disconnectTelegram() {
    if (!session || !supabase) return
    setTelegramLoading(true)
    setMessage('')
    const { error } = await supabase
      .from('telegram_connections')
      .delete()
      .eq('user_id', session.user.id)
    setTelegramLoading(false)
    if (error) {
      setMessage(error.message)
      return
    }
    setTelegramConnection(null)
    setTelegramLink('')
    setMessage('Telegram connection removed.')
  }

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
        <div className="telegram-account-card">
          <h3>Telegram alerts</h3>
          {telegramConnection ? (
            <>
              <p>Connected{telegramConnection.username ? ` to @${telegramConnection.username}` : ''}.</p>
              <button type="button" className="form-submit" onClick={disconnectTelegram} disabled={telegramLoading}>
                {telegramLoading ? 'Removing...' : 'Disconnect Telegram'}
              </button>
            </>
          ) : (
            <>
              <p>No Telegram account is connected.</p>
              <button type="button" className="form-submit" onClick={connectTelegram} disabled={telegramLoading}>
                {telegramLoading ? 'Creating link...' : 'Connect Telegram'}
              </button>
              {telegramLink && (
                <a
                  className="telegram-link"
                  href={telegramLink}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open Telegram bot
                </a>
              )}
            </>
          )}
        </div>
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
