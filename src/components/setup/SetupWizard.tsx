import { LogoMark } from '../Logo';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { getApiKey, setApiKey } from '../../lib/api-key';
import { buildPlan } from '../../lib/builtin-planner';
import { releasePhoto, preparePhoto, type Photo } from '../../lib/photos';
import {
  EQUIPMENT,
  GOALS,
  INJURY_AREAS,
  MAX_KG,
  profileSchema,
  workoutExercises,
  type Plan,
  type Profile,
} from '../../lib/plan';
import './setup.css';

type Props = {
  initialProfile?: Profile;
  hasExistingLog: boolean;
  onComplete: (profile: Profile, plan: Plan) => void;
  onKeepClassic?: () => void;
  onCancel?: () => void;
};

const STEPS = ['About you', 'Photos', 'Health', 'Equipment', 'Schedule', 'Plan', 'Review'] as const;
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const EXPERIENCE = [
  { id: 'new', label: 'New to training', hint: 'Little or no strength training so far' },
  { id: 'returning', label: 'Returning after a break', hint: 'Trained before, not recently' },
  { id: 'regular', label: 'Train regularly', hint: 'Already exercising most weeks' },
] as const;
const PROGRESS = [
  'Reading your answers…',
  'Choosing exercises that fit your equipment…',
  'Adjusting for your limitations…',
  'Writing coaching steps and safety notes…',
  'Checking the plan fits your schedule…',
];

const numberOrUndefined = (s: string) => (s.trim() === '' ? undefined : Number(s));

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className="setup-chip" aria-pressed={on} onClick={onClick}>
      {on && <Check size={14} aria-hidden="true" />}
      {children}
    </button>
  );
}

function PhotoPicker({
  label,
  hint,
  max,
  photos,
  onChange,
  capture,
}: {
  label: string;
  hint: string;
  max: number;
  photos: Photo[];
  onChange: (next: Photo[]) => void;
  capture?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputId = useId();
  const latest = useRef(photos);
  latest.current = photos;

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError('');
    const next = [...latest.current];
    const problems: string[] = [];
    for (const file of Array.from(files)) {
      if (next.length >= max) {
        problems.push(`Only ${max} photos can be added.`);
        break;
      }
      try {
        next.push(await preparePhoto(file));
      } catch (e) {
        problems.push(e instanceof Error ? e.message : 'That photo could not be read.');
      }
    }
    onChange(next);
    setError(problems.join(' '));
    setBusy(false);
  };

  return (
    <div className="setup-photos">
      <div className="setup-photo-grid">
        {photos.map((p, i) => (
          <figure key={p.preview} className="setup-thumb">
            <img src={p.preview} alt={`${label} ${i + 1}`} />
            <button
              type="button"
              className="setup-thumb-remove"
              aria-label={`Remove ${label.toLowerCase()} ${i + 1}`}
              onClick={() => {
                releasePhoto(p);
                onChange(photos.filter((x) => x !== p));
              }}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </figure>
        ))}
        {photos.length < max && (
          <label htmlFor={inputId} className="setup-add" aria-busy={busy}>
            {busy ? (
              <Loader2 className="setup-spin" aria-hidden="true" />
            ) : (
              <Camera aria-hidden="true" />
            )}
            <span>{busy ? 'Resizing…' : 'Add photo'}</span>
            <input
              id={inputId}
              type="file"
              accept="image/*"
              capture={capture ? 'user' : undefined}
              multiple
              disabled={busy}
              onChange={(e) => {
                void add(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        )}
      </div>
      <p className="small muted">{hint}</p>
      {error && (
        <p className="setup-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default function SetupWizard({
  initialProfile,
  hasExistingLog,
  onComplete,
  onKeepClassic,
  onCancel,
}: Props) {
  const init = initialProfile;
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');

  const [name, setName] = useState(init?.name ?? '');
  const [age, setAge] = useState(init?.age?.toString() ?? '');
  const [sex, setSex] = useState<string>(init?.sex ?? '');
  const [height, setHeight] = useState(init?.heightCm?.toString() ?? '');
  const [weight, setWeight] = useState(init?.weightKg?.toString() ?? '');
  const [experience, setExperience] = useState<Profile['experience'] | ''>(init?.experience ?? '');
  const [goals, setGoals] = useState<string[]>(init?.goals ?? []);

  const [injuries, setInjuries] = useState<Record<string, string>>(
    Object.fromEntries((init?.injuries ?? []).map((i) => [i.area, i.notes ?? ''])),
  );
  const [healthNotes, setHealthNotes] = useState(init?.healthNotes ?? '');

  const [equipment, setEquipment] = useState<string[]>(init?.equipment ?? []);
  const [maxKg, setMaxKg] = useState(init?.maxDumbbellKg?.toString() ?? '');
  const [equipmentNotes, setEquipmentNotes] = useState(init?.equipmentNotes ?? '');

  const [days, setDays] = useState<number[]>(init?.days ?? [1, 3, 5]);
  const [minutes, setMinutes] = useState(init?.minutes ?? 30);

  const [bodyPhotos, setBodyPhotos] = useState<Photo[]>([]);
  const [equipmentPhotos, setEquipmentPhotos] = useState<Photo[]>([]);

  const [key, setKey] = useState(() => getApiKey() ?? '');
  const [remember, setRemember] = useState(() => !!getApiKey());
  const [showKey, setShowKey] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [plan, setPlan] = useState<Plan | null>(null);
  const abort = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  // Photos live only in memory: release their object URLs when the wizard goes away.
  const allPhotos = useRef<Photo[]>([]);
  allPhotos.current = [...bodyPhotos, ...equipmentPhotos];
  useEffect(
    () => () => {
      abort.current?.abort();
      allPhotos.current.forEach(releasePhoto);
    },
    [],
  );

  useEffect(() => {
    heading.current?.focus();
  }, [step]);

  useEffect(() => {
    if (!generating) return;
    const t = setInterval(() => setProgress((p) => Math.min(p + 1, PROGRESS.length - 1)), 6000);
    return () => clearInterval(t);
  }, [generating]);

  const toggle = <T,>(list: T[], v: T) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const buildProfile = (): { profile?: Profile; error?: string } => {
    const injuryList = INJURY_AREAS.filter((a) => a in injuries).map((area) => ({
      area,
      notes: injuries[area].trim() || undefined,
    }));
    const result = profileSchema.safeParse({
      name: name.trim() || undefined,
      age: numberOrUndefined(age),
      sex: sex || undefined,
      heightCm: numberOrUndefined(height),
      weightKg: numberOrUndefined(weight),
      experience: experience || undefined,
      goals,
      injuries: injuryList,
      healthNotes: healthNotes.trim() || undefined,
      equipment,
      maxDumbbellKg: equipment.includes('dumbbells') ? numberOrUndefined(maxKg) : undefined,
      equipmentNotes: equipmentNotes.trim() || undefined,
      days: [...days].sort((a, b) => a - b),
      minutes,
    });
    return result.success
      ? { profile: result.data }
      : { error: result.error.issues[0]?.message ?? 'Check your answers.' };
  };

  const validate = (s: number): string => {
    if (s === 0) {
      if (!experience) return 'Choose how much training experience you have.';
      if (age && !(Number.isInteger(Number(age)) && Number(age) >= 13 && Number(age) <= 100))
        return 'Age must be a whole number from 13 to 100.';
      if (height && !(Number(height) >= 100 && Number(height) <= 250))
        return 'Height must be between 100 and 250 cm.';
      if (weight && !(Number(weight) >= 30 && Number(weight) <= 300))
        return 'Weight must be between 30 and 300 kg.';
    }
    if (
      s === 3 &&
      equipment.includes('dumbbells') &&
      maxKg &&
      !(Number(maxKg) >= 0 && Number(maxKg) <= MAX_KG)
    )
      return `Heaviest dumbbell must be between 0 and ${MAX_KG} kg.`;
    if (s === 4 && days.length === 0) return 'Pick at least one training day.';
    return '';
  };

  const go = (next: number) => {
    setError('');
    setStep(next);
  };
  const next = () => {
    const problem = validate(step);
    if (problem) return setError(problem);
    go(step + 1);
  };

  const withProfile = (fn: (p: Profile) => void) => {
    const { profile, error: e } = buildProfile();
    if (!profile) return setError(e ?? 'Check your answers.');
    fn(profile);
  };

  const useBuiltin = () =>
    withProfile((profile) => {
      setPlan(buildPlan(profile));
      go(6);
    });

  const useClaude = () => {
    const trimmed = key.trim();
    if (!trimmed) return setError('Paste your Anthropic API key to plan with Claude.');
    withProfile((profile) => {
      setApiKey(remember ? trimmed : null);
      const controller = new AbortController();
      abort.current = controller;
      setError('');
      setProgress(0);
      setGenerating(true);
      // The Anthropic SDK is only downloaded when someone actually plans with Claude.
      import('../../lib/ai-planner')
        .then(({ generatePlan }) =>
          generatePlan({
            apiKey: trimmed,
            profile,
            bodyPhotos,
            equipmentPhotos,
            signal: controller.signal,
          }),
        )
        .then((p) => {
          setPlan(p);
          go(6);
        })
        .catch((e: unknown) => {
          if (controller.signal.aborted) return;
          setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
        })
        .finally(() => {
          if (abort.current === controller) abort.current = null;
          setGenerating(false);
        });
    });
  };

  const cancelGenerate = () => {
    abort.current?.abort();
    setGenerating(false);
    setError('');
  };

  const reviewProfile = step === 6 ? buildProfile().profile : undefined;

  return (
    <div className="setup" role="dialog" aria-modal="true" aria-labelledby="setup-title">
      <header className="setup-top">
        <div className="setup-top-inner">
          <span className="setup-brand">
            <LogoMark size={28} />
            <span className="eyebrow">
              HERMES · STEP {step + 1} OF {STEPS.length}
            </span>
          </span>
          {onCancel && (
            <button
              type="button"
              className="secondary setup-cancel"
              onClick={onCancel}
              disabled={generating}
            >
              Cancel
            </button>
          )}
        </div>
        <ol className="setup-progress" aria-label="Progress">
          {STEPS.map((label, i) => (
            <li
              key={label}
              aria-current={i === step ? 'step' : undefined}
              data-state={i < step ? 'done' : i === step ? 'now' : 'todo'}
            >
              <span className="setup-bar" />
              <span className="setup-step-label">{label}</span>
            </li>
          ))}
        </ol>
      </header>

      <main className="setup-main">
        {step === 0 && (
          <section className="setup-section">
            <h1 id="setup-title" ref={heading} tabIndex={-1}>
              Let&apos;s build your plan.
            </h1>
            <p className="muted">
              A few questions so your programme fits your body, injuries, equipment and schedule.
              Your answers stay on this device unless you choose to plan with Claude.
            </p>
            {hasExistingLog && onKeepClassic && (
              <div className="card setup-keep">
                <div>
                  <strong>Already training here?</strong>
                  <p className="small muted">
                    Keep your current programme and your logged sessions as they are.
                  </p>
                </div>
                <button type="button" className="secondary" onClick={onKeepClassic}>
                  Keep my current programme
                </button>
              </div>
            )}
            <div className="setup-grid">
              <label className="setup-wide">
                Name (optional)
                <input
                  value={name}
                  maxLength={60}
                  autoComplete="given-name"
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Age
                <input
                  inputMode="numeric"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="e.g. 42"
                />
              </label>
              <label>
                Sex (optional)
                <select value={sex} onChange={(e) => setSex(e.target.value)}>
                  <option value="">Not set</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                  <option value="unspecified">Prefer not to say</option>
                </select>
              </label>
              <label>
                Height (cm)
                <input
                  inputMode="decimal"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="e.g. 172"
                />
              </label>
              <label>
                Weight (kg)
                <input
                  inputMode="decimal"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="e.g. 70"
                />
              </label>
            </div>
            <fieldset className="setup-fieldset">
              <legend>Your training experience</legend>
              <div className="setup-options">
                {EXPERIENCE.map((o) => (
                  <label key={o.id} className="setup-option">
                    <input
                      type="radio"
                      name="experience"
                      checked={experience === o.id}
                      onChange={() => setExperience(o.id)}
                    />
                    <span>
                      <strong>{o.label}</strong>
                      <small>{o.hint}</small>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="setup-fieldset">
              <legend>Goals (pick any)</legend>
              <div className="setup-chips">
                {GOALS.map((g) => (
                  <Chip key={g} on={goals.includes(g)} onClick={() => setGoals(toggle(goals, g))}>
                    {g}
                  </Chip>
                ))}
              </div>
            </fieldset>
          </section>
        )}

        {step === 1 && (
          <section className="setup-section">
            <h2 id="setup-title" ref={heading} tabIndex={-1}>
              Body photos (optional)
            </h2>
            <p className="muted">
              Up to three photos (front, side and back work well) give Claude general posture and
              build context. They are never required.
            </p>
            <PhotoPicker
              label="Body photo"
              hint="Photos are resized on this device, sent only with your AI plan request to Anthropic using your key, and never saved by this app."
              max={3}
              photos={bodyPhotos}
              onChange={setBodyPhotos}
              capture
            />
          </section>
        )}

        {step === 2 && (
          <section className="setup-section">
            <h2 id="setup-title" ref={heading} tabIndex={-1}>
              Injuries and limitations
            </h2>
            <div className="setup-callout" role="note">
              <strong>Not medical advice.</strong> Get clearance from a doctor or physiotherapist
              before starting if you have a recent injury, surgery, pregnancy or a heart condition.
            </div>
            <fieldset className="setup-fieldset">
              <legend>Anything that bothers you? (pick any)</legend>
              <div className="setup-chips">
                {INJURY_AREAS.map((a) => (
                  <Chip
                    key={a}
                    on={a in injuries}
                    onClick={() =>
                      setInjuries((cur) => {
                        const { [a]: removed, ...rest } = cur;
                        return removed === undefined ? { ...cur, [a]: '' } : rest;
                      })
                    }
                  >
                    {a}
                  </Chip>
                ))}
              </div>
            </fieldset>
            {INJURY_AREAS.filter((a) => a in injuries).map((a) => (
              <label key={a}>
                {a}: what happens, and what makes it worse?
                <textarea
                  maxLength={500}
                  value={injuries[a]}
                  onChange={(e) => setInjuries((cur) => ({ ...cur, [a]: e.target.value }))}
                />
              </label>
            ))}
            <label>
              Anything else we should know about your health
              <textarea
                maxLength={1000}
                value={healthNotes}
                onChange={(e) => setHealthNotes(e.target.value)}
              />
            </label>
          </section>
        )}

        {step === 3 && (
          <section className="setup-section">
            <h2 id="setup-title" ref={heading} tabIndex={-1}>
              What do you have at home?
            </h2>
            <fieldset className="setup-fieldset">
              <legend>Equipment checklist</legend>
              <div className="setup-chips">
                {EQUIPMENT.map((e) => (
                  <Chip
                    key={e.id}
                    on={equipment.includes(e.id)}
                    onClick={() => setEquipment(toggle(equipment, e.id))}
                  >
                    {e.label}
                  </Chip>
                ))}
              </div>
              <p className="small muted">
                Floor and bodyweight exercises need nothing, so leave blank if you have none.
              </p>
            </fieldset>
            {equipment.includes('dumbbells') && (
              <label className="setup-narrow">
                Heaviest dumbbell (kg each)
                <input
                  inputMode="decimal"
                  value={maxKg}
                  onChange={(e) => setMaxKg(e.target.value)}
                  placeholder="e.g. 12"
                />
              </label>
            )}
            <label>
              Equipment notes
              <textarea
                maxLength={500}
                value={equipmentNotes}
                onChange={(e) => setEquipmentNotes(e.target.value)}
                placeholder="Adjustable dumbbells up to 20 kg, a sofa instead of a bench…"
              />
            </label>
            <div>
              <h3>Equipment photos (optional)</h3>
              <PhotoPicker
                label="Equipment photo"
                hint="Claude uses these to see what you have. They are resized here and sent only with your AI plan request."
                max={4}
                photos={equipmentPhotos}
                onChange={setEquipmentPhotos}
              />
            </div>
          </section>
        )}

        {step === 4 && (
          <section className="setup-section">
            <h2 id="setup-title" ref={heading} tabIndex={-1}>
              When can you train?
            </h2>
            <fieldset className="setup-fieldset">
              <legend>Training days</legend>
              <div className="setup-chips">
                {WEEK_ORDER.map((d) => (
                  <Chip key={d} on={days.includes(d)} onClick={() => setDays(toggle(days, d))}>
                    {DAY_NAMES[d]}
                  </Chip>
                ))}
              </div>
              <p className="small muted">
                Two or three days a week is plenty to start. Leave a rest day between sessions.
              </p>
            </fieldset>
            <label>
              Minutes per session: <output>{minutes}</output>
              <input
                type="range"
                min={15}
                max={90}
                step={5}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
              />
            </label>
          </section>
        )}

        {step === 5 && (
          <section className="setup-section">
            <h2 id="setup-title" ref={heading} tabIndex={-1}>
              Build your plan
            </h2>
            <div className="setup-plans">
              <article className="card setup-plan-card">
                <div className="setup-plan-head">
                  <Sparkles aria-hidden="true" />
                  <h3>Plan with Claude</h3>
                </div>
                <p className="small muted">
                  Personalised to your injuries, equipment and photos. Typically a few cents per
                  plan, billed to your own Anthropic account.
                </p>
                <label>
                  Anthropic API key
                  <span className="setup-key">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={key}
                      onChange={(e) => setKey(e.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="sk-ant-…"
                      disabled={generating}
                    />
                    <button
                      type="button"
                      className="secondary"
                      aria-label={showKey ? 'Hide API key' : 'Show API key'}
                      aria-pressed={showKey}
                      onClick={() => setShowKey(!showKey)}
                    >
                      {showKey ? (
                        <EyeOff size={16} aria-hidden="true" />
                      ) : (
                        <Eye size={16} aria-hidden="true" />
                      )}
                    </button>
                  </span>
                </label>
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="small"
                >
                  Get a key in the Anthropic console
                </a>
                <label className="setup-check">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  Remember on this device
                </label>
                <details className="setup-disclosure">
                  <summary>What gets sent</summary>
                  <p className="small muted">
                    Your answers (age, height, weight, experience, goals, injuries and notes,
                    equipment and schedule, but not your name) plus any photos you added go directly
                    from this page to Anthropic, using your key. Nothing passes through any other
                    server, and photos are not saved by this app. Your key is kept only in this
                    browser, outside your training backups, if you choose to remember it.
                  </p>
                </details>
                {generating ? (
                  <div className="setup-loading">
                    <p aria-live="polite">
                      <Loader2 className="setup-spin" aria-hidden="true" /> {PROGRESS[progress]}
                    </p>
                    <p className="small muted">This can take a minute or two.</p>
                    <button type="button" className="secondary" onClick={cancelGenerate}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button type="button" className="primary" onClick={useClaude}>
                    {error ? 'Try again' : 'Generate with Claude'}
                    <Sparkles size={16} aria-hidden="true" />
                  </button>
                )}
              </article>
              <article className="card setup-plan-card">
                <h3>Use the built-in planner</h3>
                <p className="small muted">
                  Works offline and uses no account. Picks proven beginner exercises for your
                  equipment and limitations. Photos are not used.
                </p>
                <button
                  type="button"
                  className="secondary"
                  onClick={useBuiltin}
                  disabled={generating}
                >
                  Use the built-in planner
                </button>
              </article>
            </div>
          </section>
        )}

        {step === 6 && plan && (
          <section className="setup-section">
            <span className="eyebrow">
              {plan.source === 'ai' ? 'PLANNED WITH CLAUDE' : 'BUILT-IN PLANNER'}
            </span>
            <h2 id="setup-title" ref={heading} tabIndex={-1}>
              {plan.title}
            </h2>
            <p>{plan.summary}</p>
            <p className="small muted">
              {plan.weeks} weeks · {plan.days.map((d) => DAY_NAMES[d]).join(', ')} · about{' '}
              {plan.minutes} minutes
            </p>
            {plan.workouts.map((w) => (
              <article key={w.id} className="card setup-workout">
                <h3>{w.name}</h3>
                {w.focus && <p className="small muted">{w.focus}</p>}
                <ul>
                  {workoutExercises(plan, w).map((e) => (
                    <li key={e.id}>
                      {e.name}
                      <span className="small muted">
                        {' '}
                        · {e.sets.start}–{e.sets.max} ×{' '}
                        {e.reps[0] === e.reps[1] ? e.reps[0] : `${e.reps[0]}–${e.reps[1]}`}
                      </span>
                      {e.demo && <span className="setup-badge">3D demo</span>}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
            {plan.safety.length > 0 && (
              <div className="setup-callout" role="note">
                <strong>Safety notes</strong>
                <ul>
                  {plan.safety.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        <p className="setup-error" role="alert" aria-live="assertive">
          {error}
        </p>
      </main>

      <footer className="setup-foot">
        <div className="setup-foot-inner">
          {step === 6 ? (
            <>
              <button type="button" className="secondary" onClick={() => go(5)}>
                <ArrowLeft size={16} aria-hidden="true" /> Back to adjust
              </button>
              <button
                type="button"
                className="primary"
                disabled={!plan || !reviewProfile}
                onClick={() => plan && reviewProfile && onComplete(reviewProfile, plan)}
              >
                Start this plan <ArrowRight size={16} aria-hidden="true" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="secondary"
                disabled={step === 0 || generating}
                onClick={() => go(step - 1)}
              >
                <ArrowLeft size={16} aria-hidden="true" /> Back
              </button>
              {step === 1 && bodyPhotos.length === 0 ? (
                <button type="button" className="primary" onClick={next}>
                  Skip <ArrowRight size={16} aria-hidden="true" />
                </button>
              ) : (
                step < 5 && (
                  <button type="button" className="primary" onClick={next}>
                    Next <ArrowRight size={16} aria-hidden="true" />
                  </button>
                )
              )}
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
