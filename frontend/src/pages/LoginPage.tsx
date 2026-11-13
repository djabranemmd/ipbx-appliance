import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { useSetupStatus } from '../auth/useSetupStatus';
import AuthCard from '../components/AuthCard';
import Field from '../components/Field';
import Spinner from '../components/Spinner';
import { errorMessage } from '../lib/api';

export default function LoginPage() {
  const { admin, loading, login } = useAuth();
  const setupStatus = useSetupStatus();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // where the user was going before being sent here
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  if (admin) return <Navigate to={from} replace />;
  // nobody can sign in until the first administrator exists
  if (setupStatus.data?.needsSetup) return <Navigate to="/setup" replace />;
  if (loading || setupStatus.isPending) return <Spinner fullPage />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard title="IPBX Appliance" subtitle="Sign in to the administration interface">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          id="username"
          label="Username"
          autoComplete="username"
          autoFocus
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && (
          <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthCard>
  );
}