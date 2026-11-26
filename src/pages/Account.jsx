import { useEffect, useState } from 'react'
import { hasSupabaseConfig, supabase, getAuthRedirectUrl } from '../lib/supabase'

export default function Account({ session, onSignOut }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [telegramConnection, setTelegramConnection] = useState(null)
  const [telegramLink, setTelegramLink] = useState('')
  const [telegramLoading, setTelegramLoading] = useState(false)
  const [alertEnabled, setAlertEnabled] = useState(true)
  const [alertMode, setAlertMode] = useState('all')
  const [alertPlatforms, setAlertPlatforms] = useState([])
  const [endingHours, setEndingHours] = useState(6)
  const [preferencesLoading, setPreferencesLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [telegramError, setTelegramError] = useState(false)
  const [reloadTrigger, setReloadTrigger] = useState(0)

  const retryLoadData = () => {
    setLoadError('')
    setTelegramError(false)
    setReloadTrigger((prev) => prev + 1)
  }

  useEffect(() => {
    if (!session || !supabase) return
    let cancelled = false

    supabase
      .from('notification_settings')
      .select('enabled, mode, platforms, ending_hours')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setLoadError("Couldn't load your Telegram/alert settings.")
          return
        }
        if (data) {
          setAlertEnabled(data.enabled)
          setAlertMode(data.mode)
          setAlertPlatforms(Array.isArray(data.platforms) ? data.platforms : [])
          setEndingHours(data.ending_hours || 6)
        }
      })

    return () => {
      cancelled = true
    }
  }, [session, reloadTrigger])

  useEffect(() => {
    if (!session || !supabase) return
    let cancelled = false

    supabase
      .from('telegram_connections')
      .select('chat_id, username, connected_at')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setTelegramError(true)
          setLoadError("Couldn't load your Telegram/alert settings.")
          return
        }
        setTelegramError(false)
        setTelegramConnection(data)
      })

    return () => {
      cancelled = true
    }
  }, [session, reloadTrigger])

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

      const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME?.trim() || 'GameRadar7_bot'
      setTelegramLink(`https://t.me/${botUsername}?start=${encodeURIComponent(code)}`)
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

  async function saveAlertPreferences() {
    if (!session || !supabase) return
    if (alertMode === 'platform' && alertPlatforms.length === 0) {
      setMessage('Pick at least one platform.')
      return
    }
    setPreferencesLoading(true)
    setMessage('')

    try {
      const { error } = await supabase
        .from('notification_settings')
        .upsert({
          user_id: session.user.id,
          enabled: alertEnabled,
          mode: alertMode,
          platforms: alertMode === 'platform' ? alertPlatforms : [],
          timezone: 'Asia/Kolkata',
          ending_hours: Number(endingHours),
        }, { onConflict: 'user_id' })
      if (error) throw error
      setMessage('Telegram alert preferences saved.')
    } catch (error) {
      setMessage(error.message || 'Could not save alert preferences.')
    } finally {
      setPreferencesLoading(false)
    }
  }

  function togglePlatform(platform) {
    setAlertPlatforms((current) =>
      current.includes(platform)
        ? current.filter((item) => item !== platform)
        : [...current, platform]
    )
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
            emailRedirectTo: getAuthRedirectUrl(),
          },
        })
        if (error) throw error
        setMode('signin')
        setPassword('')
        setMessage(
          'Check your email and confirm the account. Then sign in here to enable Connect Telegram.'
        )
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
    try {
      window.localStorage.removeItem('wishradar_library')
      window.localStorage.removeItem('wishradar_wishlist')
    } catch {}
    if (typeof onSignOut === 'function') {
      await onSignOut()
    } else {
      const { error } = await supabase.auth.signOut()
      if (error) setMessage(error.message)
    }
    setLoading(false)
  }

  async function forgotPassword() {
    if (!supabase) return
    const cleanEmail = email.trim()
    if (!cleanEmail) {
      setMessage('Enter your email first, then choose Forgot password.')
      return
    }

    setLoading(true)
    setMessage('')
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: getAuthRedirectUrl(),
    })
    setLoading(false)
    setMessage(
      error
        ? error.message
        : 'Password reset email sent. Check your inbox and spam folder.'
    )
  }

  async function signInWithGoogle() {
    if (!supabase) return
    setLoading(true)
    setMessage('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getAuthRedirectUrl(),
      },
    })
    if (error) {
      setLoading(false)
      setMessage(error.message)
    }
  }

  if (session) {
    return (
      <section className="account-redesign">
        <header className="redesign-page-header">
          <div>
            <span className="lr-section-heading__kicker">YOUR PROFILE</span>
            <h1>My <strong>Account</strong></h1>
          </div>
          <span className="lr-badge">{session.user.email}</span>
        </header>
        {loadError && (
          <div className="form-message" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', color: '#ff6b6b' }}>
            <span>{loadError}</span>
            <button
              type="button"
              className="lr-button lr-button--ghost"
              style={{ minHeight: '28px', padding: '0 10px', fontSize: '12px' }}
              onClick={retryLoadData}
            >
              Retry
            </button>
          </div>
        )}
        {message && <p className="form-message" role="status">{message}</p>}
        <div className="telegram-account-card" id="telegram-settings">
          <h3>Telegram alerts</h3>
          {telegramError ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <p style={{ margin: 0 }}>Couldn&apos;t load Telegram status.</p>
              <button
                type="button"
                className="lr-button lr-button--ghost"
                style={{ minHeight: '28px', padding: '0 10px', fontSize: '12px' }}
                onClick={retryLoadData}
              >
                Retry
              </button>
            </div>
          ) : telegramConnection ? (
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
                  rel="noopener noreferrer"
                >
                  Open Telegram bot
                </a>
              )}
            </>
          )}
        </div>
        <div className="alert-settings-card">
          <h3>Alert preferences</h3>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={alertEnabled}
              onChange={(event) => setAlertEnabled(event.target.checked)}
            />
            Notifications enabled
          </label>
          <label className="form-field">
            Which free games?
            <select
              value={alertMode}
              onChange={(event) => setAlertMode(event.target.value)}
            >
              <option value="all">All free games</option>
              <option value="wishlist">Wishlist games only</option>
              <option value="platform">Selected platforms</option>
            </select>
          </label>
          {alertMode === 'platform' && (
            <div className="platform-settings" aria-label="Alert platforms">
              {['Epic', 'Steam', 'GOG', 'itch.io', 'PlayStation', 'Xbox', 'Other'].map((platform) => (
                <button
                  key={platform}
                  type="button"
                  className={alertPlatforms.includes(platform) ? 'is-selected' : ''}
                  aria-pressed={alertPlatforms.includes(platform)}
                  onClick={() => togglePlatform(platform)}
                >
                  {platform}
                </button>
              ))}
            </div>
          )}
          {alertMode === 'platform' && alertPlatforms.length === 0 && (
            <p className="form-message" style={{ color: '#ff6b6b', margin: '6px 0 0', fontSize: '13px' }}>
              Pick at least one platform.
            </p>
          )}
          <label className="form-field">
            End reminder
            <select
              value={endingHours}
              onChange={(event) => setEndingHours(Number(event.target.value))}
            >
              {[1, 3, 6, 12, 24].map((hours) => (
                <option key={hours} value={hours}>{hours} hours before it ends</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="form-submit"
            onClick={saveAlertPreferences}
            disabled={preferencesLoading || (alertMode === 'platform' && alertPlatforms.length === 0)}
          >
            {preferencesLoading ? 'Saving...' : 'Save alert preferences'}
          </button>
        </div>
        <button type="button" className="form-submit" onClick={signOut} disabled={loading}>
          {loading ? 'Signing out...' : 'Sign out'}
        </button>
      </section>
    )
  }

  return (
    <section className="auth-redesign">
      <div className="auth-redesign__art">
        <div className="auth-radar-art" aria-hidden="true" />
        <div className="auth-welcome">
          <span className="lr-section-heading__kicker">WELCOME TO WISHRADAR</span>
          <h1>Track. Discover. <strong>Claim.</strong></h1>
          <div className="auth-feature-list">
            <span><b>01</b> Track Your Progress</span>
            <span><b>02</b> Get Exclusive Deals</span>
            <span><b>03</b> Claim Free Games</span>
          </div>
        </div>
      </div>
      <div className="auth-redesign__card">
        <div className="auth-logo" aria-label="WishRadar">
          <span className="brand-mark" aria-hidden="true">WR</span>
          <strong>Wish<span>Radar</span></strong>
        </div>
        <h2>{mode === 'signup' ? 'Create Account' : 'Welcome Back!'}</h2>
        <div className="auth-mode-tabs" aria-label="Account mode">
          <button
            type="button"
            className={mode === 'signin' ? 'is-selected' : ''}
            aria-pressed={mode === 'signin'}
            onClick={() => setMode('signin')}
          >
            Sign In
          </button>
          <button
            type="button"
            className={mode === 'signup' ? 'is-selected' : ''}
            aria-pressed={mode === 'signup'}
            onClick={() => setMode('signup')}
          >
            Sign Up
          </button>
        </div>
      <form className="form-grid auth-form" onSubmit={handleSubmit}>
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
          <span className="auth-password-field">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              minLength={6}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </span>
        </label>
        {mode === 'signin' && (
          <button type="button" className="auth-forgot" onClick={forgotPassword}>
            Forgot password?
          </button>
        )}
        {message && <p className="form-message" role="status">{message}</p>}
        <button type="submit" className="form-submit" disabled={loading}>
          {loading ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </button>
        <div className="auth-divider"><span>or</span></div>
        <button
          type="button"
          className="auth-google"
          onClick={signInWithGoogle}
          disabled={loading}
        >
          <span aria-hidden="true">G</span>
          Continue with Google
        </button>
      </form>
      </div>
    </section>
  )
}
