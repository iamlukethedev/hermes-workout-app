type Props = {
  title: string;
  body: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmModal({
  title,
  body,
  confirmLabel = 'Remove',
  onCancel,
  onConfirm,
}: Props) {
  return (
    <div className="modal-overlay">
      <section className="modal small-modal" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        <p>{body}</p>
        <div className="two-fields">
          <button className="secondary" onClick={onCancel}>
            Keep it
          </button>
          <button className="primary" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
