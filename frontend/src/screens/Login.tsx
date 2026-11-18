import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { Icon } from '../components/Icon'
import { Btn } from '../components/ui'
import { apiErrorText, auth, type AuthUser } from '../api'

function loadCachedCompany() {
  try { return JSON.parse(localStorage.getItem('mms-company') || '{}') } catch { return {} }
}

export default function Login({ onAuth }: { onAuth: (user: AuthUser) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [capsOn, setCapsOn] = useState(false)
  const [busy, setBusy] = useState(false)
  // e.g. "Your session expired" after an automatic sign-out
  const [err, setErr] = useState<string | null>(() => {
    try { const r = sessionStorage.getItem('mms-logout-reason'); sessionStorage.removeItem('mms-logout-reason'); return r } catch { return null }
  })
  const cached = loadCachedCompany()
  const companyName: string = cached.name || 'NMS-Auto'

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true); setErr(null)
    try {
      const { token, user } = await auth.login(email.trim().toLowerCase(), password)
      auth.setToken(token)
      localStorage.setItem('mms-route', 'dash')
      onAuth(user)
    } catch (ex: any) {
      setErr(apiErrorText(ex, 'Login failed. Check credentials and try again.'))
      setPassword('')
    } finally {
      setBusy(false)
    }
  }

  const trackCaps = (e: KeyboardEvent<HTMLInputElement>) => setCapsOn(e.getModifierState?.('CapsLock') ?? false)

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--bg-0)' }}>
      <form onSubmit={submit} noValidate={false} aria-busy={busy} className="fade-in" style={{
        width: '100%', maxWidth: 380, background: 'var(--bg-1)', border: '1px solid var(--line)',
        borderRadius: 'var(--r-l, 16px)', padding: 28, display: 'flex', flexDirection: 'column', gap: 16,
        boxShadow: '0 30px 60px -30px rgba(0,0,0,0.6)',
      }}>
        <div className="row gap-3" style={{ alignItems: 'center', marginBottom: 4 }}>
          <img src="/logo-mark.png" alt="NMS Auto Supply" width={44} height={44} style={{ flexShrink: 0, display: 'block' }} />
          <div style={{ lineHeight: 1.2, minWidth: 0 }}>
            <div style={{ fontFamily: 'Saira', fontWeight: 800, fontSize: 18 }}>{companyName}</div>
            <div className="eyebrow" style={{ fontSize: 10 }}>Sign in to continue</div>
          </div>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="eyebrow" style={{ fontSize: 10 }}>Email</span>
          <input className="mms-login-input" type="email" autoComplete="username" inputMode="email"
            spellCheck={false} autoCapitalize="off" maxLength={190} value={email}
            onChange={(e) => setEmail(e.target.value)} required autoFocus disabled={busy} />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="eyebrow" style={{ fontSize: 10 }}>Password</span>
          <div style={{ position: 'relative' }}>
            <input
              className="mms-login-input"
              style={{ paddingRight: 42 }}
              type={showPw ? 'text' : 'password'}
              autoComplete="current-password"
              maxLength={200}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyUp={trackCaps}
              onKeyDown={trackCaps}
              onBlur={() => setCapsOn(false)}
              required
              disabled={busy}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? 'Hide password' : 'Show password'}
              title={showPw ? 'Hide password' : 'Show password'}
              style={{
                position: 'absolute', top: '50%', right: 8, transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', padding: 6,
                color: 'var(--tx-2)', display: 'grid', placeItems: 'center',
              }}
            >
              <Icon n={showPw ? 'eye-off' : 'eye'} s={18} />
            </button>
          </div>
          {capsOn && (
            <span style={{ fontSize: 11.5, color: 'var(--warn)' }}>Caps Lock is on</span>
          )}
        </label>

        {err && (
          <div role="alert" className="row gap-2" style={{ background: 'var(--bad-dim)', color: 'var(--bad)', border: '1px solid var(--bad)',
            padding: '9px 12px', borderRadius: 'var(--r-s)', fontSize: 12.5, alignItems: 'flex-start', lineHeight: 1.4 }}>
            <Icon n="x" s={15} />
            <span>{err}</span>
          </div>
        )}

        <Btn type="submit" variant="primary" size="lg" icon="shield" loading={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Btn>

        <div className="t-3" style={{ fontSize: 11, textAlign: 'center', marginTop: 2 }}>
          Forgot your password? Ask your system administrator to reset it.
        </div>
      </form>
    </div>
  )
}
