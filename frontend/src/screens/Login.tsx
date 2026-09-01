import { useState, type FormEvent } from 'react'
import { Icon } from '../components/Icon'
import { Btn } from '../components/ui'
import { auth, type AuthUser } from '../api'

function loadCachedCompany() {
  try { return JSON.parse(localStorage.getItem('mms-company') || '{}') } catch { return {} }
}

export default function Login({ onAuth }: { onAuth: (user: AuthUser) => void }) {
  const [email, setEmail] = useState('admin@mms-auto.lk')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const cached = loadCachedCompany()
  const companyName: string = cached.name || 'NMS-Auto'
  const logoUrl: string = cached.logoUrl || ''

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      const { token, user } = await auth.login(email.trim(), password)
      auth.setToken(token)
      localStorage.setItem('mms-route', 'dash')
      onAuth(user)
    } catch (ex: any) {
      const msg = ex?.response?.data?.message
        || ex?.response?.data?.errors?.email?.[0]
        || 'Login failed. Check credentials and try again.'
      setErr(msg)
    } finally {
      setBusy(false)
    }
  }

  const input: React.CSSProperties = {
    background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-s)',
    padding: '11px 14px', color: 'var(--tx-0)', fontSize: 14, fontFamily: 'IBM Plex Sans', width: '100%', outline: 'none',
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--bg-1)' }}>
      <form onSubmit={submit} style={{
        width: '100%', maxWidth: 380, background: 'var(--bg-2)', border: '1px solid var(--line)',
        borderRadius: 'var(--r-l, 16px)', padding: 28, display: 'flex', flexDirection: 'column', gap: 16,
        boxShadow: '0 30px 60px -30px rgba(0,0,0,0.6)',
      }}>
        <div className="row gap-3" style={{ alignItems: 'center', marginBottom: 4 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--ac)', display: 'grid', placeItems: 'center', color: '#fff', boxShadow: '0 2px 12px -2px var(--ac-line)', overflow: 'hidden' }}>
            {logoUrl ? <img src={logoUrl} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Icon n="wrench" s={20} />}
          </div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontFamily: 'Saira', fontWeight: 800, fontSize: 18 }}>{companyName}</div>
            <div className="eyebrow" style={{ fontSize: 10 }}>Sign in to continue</div>
          </div>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="eyebrow" style={{ fontSize: 10 }}>Email</span>
          <input style={input} type="email" autoComplete="username" value={email}
            onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="eyebrow" style={{ fontSize: 10 }}>Password</span>
          <div style={{ position: 'relative' }}>
            <input
              style={{ ...input, paddingRight: 42 }}
              type={showPw ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
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
        </label>

        {err && (
          <div style={{ background: 'var(--bad-dim)', color: 'var(--bad)', border: '1px solid var(--bad)',
            padding: '8px 12px', borderRadius: 'var(--r-s)', fontSize: 12.5 }}>{err}</div>
        )}

        <Btn variant="primary" size="lg" icon="shield" disabled={busy}>
          {busy ? 'Signing in...' : 'Sign in'}
        </Btn>

        <div className="t-2" style={{ fontSize: 11, textAlign: 'center', marginTop: 4 }}>
          Default admin: <code style={{ fontFamily: 'JetBrains Mono' }}>admin@mms-auto.lk</code> / <code style={{ fontFamily: 'JetBrains Mono' }}>password</code>
        </div>
      </form>
    </div>
  )
}
