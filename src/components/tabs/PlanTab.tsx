import { ArrowRight, TrendingUp } from 'lucide-react';
import { addDays, labelDate, type Exercise, type Session, type State } from '../../lib/training';
import ExerciseList, { type UpdateSet } from '../ExerciseList';

type Props = {
  data: State;
  draft: Session | null | undefined;
  planWeek: number;
  onPlanWeekChange: (week: number) => void;
  onStartWorkout: (type: 'A' | 'B') => void;
  onOpenExercise: (exercise: Exercise) => void;
  onUpdateSet: UpdateSet;
};

export default function PlanTab({
  data: d,
  draft,
  planWeek,
  onPlanWeekChange,
  onStartWorkout,
  onOpenExercise,
  onUpdateSet,
}: Props) {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR EIGHT WEEK FOUNDATION</div>
          <h1>Simple. Steady. Stronger.</h1>
          <p>Three strength sessions. Room to recover. A plan that grows with you.</p>
        </div>
      </div>
      <div className="week-picker">
        {Array.from({ length: 8 }, (_, i) => (
          <button
            className={planWeek === i + 1 ? 'selected' : ''}
            onClick={() => onPlanWeekChange(i + 1)}
            key={i}
          >
            <span>WEEK</span>
            <strong>{i + 1}</strong>
          </button>
        ))}
      </div>
      <section className="plan-summary">
        <div>
          <span className="eyebrow">
            {labelDate(addDays(d.startDate, (planWeek - 1) * 7))} ONWARDS
          </span>
          <h2>
            {planWeek === 1
              ? 'Learn the movements.'
              : planWeek < 5
                ? 'Build your foundation.'
                : 'Grow at your own pace.'}
          </h2>
          <p>
            {planWeek === 1
              ? 'One light set of each exercise. Finish with 3–4 good repetitions still available.'
              : planWeek < 5
                ? 'Two sets per exercise if recovery is comfortable. Add repetitions before weight.'
                : 'Optionally add a third set to the first three exercises if recovery is good. Keep the other exercises at two sets.'}
          </p>
        </div>
        <div className="plan-days">
          <span>
            MON <b>{planWeek % 2 ? 'A' : 'B'}</b>
          </span>
          <span>
            WED <b>{planWeek % 2 ? 'B' : 'A'}</b>
          </span>
          <span>
            FRI <b>{planWeek % 2 ? 'A' : 'B'}</b>
          </span>
        </div>
      </section>
      <div className="two-columns">
        {(['A', 'B'] as const).map((type) => (
          <section className="card workout-plan" key={type}>
            <div className="section-heading">
              <div>
                <span className="eyebrow">FULL BODY</span>
                <h2>Workout {type}</h2>
              </div>
              <span className="workout-letter">{type}</span>
            </div>
            <ExerciseList
              type={type}
              draft={draft}
              planWeek={planWeek}
              onOpenExercise={onOpenExercise}
              onUpdateSet={onUpdateSet}
            />
            <button
              className="secondary wide"
              disabled={!!draft}
              onClick={() => onStartWorkout(type)}
            >
              Start workout {type}
              <ArrowRight size={17} />
            </button>
          </section>
        ))}
      </div>
      <section className="card progression">
        <TrendingUp />
        <div>
          <h3>Earn the next weight.</h3>
          <p>
            Reach the top of your rep range on every set for two sessions, with controlled movement,
            spare repetitions and no increase in back symptoms during or the next day. Then use the
            smallest weight increase. Never increase weight and sets in the same session.
          </p>
          <p>
            Calendar weeks are a guide, not a deadline. If recovery is difficult, repeat an earlier
            week. Keep at least one rest day between strength sessions.
          </p>
        </div>
      </section>
    </>
  );
}
