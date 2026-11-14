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
import type { RangeItem } from '../../lib/types';
import RangeFormModal from './RangeFormModal';

export default function RangesPage() {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const canWrite = hasRole('admin');

  const ranges = useQuery({
    queryKey: ['ranges'],
    queryFn: () => api.get<{ items: RangeItem[] }>('/ranges'),
  });

  // null = closed, 'new' = creation, a range = edition
  const [editing, setEditing] = useState<RangeItem | 'new' | null>(null);
  const [deleting, setDeleting] = useState<RangeItem | null>(null);

  const remove = useMutation({
    mutationFn: (range: RangeItem) => api.delete(`/ranges/${range.id}`),
    onSuccess: async () => {
      await refreshPbxData(queryClient);
      setDeleting(null);
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Numbering plan"
        hint="Every extension number must belong to one of these ranges (3 to 6 digits)."
        action={canWrite && <Button onClick={() => setEditing('new')}>New range</Button>}
      />

      <ErrorBanner message={ranges.error ? errorMessage(ranges.error) : null} />
      {ranges.isPending && <Spinner />}

      {ranges.data && (
        <section className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          {ranges.data.items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">
              No range yet. {canWrite ? 'Create one before adding extensions.' : 'An administrator must create one.'}
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">From</th>
                  <th className="px-4 py-2 font-medium">To</th>
                  <th className="px-4 py-2 font-medium">Extensions in use</th>
                  {canWrite && <th className="px-4 py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ranges.data.items.map((range) => (
                  <tr key={range.id}>
                    <td className="px-4 py-2 font-medium text-slate-900">{range.name}</td>
                    <td className="px-4 py-2">{range.rangeStart}</td>
                    <td className="px-4 py-2">{range.rangeEnd}</td>
                    <td className="px-4 py-2">{range.extensionCount}</td>
                    {canWrite && (
                      <td className="space-x-2 px-4 py-2 text-right">
                        <Button small variant="secondary" onClick={() => setEditing(range)}>
                          Edit
                        </Button>
                        <Button small variant="secondary" onClick={() => setDeleting(range)}>
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

      {editing && <RangeFormModal range={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}

      {deleting && (
        <ConfirmModal
          title="Delete range"
          message={`Delete the range "${deleting.name}" (${deleting.rangeStart} to ${deleting.rangeEnd})?`}
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