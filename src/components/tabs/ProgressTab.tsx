import {
  ArrowRight,
  ChevronRight,
  Check,
  Download,
  Dumbbell,
  Flame,
  Footprints,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { labelDate, type Session, type State } from '../../lib/training';
import { exerciseName, type Plan } from '../../lib/plan';

type Props = {
  plan: Plan;
  data: State;
  save: (state: State) => void;
  selectedProgress: string;
  onSelectedProgressChange: (id: string) => void;
  expanded: string | null;
  onExpandedChange: (id: string | null) => void;
  onExportCsv: () => void;
  onGoToday: () => void;
  onLoadSample: () => void;
  onRequestDelete: (id: string) => void;
};

export default function ProgressTab({
  plan,
  data: d,
  save,
  selectedProgress,
  onSelectedProgressChange,
  expanded,
  onExpandedChange,
  onExportCsv,
  onGoToday,
  onLoadSample,
  onRequestDelete,
}: Props) {
  // Weighted exercises from the current plan, plus anything weighted logged under earlier plans.
  const loggedWeighted = new Set(
    d.sessions.flatMap((s) =>
      Object.entries(s.sets)
        .filter(([, sets]) => sets.some((x) => x.done && x.kg > 0))
        .map(([id]) => id),
    ),
  );
  const options = [
    ...new Set([...plan.exercises.filter((e) => e.weighted).map((e) => e.id), ...loggedWeighted]),
  ];
  const selected = options.includes(selectedProgress) ? selectedProgress : (options[0] ?? '');
  const bestKg = (s: Session) =>
    Math.max(0, ...s.sets[selected].filter((x) => x.done).map((x) => x.kg));
  const chartSessions = d.sessions.filter((s) => s.sets[selected]?.some((x) => x.done)).slice(-10);
  // Scale bars to the heaviest logged set so any dumbbell range fits the chart.
  const chartMax = Math.max(1, ...chartSessions.map(bestKg));
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">PROGRESS YOU CAN FEEL</div>
          <h1>Every session adds up.</h1>
          <p>Your strength, your consistency, your energy. All in one place.</p>
        </div>
        <button className="secondary" onClick={onExportCsv}>
          <Download size={17} /> Export CSV
        </button>
      </div>
      <div className="stats-grid">
        <div className="stat">
          <Dumbbell />
          <strong>{d.sessions.length}</strong>
          <span>Sessions completed</span>
        </div>
        <div className="stat">
          <Check />
          <strong>
            {d.sessions.reduce(
              (n, s) =>
                n +
                Object.values(s.sets)
                  .flat()
                  .filter((x) => x.done).length,
              0,
            )}
          </strong>
          <span>Sets logged</span>
        </div>
        <div className="stat">
          <Footprints />
          <strong>
            {d.walks.reduce((n, w) => n + w.minutes, 0)}
            <small> min</small>
          </strong>
          <span>Time spent walking</span>
        </div>
        <div className="stat">
          <Flame />
          <strong>
            {d.sessions.length
              ? (d.sessions.reduce((n, s) => n + (s.energy || 3), 0) / d.sessions.length).toFixed(1)
              : '—'}
            <small> /5</small>
          </strong>
          <span>Average post-workout energy</span>
        </div>
      </div>
      <section className="card strength-chart">
        <div className="section-heading">
          <div>
            <span className="eyebrow">YOUR STRENGTH OVER TIME</span>
            <h3>Heaviest completed set</h3>
          </div>
          <select
            value={selected}
            aria-label="Progress exercise"
            onChange={(e) => onSelectedProgressChange(e.target.value)}
          >
            {options.map((id) => (
              <option value={id} key={id}>
                {exerciseName(plan, id)}
              </option>
            ))}
          </select>
        </div>
        {d.sessions.some((s) => s.sets[selected]?.some((x) => x.done)) ? (
          <div className="chart-bars">
            {chartSessions.map((s) => {
              const kg = bestKg(s);
              return (
                <div key={s.id}>
                  <span>{kg} kg</span>
                  <div style={{ height: Math.max(5, (kg / chartMax) * 140) }} />
                  <small>{s.date.slice(5)}</small>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-chart">
            <TrendingUp size={30} />
            <p>Your first session starts the story.</p>
            <span>Log a weighted set to see your progress here.</span>
          </div>
        )}
        <p className="small muted">
          Weight per dumbbell. Compare repetitions and comfort alongside weight.
        </p>
      </section>
      <div className="section-heading">
        <h2>Session history</h2>
        <span className="muted small">{d.sessions.length} sessions</span>
      </div>
      {!d.sessions.length ? (
        <section className="card empty-history">
          <div className="small-icon">
            <Dumbbell />
          </div>
          <h3>A fresh start looks good on you.</h3>
          <p>Your completed sessions and check-ins will appear here.</p>
          <div className="empty-actions">
            <button className="primary" onClick={() => onGoToday()}>
              Go to your first workout <ArrowRight size={17} />
            </button>
            <button className="secondary" onClick={onLoadSample}>
              <Sparkles size={16} /> Explore with sample data
            </button>
          </div>
        </section>
      ) : (
        <div className="history-list">
          {[...d.sessions].reverse().map((s) => (
            <section className="card history-item" key={s.id}>
              <button
                className="history-heading"
                onClick={() => onExpandedChange(expanded === s.id ? null : s.id)}
              >
                <span className="workout-letter">{s.type}</span>
                <div>
                  <strong>
                    {plan.workouts.find((w) => w.id === s.type)?.name ?? `Workout ${s.type}`}
                  </strong>
                  <span>
                    {labelDate(s.date)} · Week {s.week} ·{' '}
                    {
                      Object.values(s.sets)
                        .flat()
                        .filter((x) => x.done).length
                    }{' '}
                    sets
                  </span>
                </div>
                <span className="history-energy">Energy {s.energy ?? '–'}/5</span>
                <ChevronRight />
              </button>
              {expanded === s.id && (
                <div className="history-detail">
                  <p>
                    Sleep {s.sleep}h · Discomfort before {s.backBefore}/10 · After{' '}
                    {s.backAfter ?? '–'}/10 · Next morning {s.backNext ?? 'not logged'}
                  </p>
                  {Object.entries(s.sets).map(([id, sets]) => (
                    <p key={id}>
                      <strong>{exerciseName(plan, id)}</strong>
                      <span>
                        {sets
                          .filter((x) => x.done)
                          .map((x) => `${x.kg ? x.kg + ' kg × ' : ''}${x.reps} reps`)
                          .join(' · ') || 'Not completed'}
                      </span>
                    </p>
                  ))}
                  {s.notes && <p>{s.notes}</p>}
                  <label>
                    Next morning discomfort score
                    <select
                      value={s.backNext ?? ''}
                      onChange={(e) =>
                        save({
                          ...d,
                          sessions: d.sessions.map((x) =>
                            x.id === s.id ? { ...x, backNext: Number(e.target.value) } : x,
                          ),
                        })
                      }
                    >
                      <option value="" disabled>
                        Not logged
                      </option>
                      {Array.from({ length: 11 }, (_, i) => (
                        <option key={i}>{i}</option>
                      ))}
                    </select>
                  </label>
                  <button className="text-button danger" onClick={() => onRequestDelete(s.id)}>
                    Delete this session
                  </button>
                </div>
              )}
            </section>
          ))}
        </div>
      )}
      {d.walks.length > 0 && (
        <section className="card walk-history">
          <h3>Recent walks</h3>
          {[...d.walks]
            .reverse()
            .slice(0, 10)
            .map((w) => (
              <div className="between" key={w.id}>
                <span>
                  {labelDate(w.date)} · {w.minutes} minutes
                </span>
                <button className="text-button" onClick={() => onRequestDelete('walk:' + w.id)}>
                  Remove
                </button>
              </div>
            ))}
        </section>
      )}
    </>
  );
}
