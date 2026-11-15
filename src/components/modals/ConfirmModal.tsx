type Props = { discard: boolean; onCancel: () => void; onConfirm: () => void };

export default function ConfirmModal({ discard, onCancel, onConfirm }: Props) {
  return (
    <div className="modal-overlay">
      <section
        className="modal small-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Confirm removal"
      >
        <h2>{discard ? 'Discard this session?' : 'Remove this entry?'}</h2>
        <p>This removes the entry from your log on this device.</p>
        <div className="two-fields">
          <button className="secondary" onClick={onCancel}>
            Keep it
          </button>
          <button className="primary" onClick={onConfirm}>
            Remove
          </button>
        </div>
      </section>
    </div>
  );
}
