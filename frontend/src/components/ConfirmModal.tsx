import type { ReactNode } from 'react';
import Button from './Button';
import ErrorBanner from './ErrorBanner';
import Modal from './Modal';

interface ConfirmModalProps {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  busy: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

// asks before anything destructive
export default function ConfirmModal({ title, message, confirmLabel, busy, error, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">{message}</p>
        <ErrorBanner message={error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'Please wait…' : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}