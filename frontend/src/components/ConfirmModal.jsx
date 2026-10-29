import Modal from './Modal.jsx';

export default function ConfirmModal({ title, message, confirmLabel = 'Confirm', onCancel, onConfirm }) {
  return (
    <Modal onClose={onCancel} labelledBy="confirm-modal-title">
      <h3 id="confirm-modal-title" className="font-display text-lg font-bold text-ink">
        {title}
      </h3>
      <p className="mt-2 text-sm text-ink-soft">{message}</p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 rounded-lg border border-hairline py-2 text-sm font-medium text-ink-soft transition-colors hover:border-ink-soft"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 rounded-lg bg-pepper py-2 text-sm font-semibold text-white transition-colors hover:bg-pepper-dark"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
