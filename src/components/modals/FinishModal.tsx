import { Check, X } from 'lucide-react';

type Props = {
  checkInLabel: string;
  doneSets: number;
  totalSets: number;
  after: number;
  onAfterChange: (score: number) => void;
  energy: number;
  onEnergyChange: (energy: number) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  onComplete: () => void;
  onClose: () => void;
};

export default function FinishModal({
  checkInLabel,
  doneSets,
  totalSets,
  after,
  onAfterChange,
  energy,
  onEnergyChange,
  notes,
  onNotesChange,
  onComplete,
  onClose,
}: Props) {
  return (
    <div className="modal-overlay">
      <section className="modal" role="dialog" aria-modal="true" aria-label="Finish session">
        <div className="modal-heading">
          <h2>You showed up.</h2>
          <button className="icon-button" aria-label="Close finish session" onClick={onClose}>
            <X />
          </button>
        </div>
        <p>
          {doneSets} of {totalSets} sets logged.{' '}
          {doneSets < totalSets
            ? 'Unfinished sets will stay marked as not completed.'
            : 'Take a moment to check how you feel.'}
        </p>
        <div className="two-fields">
          <label>
            {checkInLabel} after · 0–10 discomfort
            <select value={after} onChange={(e) => onAfterChange(Number(e.target.value))}>
              {Array.from({ length: 11 }, (_, i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </label>
          <label>
            Energy · 1 low, 5 high
            <select value={energy} onChange={(e) => onEnergyChange(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((i) => (
                <option key={i}>{i}</option>
              ))}
            </select>
          </label>
        </div>
        {after > 0 && (
          <div className="notice">
            Noted. If discomfort is higher than before the session, reduce the next one and seek
            advice if it persists or recurs. Avoid movements that make it worse.
          </div>
        )}
        <label>
          Session notes
          <textarea
            placeholder="How did the weights feel? Any movements to adjust?"
            maxLength={2000}
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
          />
        </label>
        <button className="primary wide" onClick={onComplete}>
          Save session <Check size={18} />
        </button>
      </section>
    </div>
  );
}
