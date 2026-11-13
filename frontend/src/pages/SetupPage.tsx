import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { useSetupStatus } from '../auth/useSetupStatus';
import AuthCard from '../components/AuthCard';
import Field from '../components/Field';
import Spinner from '../components/Spinner';
import { errorMessage } from '../lib/api';

// first run only: creates the administrator account of a brand new appliance
export default function SetupPage() {
  const { admin, setup } = useAuth();
  const setupStatus = useSetupStatus();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (admin) return <Navigate to="/" replace />;
  if (setupStatus.isPending) return <Spinner fullPage />;
  // already configured: the setup page must not be reachable anymore
  if (setupStatus.data && !setupStatus.data.needsSetup) return <Navigate to="/login" replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('The two passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      await setup({ fullName: fullName.trim(), username: username.trim(), password });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard title="Welcome" subtitle="Create the administrator account of this appliance">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          id="fullName"
          label="Full name"
          autoFocus
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <Field
          id="username"
          label="Username"
          autoComplete="username"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <Field
          id="password"
          label="Password (8 characters minimum)"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Field
          id="confirm"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
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
          {submitting ? 'Creating…' : 'Create account'}
        </button>
      </form>
    </AuthCard>
  );
}