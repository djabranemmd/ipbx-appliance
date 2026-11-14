import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import Button from '../../components/Button';
import ErrorBanner from '../../components/ErrorBanner';
import Modal from '../../components/Modal';
import Spinner from '../../components/Spinner';
import { api, errorMessage } from '../../lib/api';
import { refreshPbxData } from '../../lib/queries';
import type { ExtensionItem, PhoneCredentials } from '../../lib/types';

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard not available (insecure page): the value can still be selected by hand
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2">
      <div className="min-w-0">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="truncate font-mono text-sm text-slate-900">{value}</div>
      </div>
      <Button small variant="secondary" onClick={copy}>
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}

// the settings to type into a softphone or an IP phone
export default function PhoneSetupModal({ extension, onClose }: { extension: ExtensionItem; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [confirmingReset, setConfirmingReset] = useState(false);

  // gcTime 0: the password is not kept in memory once the dialog is closed
  const credentials = useQuery({
    queryKey: ['credentials', extension.id],
    queryFn: async () => (await api.get<{ credentials: PhoneCredentials }>(`/extensions/${extension.id}/credentials`)).credentials,
    gcTime: 0,
  });

  const reset = useMutation({
    mutationFn: () => api.post(`/extensions/${extension.id}/reset-password`),
    onSuccess: async () => {
      setConfirmingReset(false);
      await credentials.refetch();
      await refreshPbxData(queryClient);
    },
  });

  return (
    <Modal title={`Phone settings for ${extension.number}`} onClose={onClose}>
      <div className="space-y-4">
        {credentials.isPending && <Spinner />}
        <ErrorBanner message={credentials.error ? errorMessage(credentials.error) : null} />

        {credentials.data && (
          <>
            <p className="text-sm text-slate-600">
              Enter these settings in the phone. Choose <strong>UDP</strong> as transport.
            </p>
            <div className="space-y-2">
              <CopyRow label="Username" value={credentials.data.username} />
              <CopyRow label="Password" value={credentials.data.password} />
              <CopyRow label="Server (domain)" value={credentials.data.server ?? 'Not set: add PBX_EXTERNAL_IP to .env'} />
              <CopyRow label="Port" value={String(credentials.data.port)} />
              <CopyRow label="Transport" value={credentials.data.transport} />
            </div>

            <ErrorBanner message={reset.error ? errorMessage(reset.error) : null} />

            {confirmingReset ? (
              <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                <p>The phone currently registered on this extension is disconnected until you enter the new password.</p>
                <div className="mt-3 flex gap-2">
                  <Button small variant="danger" onClick={() => reset.mutate()} disabled={reset.isPending}>
                    {reset.isPending ? 'Please wait…' : 'Generate a new password'}
                  </Button>
                  <Button small variant="secondary" onClick={() => setConfirmingReset(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="secondary" onClick={() => setConfirmingReset(true)}>
                New password…
              </Button>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}