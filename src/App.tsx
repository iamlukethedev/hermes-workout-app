import { lazy, Suspense, useEffect, useRef, useState } from 'react';
// Only first-time visitors and people redoing setup need the wizard.
const SetupWizard = lazy(() => import('./components/setup/SetupWizard'));
import {
  Activity,
  Check,
  ChevronRight,
  Dumbbell,
  HardDrive,
  House,
  Info,
  Settings,
  ShieldCheck,
  Timer,
  TrendingUp,
  X,
} from 'lucide-react';
import { today, initialState, type State, type Session } from './lib/training';
import {
  classicPlan,
  planWeek as weekOfPlan,
  setsFor,
  workoutById,
  workoutExercises,
  type Plan,
  type PlanExercise,
  type Profile,
} from './lib/plan';

import { LogoMark } from './components/Logo';
import { createSampleState } from './lib/sample';
import { loadState, parseState, saveState } from './lib/storage';
import { downloadBackup, exportCsv, initials, uid } from './lib/export';
import TodayTab from './components/tabs/TodayTab';
import PlanTab from './components/tabs/PlanTab';
import MovesTab from './components/tabs/MovesTab';
import ProgressTab from './components/tabs/ProgressTab';
import ExerciseModal from './components/modals/ExerciseModal';
import ReadyModal from './components/modals/ReadyModal';
import FinishModal from './components/modals/FinishModal';
import SettingsModal from './components/modals/SettingsModal';
import ConfirmModal from './components/modals/ConfirmModal';
type Tab = 'today' | 'plan' | 'moves' | 'progress';
const tabs = [
  { id: 'today' as Tab, label: 'Today', icon: House },
  { id: 'plan' as Tab, label: 'Programme', icon: Dumbbell },
  { id: 'moves' as Tab, label: 'Movement lab', icon: Activity },
  { id: 'progress' as Tab, label: 'Your progress', icon: TrendingUp },
];
function exerciseRest(plan: Plan | undefined, id: string) {
  return (plan ?? classicPlan()).exercises.find((e) => e.id === id)?.restSec ?? 90;
}
export default function App() {
  const [data, setData] = useState<State | null>(null),
    [tab, setTab] = useState<Tab>('today'),
    [error, setError] = useState('');
  // Latest state, read by handlers that may fire before React re-renders.
  const snapshot = useRef<State | null>(null);
  const [modal, setModal] = useState<PlanExercise | null>(null),
    [showSettings, setShowSettings] = useState(false),
    [ready, setReady] = useState<string | null>(null),
    [trainingWeek, setTrainingWeek] = useState(1),
    [sleep, setSleep] = useState(8),
    [back, setBack] = useState(0),
    [warm, setWarm] = useState<boolean[]>([]);
  const [finish, setFinish] = useState(false),
    [after, setAfter] = useState(0),
    [energy, setEnergy] = useState(3),
    [notes, setNotes] = useState(''),
    [restEnd, setRestEnd] = useState(0),
    [now, setNow] = useState(Date.now()),
    [walkMinutes, setWalkMinutes] = useState(20),
    [toast, setToast] = useState(''),
    [filter, setFilter] = useState('All'),
    [planWeek, setPlanWeek] = useState(1),
    [selectedProgress, setSelectedProgress] = useState('press'),
    [expanded, setExpanded] = useState<string | null>(null);
  const [startInput, setStartInput] = useState(''),
    [nameInput, setNameInput] = useState(''),
    [deleteId, setDeleteId] = useState<string | null>(null),
    [discard, setDiscard] = useState(false),
    [confirmReset, setConfirmReset] = useState(false),
    [setupOpen, setSetupOpen] = useState(false);
  useEffect(() => {
    const { state, error } = loadState();
    snapshot.current = state;
    setData(state);
    setPlanWeek(weekOfPlan(state.plan ?? classicPlan(), state.startDate, today()));
    setStartInput(state.startDate);
    setNameInput(state.name ?? '');
    if (error) setError(error);
  }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  function save(d: State) {
    snapshot.current = d;
    setData(d);
    if (!saveState(d))
      setError('Your browser could not save this change. Export a backup to keep your log safe.');
  }
  /** Swap in a whole new log (import, sample data or reset) and sync dependent form state. */
  function replaceState(next: State) {
    save(next);
    setPlanWeek(weekOfPlan(next.plan ?? classicPlan(), next.startDate, today()));
    setStartInput(next.startDate);
    setNameInput(next.name ?? '');
    setRestEnd(0);
    setError('');
  }
  function loadSample() {
    const current = snapshot.current;
    replaceState({
      ...createSampleState(today(), current?.plan ?? classicPlan()),
      name: current?.name,
      profile: current?.profile,
    });
    setToast('Sample log loaded. Reset it any time in Settings.');
  }
  async function importBackup(file: File) {
    try {
      replaceState(parseState(JSON.parse(await file.text())));
      setToast('Backup imported');
    } catch (e) {
      setError(
        e instanceof SyntaxError
          ? 'That file is not valid JSON.'
          : e instanceof Error
            ? e.message
            : 'Could not import that file.',
      );
    }
  }
  /** Adopt a new plan from setup. The programme restarts today; logged history is kept. */
  function adoptPlan(profile: Profile | undefined, plan: Plan) {
    const current = snapshot.current ?? initialState();
    replaceState({
      ...current,
      profile: profile ?? current.profile,
      plan,
      name: current.name ?? profile?.name,
      startDate: today(),
      draft: null,
    });
    setSetupOpen(false);
    setTab('today');
    setToast(
      plan.source === 'classic' ? 'Keeping your current programme' : 'Your new plan is ready',
    );
  }
  const d = data;
  const day = today();
  const plan = d?.plan ?? classicPlan();
  const week = d ? weekOfPlan(plan, d.startDate, day) : 1;
  const draft = d?.draft;
  const rest = Math.max(0, Math.ceil((restEnd - now) / 1000));
  useEffect(() => {
    if (ready && data) {
      setTrainingWeek(weekOfPlan(data.plan ?? classicPlan(), data.startDate, today()));
      setWarm(Array((data.plan ?? classicPlan()).warmup.length).fill(false));
    }
  }, [ready]);
  function begin() {
    if (!d || !ready || back > 0) return;
    const w = trainingWeek;
    const workout = workoutById(plan, ready);
    if (!workout) return;
    const sets: Session['sets'] = {};
    workoutExercises(plan, workout).forEach((ex) => {
      const prev = [...d.sessions].reverse().find((s) => s.sets[ex.id]?.length);
      sets[ex.id] = Array.from({ length: setsFor(plan, w, ex) }, () => ({
        kg: ex.weighted ? prev?.sets[ex.id][0]?.kg || ex.startKg || 0 : 0,
        reps: ex.reps[0],
        done: false,
      }));
    });
    save({
      ...d,
      draft: {
        id: uid(),
        date: day,
        type: ready,
        week: w,
        startedAt: Date.now(),
        sleep,
        backBefore: back,
        sets,
      },
    });
    setReady(null);
    setTab('today');
  }
  function updateSet(
    id: string,
    index: number,
    field: 'kg' | 'reps' | 'done',
    value: number | boolean,
  ) {
    if (!snapshot.current?.draft) return;
    const state = snapshot.current;
    const s = state.draft!;
    const sets = {
      ...s.sets,
      [id]: s.sets[id].map((x, i) => (i === index ? { ...x, [field]: value } : x)),
    };
    save({ ...state, draft: { ...s, sets } });
    if (field === 'done' && value) {
      const rest = exerciseRest(snapshot.current.plan, id);
      setRestEnd(Date.now() + rest * 1000);
    }
  }
  useEffect(() => {
    const open = !!(modal || ready || finish || showSettings || deleteId || discard);
    if (!open) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModal(null);
        setReady(null);
        setFinish(false);
        setShowSettings(false);
        setDeleteId(null);
        setDiscard(false);
      }
    };
    window.addEventListener('keydown', key);
    return () => {
      document.body.style.overflow = before;
      window.removeEventListener('keydown', key);
    };
  }, [modal, ready, finish, showSettings, deleteId, discard]);
  function complete() {
    if (!d || !draft) return;
    const session = { ...draft, finishedAt: Date.now(), backAfter: after, energy, notes };
    save({ ...d, draft: null, sessions: [...d.sessions, session] });
    setFinish(false);
    setRestEnd(0);
    setNotes('');
    setToast('Session saved. A little stronger today.');
    setTab('progress');
  }
  function startWorkout(type: string) {
    setWarm(Array((snapshot.current?.plan ?? classicPlan()).warmup.length).fill(false));
    setReady(type);
    setBack(0);
  }
  if (!d)
    return (
      <div className="loading">
        <LogoMark size={52} />
        <p>Getting your training ready…</p>
      </div>
    );
  if (!d.plan || setupOpen)
    return (
      <Suspense
        fallback={
          <div className="loading">
            <LogoMark size={52} />
          </div>
        }
      >
        <SetupWizard
          initialProfile={d.profile}
          hasExistingLog={!d.plan && d.sessions.length > 0}
          onComplete={(profile, next) => adoptPlan(profile, next)}
          onKeepClassic={() => adoptPlan(undefined, classicPlan())}
          onCancel={d.plan ? () => setSetupOpen(false) : undefined}
        />
      </Suspense>
    );
  const doneSets = draft
      ? Object.values(draft.sets)
          .flat()
          .filter((s) => s.done).length
      : 0,
    totalSets = draft ? Object.values(draft.sets).flat().length : 0;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href={import.meta.env.BASE_URL} aria-label="Hermes Workout home">
          <LogoMark className="brand-symbol" size={40} />
          <span>
            HERMES<span className="brand-sub">HOME STRENGTH, EVERY WEEK</span>
          </span>
        </a>
        <div className="sidebar-label">YOUR TRAINING SPACE</div>
        <nav>
          {tabs.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? 'active' : ''}
              onClick={() => setTab(t.id)}
            >
              <t.icon size={20} />
              <span>{t.label}</span>
              {tab === t.id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="small-icon">
            <ShieldCheck size={20} />
          </div>
          <strong>Consistency over intensity.</strong>
          <p>Strong enough for the life you love. One session at a time.</p>
        </div>
        <button className="profile" onClick={() => setShowSettings(true)}>
          <span className="avatar">{initials(d?.name)}</span>
          <div>
            <strong>{d?.name || 'Your profile'}</strong>
            <span>Your personal programme</span>
          </div>
          <Settings size={18} />
        </button>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="mobile-brand">
            <LogoMark className="brand-symbol" size={40} />
            <b>HERMES</b>
          </div>
          <div className="breadcrumb">
            Your training <ChevronRight size={13} />{' '}
            <span>{tabs.find((t) => t.id === tab)?.label}</span>
          </div>
          <div className="sync-state" title="Your log is stored only in this browser">
            <HardDrive size={15} />
            <span>Saved on this device</span>
          </div>
          <button
            className="icon-button"
            aria-label="Settings"
            onClick={() => setShowSettings(true)}
          >
            <Settings size={19} />
          </button>
        </header>
        <main>
          {error && (
            <div className="error-banner">
              <Info size={18} />
              <div>
                {error} <button onClick={() => downloadBackup(d)}>Export backup</button>{' '}
                <button onClick={() => setError('')}>Dismiss</button>
              </div>
            </div>
          )}
          {tab === 'today' && (
            <TodayTab
              plan={plan}
              data={d}
              save={save}
              day={day}
              now={now}
              planWeek={planWeek}
              draft={draft}
              doneSets={doneSets}
              totalSets={totalSets}
              walkMinutes={walkMinutes}
              onWalkMinutesChange={setWalkMinutes}
              modalOpen={!!modal}
              onOpenPlan={(w) => {
                setPlanWeek(w);
                setTab('plan');
              }}
              onStartWorkout={startWorkout}
              onOpenExercise={setModal}
              onUpdateSet={updateSet}
              onDiscard={() => setDiscard(true)}
              onFinish={() => {
                setAfter(0);
                setEnergy(3);
                setFinish(true);
              }}
              onOpenSettings={() => setShowSettings(true)}
              onToast={setToast}
            />
          )}
          {tab === 'plan' && (
            <PlanTab
              plan={plan}
              data={d}
              draft={draft}
              planWeek={planWeek}
              onPlanWeekChange={setPlanWeek}
              onStartWorkout={startWorkout}
              onOpenExercise={setModal}
              onUpdateSet={updateSet}
            />
          )}
          {tab === 'moves' && (
            <MovesTab
              plan={plan}
              filter={filter}
              onFilterChange={setFilter}
              onOpenExercise={setModal}
            />
          )}
          {tab === 'progress' && (
            <ProgressTab
              plan={plan}
              data={d}
              save={save}
              selectedProgress={selectedProgress}
              onSelectedProgressChange={setSelectedProgress}
              expanded={expanded}
              onExpandedChange={setExpanded}
              onExportCsv={() => exportCsv(d.sessions, plan)}
              onGoToday={() => setTab('today')}
              onLoadSample={loadSample}
              onRequestDelete={setDeleteId}
            />
          )}
          <footer className="page-footer">
            <span>HERMES WORKOUT · OPEN SOURCE · YOUR DATA STAYS ON THIS DEVICE</span>
            <span>One session at a time.</span>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav">
        {tabs.map((t) => (
          <button className={tab === t.id ? 'active' : ''} key={t.id} onClick={() => setTab(t.id)}>
            <t.icon size={21} />
            <span>
              {t.id === 'plan'
                ? 'Plan'
                : t.id === 'moves'
                  ? '3D guides'
                  : t.id === 'progress'
                    ? 'Progress'
                    : 'Today'}
            </span>
          </button>
        ))}
      </nav>
      {restEnd > 0 && draft && (
        <div className="rest-timer" role="status">
          <Timer size={22} />
          <div>
            <strong>
              {rest
                ? `${Math.floor(rest / 60)}:${String(rest % 60).padStart(2, '0')}`
                : 'Ready when you are'}
            </strong>
            <span>{rest ? 'REST · BREATHE & RECOVER' : 'Rest longer if you need to'}</span>
          </div>
          <button
            aria-label="Add 30 seconds rest"
            onClick={() => setRestEnd(Math.max(Date.now(), restEnd) + 30000)}
          >
            +30s
          </button>
          <button
            className="icon-button"
            aria-label="Dismiss rest timer"
            onClick={() => setRestEnd(0)}
          >
            <X size={18} />
          </button>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
      {modal && <ExerciseModal exercise={modal} onClose={() => setModal(null)} />}
      {ready && (
        <ReadyModal
          plan={plan}
          type={ready}
          sessions={d.sessions}
          day={day}
          week={week}
          sleep={sleep}
          onSleepChange={setSleep}
          back={back}
          onBackChange={setBack}
          trainingWeek={trainingWeek}
          onTrainingWeekChange={setTrainingWeek}
          warm={warm}
          onWarmChange={setWarm}
          onBegin={begin}
          onClose={() => setReady(null)}
        />
      )}
      {finish && (
        <FinishModal
          checkInLabel={plan.checkInLabel}
          doneSets={doneSets}
          totalSets={totalSets}
          after={after}
          onAfterChange={setAfter}
          energy={energy}
          onEnergyChange={setEnergy}
          notes={notes}
          onNotesChange={setNotes}
          onComplete={complete}
          onClose={() => setFinish(false)}
        />
      )}
      {showSettings && (
        <SettingsModal
          plan={plan}
          onRedoSetup={() => {
            setShowSettings(false);
            setSetupOpen(true);
          }}
          onLoadSample={() => {
            loadSample();
            setShowSettings(false);
            setTab('progress');
          }}
          onReset={() => setConfirmReset(true)}
          data={d}
          save={save}
          startInput={startInput}
          onStartInputChange={setStartInput}
          nameInput={nameInput}
          onNameInputChange={setNameInput}
          onSaveStartDate={() => {
            save({ ...d, startDate: startInput });
            setPlanWeek(weekOfPlan(plan, startInput, day));
            setToast('Programme start updated');
          }}
          onImport={importBackup}
          onClose={() => setShowSettings(false)}
        />
      )}
      {(deleteId || discard) && (
        <ConfirmModal
          title={discard ? 'Discard this session?' : 'Remove this entry?'}
          body="This removes the entry from your log on this device."
          onCancel={() => {
            setDeleteId(null);
            setDiscard(false);
          }}
          onConfirm={() => {
            if (discard) {
              save({ ...d, draft: null });
              setRestEnd(0);
            } else if (deleteId?.startsWith('walk:'))
              save({ ...d, walks: d.walks.filter((w) => w.id !== deleteId.slice(5)) });
            else save({ ...d, sessions: d.sessions.filter((s) => s.id !== deleteId) });
            setDeleteId(null);
            setDiscard(false);
          }}
        />
      )}
      {confirmReset && (
        <ConfirmModal
          title="Reset all data?"
          body="This permanently clears every session, walk and setting stored in this browser. Export a backup first if you want to keep them."
          confirmLabel="Reset"
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => {
            replaceState({ ...initialState(), name: d.name, profile: d.profile, plan: d.plan });
            setConfirmReset(false);
            setShowSettings(false);
            setTab('today');
            setToast('Your log has been reset');
          }}
        />
      )}
    </div>
  );
}
