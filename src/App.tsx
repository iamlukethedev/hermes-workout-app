import { useEffect, useRef, useState } from 'react';
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
import {
  exercises,
  workouts,
  today,
  weekAt,
  setCount,
  type State,
  type Session,
  type Exercise,
} from './lib/training';
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
export default function App() {
  const [data, setData] = useState<State | null>(null),
    [tab, setTab] = useState<Tab>('today'),
    [error, setError] = useState('');
  // Latest state, read by handlers that may fire before React re-renders.
  const snapshot = useRef<State | null>(null);
  const [modal, setModal] = useState<Exercise | null>(null),
    [showSettings, setShowSettings] = useState(false),
    [ready, setReady] = useState<'A' | 'B' | null>(null),
    [trainingWeek, setTrainingWeek] = useState(1),
    [sleep, setSleep] = useState(8),
    [back, setBack] = useState(0),
    [warm, setWarm] = useState<boolean[]>(Array(5).fill(false));
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
    [discard, setDiscard] = useState(false);
  useEffect(() => {
    const { state, error } = loadState();
    snapshot.current = state;
    setData(state);
    setPlanWeek(weekAt(state.startDate, today()));
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
  async function importBackup(file: File) {
    try {
      const imported = parseState(JSON.parse(await file.text()));
      save(imported);
      setPlanWeek(weekAt(imported.startDate, today()));
      setStartInput(imported.startDate);
      setNameInput(imported.name ?? '');
      setError('');
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
  const d = data;
  const day = today();
  const week = d ? weekAt(d.startDate, day) : 1;
  const draft = d?.draft;
  const rest = Math.max(0, Math.ceil((restEnd - now) / 1000));
  useEffect(() => {
    if (ready && data) setTrainingWeek(weekAt(data.startDate, today()));
  }, [ready]);
  function begin() {
    if (!d || !ready || back > 0) return;
    const w = trainingWeek;
    const sets: Session['sets'] = {};
    workouts[ready].forEach((id, i) => {
      const ex = exercises.find((e) => e.id === id)!;
      const prev = [...d.sessions].reverse().find((s) => s.sets[id]);
      sets[id] = Array.from({ length: setCount(w, i) }, () => ({
        kg: ex.weighted ? prev?.sets[id][0]?.kg || 0 : 0,
        reps: ex.range[0],
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
    setWarm(Array(5).fill(false));
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
    if (field === 'done' && value) setRestEnd(Date.now() + 90000);
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
  function startWorkout(type: 'A' | 'B') {
    setReady(type);
    setBack(0);
  }
  if (!d)
    return (
      <div className="loading">
        <div className="brand-symbol">S</div>
        <p>Getting your training ready…</p>
      </div>
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
        <a className="brand" href="/" aria-label="Hermes Workout home">
          <span className="brand-symbol">H</span>
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
            <span className="brand-symbol">H</span>
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
            <MovesTab filter={filter} onFilterChange={setFilter} onOpenExercise={setModal} />
          )}
          {tab === 'progress' && (
            <ProgressTab
              data={d}
              save={save}
              selectedProgress={selectedProgress}
              onSelectedProgressChange={setSelectedProgress}
              expanded={expanded}
              onExpandedChange={setExpanded}
              onExportCsv={() => exportCsv(d.sessions)}
              onGoToday={() => setTab('today')}
              onRequestDelete={setDeleteId}
            />
          )}
          <footer className="page-footer">
            <span>BUILT FOR YOUR EVERYDAY.</span>
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
          data={d}
          save={save}
          startInput={startInput}
          onStartInputChange={setStartInput}
          nameInput={nameInput}
          onNameInputChange={setNameInput}
          onSaveStartDate={() => {
            save({ ...d, startDate: startInput });
            setPlanWeek(weekAt(startInput, day));
            setToast('Programme start updated');
          }}
          onImport={importBackup}
          onClose={() => setShowSettings(false)}
        />
      )}
      {(deleteId || discard) && (
        <ConfirmModal
          discard={discard}
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
    </div>
  );
}
