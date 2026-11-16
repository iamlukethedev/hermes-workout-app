import { BookOpen, Check, ChevronRight, Play } from 'lucide-react';
import type { Session } from '../lib/training';
import {
  MAX_KG,
  setsFor,
  workoutById,
  workoutExercises,
  type Plan,
  type PlanExercise,
} from '../lib/plan';

export type UpdateSet = (
  id: string,
  index: number,
  field: 'kg' | 'reps' | 'done',
  value: number | boolean,
) => void;

type Props = {
  plan: Plan;
  type: string;
  training?: boolean;
  draft: Session | null | undefined;
  planWeek: number;
  onOpenExercise: (exercise: PlanExercise) => void;
  onUpdateSet: UpdateSet;
};

export default function ExerciseList({
  plan,
  type,
  training = false,
  draft,
  planWeek,
  onOpenExercise,
  onUpdateSet,
}: Props) {
  const workout = workoutById(plan, type) ?? plan.workouts[0];
  return (
    <div className="exercise-list">
      {workoutExercises(plan, workout).map((ex, i) => {
        const id = ex.id;
        const logged = training && draft ? draft.sets[id] : undefined;
        if (training && !logged) return null;
        const count = logged ? logged.length : setsFor(plan, planWeek, ex);
        const done = logged?.every((x) => x.done);
        return (
          <div className={'exercise-row ' + (done ? 'completed' : '')} key={id}>
            <button className="exercise-top" onClick={() => onOpenExercise(ex)}>
              <span className="exercise-number">
                {done ? <Check size={18} /> : String(i + 1).padStart(2, '0')}
              </span>
              <div className="exercise-name">
                <strong>{ex.name}</strong>
                <span>
                  {ex.group} <b>·</b> {count} {count === 1 ? 'set' : 'sets'} ×{' '}
                  {ex.reps[0] === ex.reps[1] ? ex.reps[0] : ex.reps.join('–')}{' '}
                  {ex.perSide ? 'each side' : ''}
                </span>
              </div>
              <span className="demo-badge">
                {ex.demo ? (
                  <>
                    <Play size={12} /> 3D
                  </>
                ) : (
                  <>
                    <BookOpen size={12} /> Guide
                  </>
                )}
              </span>
              <ChevronRight size={18} />
            </button>
            {logged && (
              <div className="set-log">
                <div className="set-labels">
                  <span>SET</span>
                  <span>{ex.weighted ? 'KG' : 'BODY WEIGHT'}</span>
                  <span>REPS {ex.perSide ? '/ SIDE' : ''}</span>
                  <span>LOG</span>
                </div>
                {logged.map((s, j) => (
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
