import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import Button from '../../components/Button';
import ErrorBanner from '../../components/ErrorBanner';
import Modal from '../../components/Modal';
import SelectField from '../../components/SelectField';
import { api, errorMessage } from '../../lib/api';
import { refreshPbxData } from '../../lib/queries';
import type { RangeItem } from '../../lib/types';

interface Props {
  ranges: RangeItem[];
  onClose: () => void;
}

const label = (range: RangeItem) => `${range.name} (${range.rangeStart}-${range.rangeEnd})`;

export default function RestrictionFormModal({ ranges, onClose }: Props) {
  const queryClient = useQueryClient();
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');

  const save = useMutation({
    mutationFn: () => api.post('/restrictions', { fromRangeId: Number(fromId), toRangeId: Number(toId) }),
    onSuccess: async () => {
      await refreshPbxData(queryClient);
      onClose();
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  return (
    <Modal title="New call restriction" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <SelectField id="restriction-from" label="Extensions of this range" required value={fromId} onChange={(e) => setFromId(e.target.value)}>
          <option value="">Choose a range</option>
          {ranges.map((range) => (
            <option key={range.id} value={range.id}>
              {label(range)}
            </option>
          ))}
        </SelectField>
        <SelectField id="restriction-to" label="Cannot call extensions of this range" required value={toId} onChange={(e) => setToId(e.target.value)}>
          <option value="">Choose a range</option>
          {ranges.map((range) => (
            <option key={range.id} value={range.id}>
              {label(range)}
            </option>
          ))}
        </SelectField>
        <p className="text-xs text-slate-500">The rule works in one direction only, and also stops calls that would reach the range through a forward.</p>
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