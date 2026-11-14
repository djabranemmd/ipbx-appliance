import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import Button from '../../components/Button';
import ErrorBanner from '../../components/ErrorBanner';
import Field from '../../components/Field';
import Modal from '../../components/Modal';
import { api, errorMessage } from '../../lib/api';
import { refreshPbxData } from '../../lib/queries';
import type { RangeItem } from '../../lib/types';

interface Props {
  range: RangeItem | null;
  onClose: () => void;
}

// creates a range, or edits one when "range" is given
export default function RangeFormModal({ range, onClose }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(range?.name ?? '');
  const [start, setStart] = useState(range ? String(range.rangeStart) : '');
  const [end, setEnd] = useState(range ? String(range.rangeEnd) : '');

  const save = useMutation({
    mutationFn: () => {
      const body = { name: name.trim(), rangeStart: Number(start), rangeEnd: Number(end) };
      return range ? api.patch(`/ranges/${range.id}`, body) : api.post('/ranges', body);
    },
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
    <Modal title={range ? 'Edit range' : 'New range'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          id="range-name"
          label="Name"
          placeholder="Administration"
          autoFocus
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            id="range-start"
            label="First number"
            type="number"
            min={100}
            max={999999}
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
          <Field
            id="range-end"
            label="Last number"
            type="number"
            min={100}
            max={999999}
            required
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>
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