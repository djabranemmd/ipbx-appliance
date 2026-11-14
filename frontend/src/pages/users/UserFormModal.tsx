import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import Button from '../../components/Button';
import ErrorBanner from '../../components/ErrorBanner';
import Field from '../../components/Field';
import Modal from '../../components/Modal';
import { api, errorMessage } from '../../lib/api';
import { refreshPbxData } from '../../lib/queries';
import type { UserItem } from '../../lib/types';

interface Props {
  user: UserItem | null;
  onClose: () => void;
}

// creates a user, or edits one when "user" is given
export default function UserFormModal({ user, onClose }: Props) {
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');

  const save = useMutation({
    mutationFn: () => {
      // an empty email field means "no email"
      const body = { firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() || null };
      return user ? api.patch(`/users/${user.id}`, body) : api.post('/users', body);
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
    <Modal title={user ? 'Edit user' : 'New user'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field
            id="user-first-name"
            label="First name"
            autoFocus
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <Field
            id="user-last-name"
            label="Last name"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
        <Field
          id="user-email"
          label="Email (optional)"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
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