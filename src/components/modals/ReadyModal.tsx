import { ArrowRight, X } from 'lucide-react';
import { addDays, type Session } from '../../lib/training';
import { workoutById, type Plan } from '../../lib/plan';

/** Discomfort score at which the app suggests a walk instead of strength work. */
export const STOP_SCORE = 4;

type Props = {
  plan: Plan;
  type: string;
  sessions: Session[];
  day: string;
  week: number;
  sleep: number;
  onSleepChange: (hours: number) => void;
  back: number;
  onBackChange: (score: number) => void;
  trainingWeek: number;
  onTrainingWeekChange: (week: number) => void;
  warm: boolean[];
  onWarmChange: (warm: boolean[]) => void;
  onBegin: () => void;
  onClose: () => void;
};

export default function ReadyModal({
  plan,
  type,
  sessions,
  day,
  week,
  sleep,
  onSleepChange,
  back,
  onBackChange,
  trainingWeek,
  onTrainingWeekChange,
  warm,
  onWarmChange,
  onBegin,
  onClose,
}: Props) {
  const warmup = plan.warmup;
  const label = plan.checkInLabel;
  const backToBack = plan.days.some((d) => plan.days.includes((d + 1) % 7));
  const trainedRecently = sessions.some(
    (s) => s.date <= day && s.date >= addDays(day, -1) && s.date !== day,
  );
  const workout = workoutById(plan, type);
  return (
    <div className="modal-overlay">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Prepare for your workout"
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">{(workout?.name ?? `Workout ${type}`).toUpperCase()}</span>
            <h2>Start with a check-in.</h2>
          </div>
          <button className="icon-button" aria-label="Close check-in" onClick={onClose}>
            <X />
          </button>
        </div>
        <p>Protect your sleep. Move comfortably. Today is about showing up.</p>
        {trainedRecently && !backToBack && (
          <div className="notice">
            You trained yesterday. Your plan keeps a rest day between strength sessions, so a walk
            is a good choice today.
          </div>
        )}
        <div className="two-fields">
          <label>
            Hours of sleep
            <input
              type="number"
              min="0"
              max="24"
              step="0.5"
              value={sleep}
              onChange={(e) => onSleepChange(Math.max(0, Math.min(24, Number(e.target.value))))}
            />
          </label>
          <label>
            {label} now · 0–10 discomfort
            <select value={back} onChange={(e) => onBackChange(Number(e.target.value))}>
              {Array.from({ length: 11 }, (_, i) => (
                <option key={i} value={i}>
                  {i}
                  {i === 0 ? ' · None' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
        {sleep < 7 && (
          <div className="notice">
            Short night? Consider a walk or a shorter session today. Do not trade sleep for
            training.
          </div>
        )}
        {back >= STOP_SCORE ? (
          <div className="notice">
            That is more discomfort than this plan is designed for. Choose comfortable walking today
            and get advice if it persists or keeps coming back.
          </div>
        ) : (
          back > 0 && (
            <div className="notice">
              Keep today easy: use lighter weights, a smaller range, and stop any movement that
              makes it worse.
            </div>
          )
        )}
        <label className="session-week">
          Training level for this session
          <select
            value={trainingWeek}
            onChange={(e) => onTrainingWeekChange(Number(e.target.value))}
          >
            {Array.from({ length: week }, (_, i) => (
              <option key={i} value={i + 1}>
                Week {i + 1}
                {i === 0 ? ' · lightest' : i + 1 === week ? ' · this week' : ''}
              </option>
            ))}
          </select>
          <span className="small muted">
            Repeat an easier week whenever you need to. Progress only when recovery is comfortable.
          </span>
        </label>
        {warmup.length > 0 && (
          <div className="warmup">
            <h3>Your warm-up</h3>
            {warmup.map((s, i) => (
              <label key={s}>
                <input
                  type="checkbox"
                  checked={!!warm[i]}
                  onChange={(e) =>
                    onWarmChange(warm.map((v, j) => (j === i ? e.target.checked : v)))
                  }
                />
                <span>{s}</span>
              </label>
            ))}
          </div>
        )}
        <button
          className="primary wide"
          disabled={back >= STOP_SCORE || !warm.every(Boolean)}
          onClick={onBegin}
        >
          {warmup.length ? 'Warm-up done. Let’s begin.' : 'Let’s begin.'} <ArrowRight size={18} />
        </button>
        <p className="small muted">
          {trainingWeek === 1
            ? 'Start with one light set. Keep 3–4 good repetitions in reserve.'
            : 'Keep 2–3 good repetitions in reserve. The rest timer starts after each set.'}
        </p>
      </section>
    </div>
  );
}
