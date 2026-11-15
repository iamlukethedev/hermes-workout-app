import { Check, ChevronRight, Play } from 'lucide-react';
import {
  exercises,
  workouts,
  setCount,
  MAX_KG,
  type Exercise,
  type Session,
} from '../lib/training';

export type UpdateSet = (
  id: string,
  index: number,
  field: 'kg' | 'reps' | 'done',
  value: number | boolean,
) => void;

type Props = {
  type: 'A' | 'B';
  training?: boolean;
  draft: Session | null | undefined;
  planWeek: number;
  onOpenExercise: (exercise: Exercise) => void;
  onUpdateSet: UpdateSet;
};

export default function ExerciseList({
  type,
  training = false,
  draft,
  planWeek,
  onOpenExercise,
  onUpdateSet,
}: Props) {
  return (
    <div className="exercise-list">
      {workouts[type].map((id, i) => {
        const ex = exercises.find((e) => e.id === id)!;
        const count = training && draft ? draft.sets[id].length : setCount(planWeek, i);
        const done = training && draft?.sets[id].every((x) => x.done);
        return (
          <div className={'exercise-row ' + (done ? 'completed' : '')} key={id}>
            <button className="exercise-top" onClick={() => onOpenExercise(ex)}>
              <span className="exercise-number">
                {done ? <Check size={18} /> : String(i + 1).padStart(2, '0')}
              </span>
              <div className="exercise-name">
                <strong>{ex.name}</strong>
                <span>
                  {ex.group} <b>·</b> {count} {count === 1 ? 'set' : 'sets'} × {ex.range.join('–')}{' '}
                  {ex.side ? 'each side' : ''}
                </span>
              </div>
              <span className="demo-badge">
                <Play size={12} /> 3D
              </span>
              <ChevronRight size={18} />
            </button>
            {training && draft && (
              <div className="set-log">
                <div className="set-labels">
                  <span>SET</span>
                  <span>{ex.weighted ? 'KG / DUMBBELL' : 'BODY WEIGHT'}</span>
                  <span>REPS {ex.side ? '/ SIDE' : ''}</span>
                  <span>LOG</span>
                </div>
                {draft.sets[id].map((s, j) => (
                  <div className="set-line" key={j}>
                    <span>{j + 1}</span>
                    {ex.weighted ? (
                      <input
                        aria-label={`${ex.name} set ${j + 1} weight`}
                        type="number"
                        inputMode="decimal"
                        min="0"
                        max={MAX_KG}
                        step="0.5"
                        value={s.kg}
                        onChange={(e) =>
                          onUpdateSet(
                            id,
                            j,
                            'kg',
                            Math.max(0, Math.min(MAX_KG, Number(e.target.value))),
                          )
                        }
                      />
                    ) : (
                      <span className="bodyweight">BW</span>
                    )}
                    <input
                      aria-label={`${ex.name} set ${j + 1} reps`}
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="100"
                      value={s.reps}
                      onChange={(e) =>
                        onUpdateSet(
                          id,
                          j,
                          'reps',
                          Math.max(0, Math.min(100, Math.floor(Number(e.target.value)))),
                        )
                      }
                    />
                    <button
                      className={'check-set ' + (s.done ? 'checked' : '')}
                      aria-label={`${s.done ? 'Unmark' : 'Complete'} ${ex.name} set ${j + 1}`}
                      disabled={!s.reps || (ex.weighted && !s.kg)}
                      onClick={() => onUpdateSet(id, j, 'done', !s.done)}
                    >
                      <Check size={19} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
