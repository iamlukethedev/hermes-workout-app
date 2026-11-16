import { BookOpen, Info, X } from 'lucide-react';
import type { PlanExercise } from '../../lib/plan';
import LazyMovementDemo from '../LazyMovementDemo';

type Props = { exercise: PlanExercise; onClose: () => void };

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
        {exercise.demo ? (
          <LazyMovementDemo key={exercise.id} exercise={exercise.demo} />
        ) : (
          <div className="no-demo">
            <BookOpen size={28} />
            <strong>Step-by-step guide</strong>
            <span>There is no 3D demo for this exercise yet. Follow the steps below.</span>
          </div>
        )}
        <div className="exercise-facts">
          <span>
            <b>
              {exercise.sets.start === exercise.sets.max
                ? exercise.sets.start
                : `${exercise.sets.start}–${exercise.sets.max}`}
            </b>{' '}
            sets
          </span>
          <span>
            <b>
              {exercise.reps[0] === exercise.reps[1] ? exercise.reps[0] : exercise.reps.join('–')}
            </b>{' '}
            reps{exercise.perSide ? ' each side' : ''}
          </span>
          <span>
            <b>{exercise.restSec}s</b> rest
          </span>
          <span>{exercise.equipment}</span>
        </div>
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
