import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import Button from '../../components/Button';
import ErrorBanner from '../../components/ErrorBanner';
import Field from '../../components/Field';
import Modal from '../../components/Modal';
import SelectField from '../../components/SelectField';
import { api, errorMessage } from '../../lib/api';
import { refreshPbxData } from '../../lib/queries';
import type { CallPermission, ExtensionItem, UserItem } from '../../lib/types';

interface Props {
  extension: ExtensionItem | null;
  onClose: () => void;
  // called after a creation, the page then shows the phone settings of the new extension
  onCreated: (extension: ExtensionItem) => void;
}

function ForwardSelect({
  id,
  label,
  value,
  onChange,
  targets,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  targets: ExtensionItem[];
}) {
  return (
    <SelectField id={id} label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">No forwarding</option>
      {targets.map((target) => (
        <option key={target.id} value={target.number}>
          {target.number} {target.displayName}
        </option>
      ))}
    </SelectField>
  );
}

// creates an extension, or edits one when "extension" is given
export default function ExtensionFormModal({ extension, onClose, onCreated }: Props) {
  const queryClient = useQueryClient();
  const users = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<{ items: UserItem[] }>('/users'),
  });

  const [number, setNumber] = useState(extension?.number ?? '');
  const [displayName, setDisplayName] = useState(extension?.displayName ?? '');
  const [userId, setUserId] = useState(extension?.user ? String(extension.user.id) : '');
  const [callPermission, setCallPermission] = useState<CallPermission>(extension?.callPermission ?? 'internal');
  const [enabled, setEnabled] = useState(extension?.enabled ?? true);
  // forwarding is set when editing: '' means "no forwarding"
  const [forwardAlways, setForwardAlways] = useState(extension?.forwarding.always ?? '');
  const [forwardBusy, setForwardBusy] = useState(extension?.forwarding.busy ?? '');
  const [forwardNoAnswer, setForwardNoAnswer] = useState(extension?.forwarding.noAnswer ?? '');
  const [ringTimeout, setRingTimeout] = useState(String(extension?.forwarding.ringTimeout ?? 20));

  // the other extensions a call can be forwarded to
  const allExtensions = useQuery({
    queryKey: ['extensions'],
    queryFn: () => api.get<{ items: ExtensionItem[] }>('/extensions'),
  });
  const targets = (allExtensions.data?.items ?? []).filter((item) => item.number !== extension?.number);

  // a user can hold one extension only: the ones already taken are not offered
  const freeUsers = (users.data?.items ?? []).filter(
    (user) => user.extensionId === null || user.id === extension?.user?.id,
  );

  const save = useMutation({
    mutationFn: () => {
      const name = displayName.trim();
      const owner = userId === '' ? null : Number(userId);

      if (extension) {
        return api.patch<{ extension: ExtensionItem }>(`/extensions/${extension.id}`, {
          ...(name ? { displayName: name } : {}),
          userId: owner,
          callPermission,
          enabled,
          forwardAlways: forwardAlways || null,
          forwardBusy: forwardBusy || null,
          forwardNoAnswer: forwardNoAnswer || null,
          ringTimeout: Number(ringTimeout),
        });
      }
      // without a name the server uses the name of the user, or "Extension <number>"
      return api.post<{ extension: ExtensionItem }>('/extensions', {
        number: number.trim(),
        ...(name ? { displayName: name } : {}),
        userId: owner,
        callPermission,
        enabled,
      });
    },
    onSuccess: async (data) => {
      await refreshPbxData(queryClient);
      if (extension) {
        onClose();
      } else {
        onCreated(data.extension);
      }
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  return (
    <Modal title={extension ? `Edit extension ${extension.number}` : 'New extension'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          id="ext-number"
          label="Number (3 to 6 digits)"
          inputMode="numeric"
          pattern="[1-9][0-9]{2,5}"
          autoFocus={!extension}
          required
          disabled={extension !== null}
          value={number}
          onChange={(e) => setNumber(e.target.value)}
        />
        <Field
          id="ext-name"
          label="Display name"
          placeholder={extension ? '' : 'Optional, defaults to the name of the user'}
          maxLength={60}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <SelectField id="ext-user" label="User" value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">No user</option>
          {freeUsers.map((user) => (
            <option key={user.id} value={user.id}>
              {user.firstName} {user.lastName}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="ext-permission"
          label="Calls allowed"
          value={callPermission}
          onChange={(e) => setCallPermission(e.target.value as CallPermission)}
        >
          <option value="internal">Internal only</option>
          <option value="external">Internal and external</option>
        </SelectField>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enabled (a disabled extension cannot register or call)
        </label>

        {extension && (
          <fieldset className="space-y-3 rounded-md border border-slate-200 p-3">
            <legend className="px-1 text-sm font-medium text-slate-700">Call forwarding</legend>
            <ForwardSelect id="ext-fwd-always" label="Forward all calls to" value={forwardAlways} onChange={setForwardAlways} targets={targets} />
            <ForwardSelect id="ext-fwd-busy" label="If busy, forward to" value={forwardBusy} onChange={setForwardBusy} targets={targets} />
            <ForwardSelect
              id="ext-fwd-noanswer"
              label="If no answer, forward to"
              value={forwardNoAnswer}
              onChange={setForwardNoAnswer}
              targets={targets}
            />
            <Field
              id="ext-ring-timeout"
              label="Ring time before 'no answer' (seconds)"
              type="number"
              min={5}
              max={60}
              required
              value={ringTimeout}
              onChange={(e) => setRingTimeout(e.target.value)}
            />
            <p className="text-xs text-slate-500">Applies from the next call. A phone that is not registered counts as "no answer".</p>
          </fieldset>
        )}

        <ErrorBanner message={save.error ? errorMessage(save.error) : null} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}