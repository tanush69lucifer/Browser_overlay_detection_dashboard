import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../store/auth';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import api from '../api/client';

const initialState = { email: '', password: '' };
export default function Login() {
  const navigate = useNavigate();
  const user = useAuth((state) => state.user);
  const login = useAuth((state) => state.login);
  const [form, setForm] = useState(initialState);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);
  useEffect(() => {
    if (user) navigate('/');
  }, [user, navigate]);

  const validate = () => {
    const nextErrors = {};
    if (!form.email.trim()) nextErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = 'Enter a valid email';
    if (!form.password) nextErrors.password = 'Password is required';
    return nextErrors;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    try {
      setSubmitting(true);
      await login(form.email.trim(), form.password);
      toast.success('Signed in successfully');
      navigate('/');
    } catch (error) {
      toast.error(error?.message || 'Unable to sign in');
    } finally {
      setSubmitting(false);
    }
  };

  const onRequestPasswordReset = async (event) => {
    event.preventDefault();
    const email = resetEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Enter a valid email address');
      return;
    }
    try {
      setResetSubmitting(true);
      const result = await api.post('/auth/forgot-password', { email });
      toast.success(result.message || 'If the account exists, reset instructions have been sent.');
      setForgotMode(false);
    } catch (error) {
      toast.error(error?.message || 'Unable to request a password reset');
    } finally {
      setResetSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-base px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-700 bg-surface shadow-2xl shadow-slate-950/30 lg:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col justify-between bg-gradient-to-br from-primary/20 via-slate-900 to-slate-950 p-6 sm:p-8">
          <div>
            <div className="inline-flex rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-primary">
              Browser overlay detection
            </div>
            <h1 className="mt-6 text-3xl font-semibold text-white sm:text-4xl">Monitor integrity before every exam.</h1>
            <p className="mt-4 max-w-md text-sm text-slate-300">
              Detect extension overlays, focus leakage and unsafe browsing patterns in real time with a calm, low-noise monitoring console.
            </p>
          </div>

          <div className="mt-8 rounded-2xl border border-slate-700/80 bg-slate-950/40 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <span className="h-2.5 w-2.5 rounded-full bg-ok" />
              Privacy-first monitoring
            </div>
            <p className="mt-2 text-sm text-slate-300">
              Integrity signals use overlay metadata and focus events. With the optional browser companion, active-tab URL/title metadata is also shared during an exam. Page text, keystrokes, camera and screen are not captured.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center p-6 sm:p-8">
          <Card className="w-full max-w-md border-slate-700 bg-base">
            <div className="mb-6">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Welcome back</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">{forgotMode ? 'Reset your password' : 'Sign in'}</h2>
            </div>

            {forgotMode ? (
              <form onSubmit={onRequestPasswordReset} className="space-y-4">
                <p className="text-sm text-slate-300">Enter your account email and we’ll send a secure password reset link.</p>
                <Input
                  label="Email"
                  type="email"
                  name="resetEmail"
                  autoComplete="email"
                  value={resetEmail}
                  placeholder="name@example.com"
                  onChange={(event) => setResetEmail(event.target.value)}
                />
                <Button type="submit" className="w-full" loading={resetSubmitting}>
                  {resetSubmitting ? 'Sending link...' : 'Send reset link'}
                </Button>
                <button type="button" className="w-full text-sm text-primary hover:text-indigo-300" onClick={() => setForgotMode(false)}>
                  Back to sign in
                </button>
              </form>
            ) : <form onSubmit={onSubmit} className="space-y-4">
              <Input
                label="Email"
                type="email"
                name="email"
                autoComplete="email"
                value={form.email}
                placeholder="name@example.com"
                error={errors.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              />

              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                value={form.password}
                placeholder="Enter password"
                error={errors.password}
                trailing={(
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="rounded p-1 text-slate-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-primary/60"
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                )}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              />

              <div className="-mt-2 flex justify-end">
                <button
                  type="button"
                  className="text-sm text-primary hover:text-indigo-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                  onClick={() => {
                    setResetEmail(form.email.trim());
                    setForgotMode(true);
                  }}
                >
                  Forgot password?
                </button>
              </div>

              <Button type="submit" className="w-full" loading={submitting}>
                {submitting ? 'Signing in...' : 'Login'}
              </Button>
            </form>}

          </Card>
        </div>
      </div>
    </div>
  );
}

function EyeIcon({ visible }) {
  return visible ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.2 9.5 6-.4.8-1.3 2-2.7 3.1M6.2 6.2C4.2 7.4 2.9 9.3 2.5 11c1 1.8 4.5 6 9.5 6 1.2 0 2.3-.2 3.3-.6" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" transform="translate(0 4)" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.74 7.18l7.64 5.93c4.46-4.11 7.14-10.16 7.14-17.58Z" />
      <path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a23.9 23.9 0 0 0 0 21.56l7.98-6.19Z" transform="translate(0 3)" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.87l-7.64-5.93c-2.12 1.42-4.84 2.25-8.27 2.25-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
    </svg>
  );
}
