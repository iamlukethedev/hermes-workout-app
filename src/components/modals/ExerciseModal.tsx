import { Info, X } from 'lucide-react';
import type { Exercise } from '../../lib/training';
import LazyMovementDemo from '../LazyMovementDemo';

type Props = { exercise: Exercise; onClose: () => void };

export default function ExerciseModal({ exercise, onClose }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <section
        className="modal movement-modal"
        role="dialog"
        aria-modal="true"
        aria-label={exercise.name}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">MOVEMENT LAB · {exercise.group}</span>
            <h2>{exercise.name}</h2>
          </div>
          <button autoFocus className="icon-button" aria-label="Close movement" onClick={onClose}>
            <X />
          </button>
        </div>
        <LazyMovementDemo key={exercise.id} exercise={exercise.id} />
        <div className="demo-instructions">
          <p className="movement-cue">{exercise.cue}</p>
          <ol>
            {exercise.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <div className="technique-note">
            <Info size={17} />
            <span>
              {exercise.avoid} {exercise.swap}
            </span>
          </div>
          <p className="small muted">
            Schematic guide, not a personalised technique assessment. Stop if pain appears or
            increases.
          </p>
        </div>
      </section>
    </div>
  );
}
