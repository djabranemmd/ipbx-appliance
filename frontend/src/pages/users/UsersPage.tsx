import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import Button from '../../components/Button';
import ConfirmModal from '../../components/ConfirmModal';
import ErrorBanner from '../../components/ErrorBanner';
import PageHeader from '../../components/PageHeader';
import Spinner from '../../components/Spinner';
import { api, errorMessage } from '../../lib/api';
import { refreshPbxData } from '../../lib/queries';
import type { UserItem } from '../../lib/types';
import UserFormModal from './UserFormModal';

export default function UsersPage() {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const canWrite = hasRole('admin', 'operator');

  const users = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<{ items: UserItem[] }>('/users'),
  });

  const [editing, setEditing] = useState<UserItem | 'new' | null>(null);
  const [deleting, setDeleting] = useState<UserItem | null>(null);
  const [search, setSearch] = useState('');

  const remove = useMutation({
    mutationFn: (user: UserItem) => api.delete(`/users/${user.id}`),
    onSuccess: async () => {
      await refreshPbxData(queryClient);
      setDeleting(null);
    },
  });

  const term = search.trim().toLowerCase();
  const visible = (users.data?.items ?? []).filter((user) =>
    `${user.firstName} ${user.lastName} ${user.email ?? ''}`.toLowerCase().includes(term),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        hint="The people who use the phones. A user is linked to an extension from the Extensions page."
        action={canWrite && <Button onClick={() => setEditing('new')}>New user</Button>}
      />

      <input
        aria-label="Search users"
        placeholder="Search by name or email"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
      />

      <ErrorBanner message={users.error ? errorMessage(users.error) : null} />
      {users.isPending && <Spinner />}

      {users.data && (
        <section className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          {visible.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">
              {users.data.items.length === 0 ? 'No user yet.' : 'No user matches this search.'}
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Extension</th>
                  {canWrite && <th className="px-4 py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-2 font-medium text-slate-900">
                      {user.firstName} {user.lastName}
                    </td>
                    <td className="px-4 py-2 text-slate-500">{user.email ?? '—'}</td>
                    <td className="px-4 py-2">{user.extensionNumber ?? '—'}</td>
                    {canWrite && (
                      <td className="space-x-2 px-4 py-2 text-right">
                        <Button small variant="secondary" onClick={() => setEditing(user)}>
                          Edit
                        </Button>
                        <Button small variant="secondary" onClick={() => setDeleting(user)}>
                          Delete
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {editing && <UserFormModal user={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}

      {deleting && (
        <ConfirmModal
          title="Delete user"
          message={
            deleting.extensionNumber
              ? `Delete ${deleting.firstName} ${deleting.lastName}? Extension ${deleting.extensionNumber} is kept and becomes unassigned.`
              : `Delete ${deleting.firstName} ${deleting.lastName}?`
          }
          confirmLabel="Delete"
          busy={remove.isPending}
          error={remove.error ? errorMessage(remove.error) : null}
          onConfirm={() => remove.mutate(deleting)}
          onCancel={() => {
            remove.reset();
            setDeleting(null);
          }}
        />
      )}
    </div>
  );
}