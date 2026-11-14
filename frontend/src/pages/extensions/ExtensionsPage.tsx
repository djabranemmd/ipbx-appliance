import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import ConfirmModal from '../../components/ConfirmModal';
import ErrorBanner from '../../components/ErrorBanner';
import PageHeader from '../../components/PageHeader';
import Spinner from '../../components/Spinner';
import { api, errorMessage } from '../../lib/api';
import { refreshPbxData } from '../../lib/queries';
import type { ExtensionItem } from '../../lib/types';
import ExtensionFormModal from './ExtensionFormModal';
import PhoneSetupModal from './PhoneSetupModal';

// "all calls to 103 · busy to 104", empty when nothing is forwarded
function forwardingSummary({ forwarding }: ExtensionItem): string {
  const parts = [];
  if (forwarding.always) parts.push(`all calls to ${forwarding.always}`);
  if (forwarding.busy) parts.push(`busy to ${forwarding.busy}`);
  if (forwarding.noAnswer) parts.push(`no answer (${forwarding.ringTimeout} s) to ${forwarding.noAnswer}`);
  return parts.join(' · ');
}

function ExtensionStatus({ extension }: { extension: ExtensionItem }) {
  if (!extension.enabled) return <Badge tone="slate">Disabled</Badge>;
  return extension.registration.registered ? <Badge tone="green">Registered</Badge> : <Badge tone="amber">Not registered</Badge>;
}

export default function ExtensionsPage() {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const canWrite = hasRole('admin', 'operator');

  // refreshed regularly so a phone that registers shows up by itself
  const extensions = useQuery({
    queryKey: ['extensions'],
    queryFn: () => api.get<{ items: ExtensionItem[] }>('/extensions'),
    refetchInterval: 5000,
  });

  const [editing, setEditing] = useState<ExtensionItem | 'new' | null>(null);
  const [settingsFor, setSettingsFor] = useState<ExtensionItem | null>(null);
  const [deleting, setDeleting] = useState<ExtensionItem | null>(null);
  const [search, setSearch] = useState('');

  const toggle = useMutation({
    mutationFn: (extension: ExtensionItem) => api.patch(`/extensions/${extension.id}`, { enabled: !extension.enabled }),
    onSuccess: () => refreshPbxData(queryClient),
  });

  const remove = useMutation({
    mutationFn: (extension: ExtensionItem) => api.delete(`/extensions/${extension.id}`),
    onSuccess: async () => {
      await refreshPbxData(queryClient);
      setDeleting(null);
    },
  });

  const term = search.trim().toLowerCase();
  const visible = (extensions.data?.items ?? []).filter((extension) => {
    const owner = extension.user ? `${extension.user.firstName} ${extension.user.lastName}` : '';
    return `${extension.number} ${extension.displayName} ${owner}`.toLowerCase().includes(term);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Extensions"
        hint="Every change is applied on the pbx at once."
        action={canWrite && <Button onClick={() => setEditing('new')}>New extension</Button>}
      />

      <input
        aria-label="Search extensions"
        placeholder="Search by number or name"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
      />

      <ErrorBanner message={extensions.error ? errorMessage(extensions.error) : null} />
      <ErrorBanner message={toggle.error ? errorMessage(toggle.error) : null} />
      {extensions.isPending && <Spinner />}

      {extensions.data && (
        <section className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          {visible.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">
              {extensions.data.items.length === 0 ? 'No extension yet.' : 'No extension matches this search.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Number</th>
                    <th className="px-4 py-2 font-medium">Name</th>
                    <th className="px-4 py-2 font-medium">User</th>
                    <th className="px-4 py-2 font-medium">Calls</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    {canWrite && <th className="px-4 py-2" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((extension) => (
                    <tr key={extension.id}>
                      <td className="px-4 py-2 font-medium text-slate-900">{extension.number}</td>
                      <td className="px-4 py-2">
                        {extension.displayName}
                        {forwardingSummary(extension) && (
                          <div className="text-xs text-slate-500">Forwards {forwardingSummary(extension)}</div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-slate-500">
                        {extension.user ? `${extension.user.firstName} ${extension.user.lastName}` : '—'}
                      </td>
                      <td className="px-4 py-2 text-slate-500">
                        {extension.callPermission === 'external' ? 'Internal + external' : 'Internal only'}
                      </td>
                      <td className="px-4 py-2">
                        <ExtensionStatus extension={extension} />
                      </td>
                      {canWrite && (
                        <td className="space-x-2 px-4 py-2 text-right whitespace-nowrap">
                          <Button small variant="secondary" onClick={() => setSettingsFor(extension)}>
                            Phone settings
                          </Button>
                          <Button small variant="secondary" onClick={() => setEditing(extension)}>
                            Edit
                          </Button>
                          <Button small variant="secondary" onClick={() => toggle.mutate(extension)} disabled={toggle.isPending}>
                            {extension.enabled ? 'Disable' : 'Enable'}
                          </Button>
                          <Button small variant="secondary" onClick={() => setDeleting(extension)}>
                            Delete
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {editing && (
        <ExtensionFormModal
          extension={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onCreated={(created) => {
            setEditing(null);
            setSettingsFor(created);
          }}
        />
      )}

      {settingsFor && <PhoneSetupModal extension={settingsFor} onClose={() => setSettingsFor(null)} />}

      {deleting && (
        <ConfirmModal
          title="Delete extension"
          message={`Delete extension ${deleting.number} (${deleting.displayName})? The phone registered on it stops working.`}
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