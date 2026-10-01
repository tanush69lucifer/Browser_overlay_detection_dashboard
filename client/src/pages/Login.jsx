import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../store/auth';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';

const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@demo.com', password: 'Admin@123' },
  { role: 'Proctor', email: 'proctor@demo.com', password: 'Proctor@123' },
  { role: 'Candidate', email: 'candidate@demo.com', password: 'Candidate@123' },
];

const initialState = { email: '', password: '' };

export default function Login() {
  const navigate = useNavigate();
  const user = useAuth((state) => state.user);
  const login = useAuth((state) => state.login);
  const [form, setForm] = useState(initialState);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

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

          <div className="mt-8 space-y-3 rounded-2xl border border-slate-700/80 bg-slate-950/40 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Demo accounts</div>
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-slate-700 bg-slate-900/40 px-3 py-2 text-left text-sm text-slate-200 transition hover:border-primary/50 hover:bg-slate-800/80"
                onClick={() => setForm({ email: account.email, password: account.password })}
              >
                <span>
                  <span className="font-medium text-white">{account.role}</span>
                  <span className="ml-2 text-slate-400">{account.email}</span>
                </span>
                <span className="text-xs text-primary">Use</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-center p-6 sm:p-8">
          <Card className="w-full max-w-md border-slate-700 bg-base">
            <div className="mb-6">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Welcome back</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Sign in</h2>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <Input
                label="Email"
                type="email"
                name="email"
                value={form.email}
                placeholder="name@example.com"
                error={errors.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              />

              <Input
                label="Password"
                type="password"
                name="password"
                value={form.password}
                placeholder="Enter password"
                error={errors.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              />

              <Button type="submit" className="w-full" loading={submitting}>
                {submitting ? 'Signing in...' : 'Login'}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
