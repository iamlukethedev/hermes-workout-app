import { ArrowRight, X } from 'lucide-react';
import type { Session } from '../../lib/training';

const warmup = [
  'Walk or march gently for 3 minutes',
  '8 comfortable sit-to-stands',
  '8 gentle wall push-ups',
  '10 supported calf raises',
  'Practise your first exercise with no weight',
];

type Props = {
  type: 'A' | 'B';
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
            <span className="eyebrow">WORKOUT {type}</span>
            <h2>Start with a check-in.</h2>
          </div>
          <button className="icon-button" aria-label="Close check-in" onClick={onClose}>
            <X />
          </button>
        </div>
        <p>Protect your sleep. Move comfortably. Today is about showing up.</p>
        {sessions.some((s) => Date.parse(day) - Date.parse(s.date) < 172800000) && (
          <div className="notice">
            You trained within the last two days. Keep a full rest day between strength sessions. A
            walk is a good choice today.
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
            Back pain now · 0–10
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
        {back > 0 && (
          <div className="notice">
            Choose comfortable walking today and get advice if symptoms persist or recur. This
            starting plan is for days without back pain.
          </div>
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
                {i === 0 ? ' · 1 set' : i < 4 ? ' · 2 sets' : ' · up to 3 sets'}
              </option>
            ))}
          </select>
          <span className="small muted">
            Repeat an easier week whenever you need to. Progress only when recovery is comfortable.
          </span>
        </label>
        <div className="warmup">
          <h3>Your 7-minute warm-up</h3>
          {warmup.map((s, i) => (
            <label key={s}>
              <input
                type="checkbox"
                checked={warm[i]}
                onChange={(e) => onWarmChange(warm.map((v, j) => (j === i ? e.target.checked : v)))}
              />
              <span>{s}</span>
            </label>
          ))}
        </div>
        <button
          className="primary wide"
          disabled={back > 0 || !warm.every(Boolean)}
          onClick={onBegin}
        >
          Warm-up done. Let’s begin. <ArrowRight size={18} />
        </button>
        <p className="small muted">
          {trainingWeek === 1
            ? 'Start with one light set. Keep 3–4 good repetitions in reserve.'
            : 'Keep 2–3 good repetitions in reserve. Rest 90 seconds between sets.'}
        </p>
      </section>
    </div>
  );
}
