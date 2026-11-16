import {
  Activity,
  ArrowRight,
  Check,
  Clock,
  Dumbbell,
  Footprints,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { addDays, weekday, labelDate, type Session, type State } from '../../lib/training';
import {
  planWeek as weekOfPlan,
  workoutById,
  workoutExercises,
  workoutOn,
  type Plan,
  type PlanExercise,
} from '../../lib/plan';
import { uid } from '../../lib/export';
import ExerciseList, { type UpdateSet } from '../ExerciseList';
import LazyMovementDemo from '../LazyMovementDemo';

type Props = {
  plan: Plan;
  data: State;
  save: (state: State) => void;
  day: string;
  now: number;
  planWeek: number;
  draft: Session | null | undefined;
  doneSets: number;
  totalSets: number;
  walkMinutes: number;
  onWalkMinutesChange: (minutes: number) => void;
  modalOpen: boolean;
  onOpenPlan: (week: number) => void;
  onStartWorkout: (type: string) => void;
  onOpenExercise: (exercise: PlanExercise) => void;
  onUpdateSet: UpdateSet;
  onDiscard: () => void;
  onFinish: () => void;
  onOpenSettings: () => void;
  onToast: (message: string) => void;
};

export default function TodayTab({
  plan,
  data: d,
  save,
  day,
  now,
  planWeek,
  draft,
  doneSets,
  totalSets,
  walkMinutes,
  onWalkMinutesChange,
  modalOpen,
  onOpenPlan,
  onStartWorkout,
  onOpenExercise,
  onUpdateSet,
  onDiscard,
  onFinish,
  onOpenSettings,
  onToast,
}: Props) {
  const monday = addDays(day, -((weekday(day) + 6) % 7));
  const thisWeek = d.sessions.filter((s) => s.date >= monday && s.date < addDays(monday, 7));
  let nextDate = day;
  for (let i = 0; i < 60; i++) {
    if (workoutOn(plan, d.startDate, nextDate) && !d.sessions.some((s) => s.date === nextDate))
      break;
    nextDate = addDays(nextDate, 1);
  }
  const nextType = workoutOn(plan, d.startDate, nextDate);
  const currentType = nextType || plan.workouts[0].id;
  const current = workoutById(plan, currentType) ?? plan.workouts[0];
  const currentExercises = workoutExercises(plan, current);
  const heroDemo = currentExercises.find((e) => e.demo);
  const perWeek = plan.days.length;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</div>
          <h1>Stronger for real life.</h1>
          <p>A little more energy. A little more strength. More of you for the things you love.</p>
        </div>
        <div className="date-pill">{labelDate(day)}</div>
      </div>
      <div className="week-strip">
        {Array.from({ length: 7 }, (_, i) => {
          const date = addDays(monday, i),
            type = workoutOn(plan, d.startDate, date),
            completed = d.sessions.some((s) => s.date === date);
          return (
            <button
              key={date}
              className={(date === day ? 'current ' : '') + (completed ? 'done' : '')}
              onClick={() => {
                onOpenPlan(weekOfPlan(plan, d.startDate, date));
              }}
            >
              <span>{['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'][i]}</span>
              <strong>{new Date(date + 'T12:00Z').getUTCDate()}</strong>
              <span className="day-activity">
                {completed ? (
                  <Check size={14} />
                ) : type ? (
                  <Dumbbell size={14} />
                ) : (
                  <Footprints size={14} />
                )}
              </span>
            </button>
          );
        })}
      </div>
      {draft ? (
        <section className="active-workout">
          <div className="section-heading">
            <div>
              <div className="eyebrow">IN PROGRESS · WEEK {draft.week}</div>
              <h2>{workoutById(plan, draft.type)?.name ?? `Workout ${draft.type}`}</h2>
            </div>
            <span className="pill">
              <Clock size={14} />
              {Math.max(0, Math.floor((now - draft.startedAt) / 60000))} min
            </span>
          </div>
          <div className="progress-track">
            <div style={{ width: `${(doneSets / totalSets) * 100}%` }} />
          </div>
          <div className="between muted small">
            <span>
              {doneSets} of {totalSets} sets logged
            </span>
            <span>Leave {draft.week === 1 ? '3–4' : '2–3'} good reps in reserve</span>
          </div>
          <ExerciseList
            plan={plan}
            type={draft.type}
            training
            draft={draft}
            planWeek={planWeek}
            onOpenExercise={onOpenExercise}
            onUpdateSet={onUpdateSet}
          />
          <div className="workout-footer">
            <button className="text-button" onClick={onDiscard}>
              Discard session
            </button>
            <button className="primary" disabled={!doneSets} onClick={onFinish}>
              Finish session <Check size={18} />
            </button>
          </div>
        </section>
      ) : (
        <div className="dashboard-grid">
          <section className="hero">
            <div className="hero-copy">
              <span className="pill lime">
                {nextType
                  ? `WEEK ${weekOfPlan(plan, d.startDate, nextDate)} · ${nextDate === day ? 'TODAY' : labelDate(nextDate).toUpperCase()}`
                  : `${plan.weeks} WEEKS COMPLETE`}
              </span>
              <h2>
                {nextType ? (
                  <>
                    Your next
                    <br />
                    stronger day.
                  </>
                ) : (
                  <>
                    Look how far
                    <br />
                    you’ve come.
                  </>
                )}
              </h2>
              <p>
                {nextType
                  ? `${current.name} · ${current.focus}`
                  : 'Review your progress before starting another block.'}
              </p>
              <div className="hero-meta">
                <span>
                  <Clock size={16} />
                  {plan.minutes} min
                </span>
                <span>
                  <Dumbbell size={16} />
                  {currentExercises.length} movements
                </span>
              </div>
              <button className="primary" onClick={() => onStartWorkout(currentType)}>
                {nextType ? `Start ${current.name}` : `Repeat ${current.name}`}
                <ArrowRight size={19} />
              </button>
              <span className="hero-footnote">
                {nextType
                  ? 'Warm up first · leave spare reps · sleep comes first'
                  : 'Choose a comfortable effort and keep progressing gradually.'}
              </span>
            </div>
            <div className="hero-visual">
              {!modalOpen && <LazyMovementDemo exercise={heroDemo?.demo ?? 'march'} compact />}
              <button onClick={() => onOpenExercise(heroDemo ?? currentExercises[0])}>
                Explore the movement <ArrowRight size={14} />
              </button>
            </div>
          </section>
          <section className="week-card">
            <div className="eyebrow">SMALL WINS ADD UP</div>
            <div className="ring">
              <svg viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="51" />
                <circle
                  cx="60"
                  cy="60"
                  r="51"
                  style={{
                    strokeDasharray: `${(Math.min(perWeek, thisWeek.length) / perWeek) * 320} 320`,
                  }}
                />
              </svg>
              <div>
                <strong>
                  {thisWeek.length}
                  <small>/{perWeek}</small>
                </strong>
                <span>sessions this week</span>
              </div>
            </div>
            <h3>Show up for yourself.</h3>
            <p>
              Your goal is {perWeek} comfortable session{perWeek === 1 ? '' : 's'} this week.
              Recovery days count too.
            </p>
          </section>
        </div>
      )}
      <div className="bottom-grid">
        <section className="card walking-card">
          <div className="small-icon">
            <Footprints size={22} />
          </div>
          <div>
            <div className="eyebrow">KEEP MOVING</div>
            <h3>A walk counts, too.</h3>
            <p>Start with 15–20 minutes and build gradually.</p>
            <div className="walk-log">
              <label>
                <input
                  type="number"
                  aria-label="Walk minutes"
                  value={walkMinutes}
                  min="1"
                  max="300"
                  onChange={(e) =>
                    onWalkMinutesChange(Math.max(1, Math.min(300, Number(e.target.value))))
                  }
                />{' '}
                min
              </label>
              <button
                className="secondary"
                onClick={() => {
                  save({
                    ...d,
                    walks: [...d.walks, { id: uid(), date: day, minutes: walkMinutes }],
                  });
                  onToast(`${walkMinutes} minute walk saved`);
                }}
              >
                <Plus size={16} /> Log walk
              </button>
            </div>
            <span className="small muted">
              {d.walks.filter((w) => w.date === day).reduce((n, w) => n + w.minutes, 0)} minutes
              logged today
            </span>
          </div>
        </section>
        <section className="card reminder-card">
          <span className="eyebrow">YOUR DAILY FOUNDATION</span>
          <h3>
            Recovery is part
            <br /> of getting stronger.
          </h3>
          <div>
            <span>
              <Clock size={17} /> Aim for 7–9 hours of sleep
            </span>
            <span>
              <Activity size={17} /> Move for 2–3 minutes every 30 minutes
            </span>
            <span>
              <ShieldCheck size={17} /> Stop if pain is sharp or increasing
            </span>
          </div>
          <button className="text-button" onClick={() => onOpenSettings()}>
            Read your training guidelines <ArrowRight size={15} />
          </button>
        </section>
      </div>
      {d.sessions
        .filter((s) => s.date < day && s.backNext === undefined)
        .slice(-1)
        .map((s) => (
          <section className="card next-check" key={s.id}>
            <div>
              <strong>Next-morning check-in: {plan.checkInLabel.toLowerCase()}</strong>
              <p>
                Follow up on {workoutById(plan, s.type)?.name ?? `workout ${s.type}`} from{' '}
                {labelDate(s.date)}. 0 = no discomfort, 10 = severe.
              </p>
            </div>
            <select
              aria-label={`Next morning ${plan.checkInLabel.toLowerCase()} score`}
              defaultValue=""
              onChange={(e) => {
                save({
                  ...d,
                  sessions: d.sessions.map((x) =>
                    x.id === s.id ? { ...x, backNext: Number(e.target.value) } : x,
                  ),
                });
                onToast('Next morning check-in saved');
              }}
            >
              <option value="" disabled>
                Select score
              </option>
              {Array.from({ length: 11 }, (_, i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </section>
        ))}
    </>
  );
}
