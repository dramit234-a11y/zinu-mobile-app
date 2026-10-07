'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ApiError, adminFetch } from '../../lib/api';

/** Staff sign-in: email + password + mandatory authenticator code. */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminFetch('/v1/admin/auth/login', { method: 'POST', body: { email, password, totp: totp || undefined } });
      router.replace('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login">
      <form className="box form" onSubmit={submit} aria-labelledby="title">
        <div className="brand" style={{ color: 'var(--text)', padding: 0 }}>
          <div className="brand-mark">Z</div> ZINU Admin
        </div>
        <h1 id="title" style={{ fontSize: 20 }}>
          Staff sign in
        </h1>
        <label>
          Email
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label>
          Authenticator code
          <input inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="one-time-code" required value={totp} onChange={(e) => setTotp(e.target.value.replace(/\D/g, ''))} />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>
          Access is restricted to authorised ZINU staff. All actions are audited.
        </p>
      </form>
    </main>
  );
}
