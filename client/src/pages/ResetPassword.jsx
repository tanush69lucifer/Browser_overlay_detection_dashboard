import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!token) return toast.error('This reset link is missing its token');
    if (password.length < 8) return toast.error('Password must be at least 8 characters');
    if (password !== confirmPassword) return toast.error('Passwords do not match');
    try {
      setSubmitting(true);
      await api.post('/auth/reset-password', { token, password });
      toast.success('Password reset. Please sign in.');
      navigate('/login', { replace: true });
    } catch (error) {
      toast.error(error?.message || 'Unable to reset password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-base px-4 py-10">
      <Card className="w-full max-w-md border-slate-700 bg-surface p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Account recovery</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Choose a new password</h1>
        {token ? (
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <Input label="New password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            <Input label="Confirm new password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            <p className="text-xs text-slate-400">Use at least 8 characters. Reset links expire after 30 minutes.</p>
            <Button type="submit" className="w-full" loading={submitting}>{submitting ? 'Updating...' : 'Reset password'}</Button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-slate-300">This reset link is incomplete. Request a new one from the <Link className="text-primary hover:text-indigo-300" to="/login">sign-in page</Link>.</p>
        )}
      </Card>
    </main>
  );
}
