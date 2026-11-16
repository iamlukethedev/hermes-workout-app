import { useState } from 'react';
import { Download, KeyRound, RefreshCw, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { weekday, type State } from '../../lib/training';
import type { Plan } from '../../lib/plan';
import { downloadBackup, exportCsv } from '../../lib/export';
import { getApiKey, setApiKey } from '../../lib/api-key';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SOURCE_LABEL: Record<Plan['source'], string> = {
  ai: 'Planned with Claude',
  builtin: 'Built-in planner',
  classic: 'Classic programme',
};

function listDays(days: number[]) {
  const names = [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => DAY_NAMES[d]);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
}

type Props = {
  plan: Plan;
  onRedoSetup: () => void;
  data: State;
  save: (state: State) => void;
  startInput: string;
  onStartInputChange: (date: string) => void;
  nameInput: string;
  onNameInputChange: (name: string) => void;
  onSaveStartDate: () => void;
  onImport: (file: File) => Promise<void>;
  onClose: () => void;
  onLoadSample: () => void;
  onReset: () => void;
};

export default function SettingsModal({
  plan,
  onRedoSetup,
  data: d,
  save,
  startInput,
  onStartInputChange,
  nameInput,
  onNameInputChange,
  onSaveStartDate,
  onImport,
  onClose,
  onLoadSample,
  onReset,
}: Props) {
  const [hasKey, setHasKey] = useState(() => !!getApiKey());
  return (
    <div className="modal-overlay">
      <section
        className="modal settings-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Programme settings"
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">MAKE IT YOUR ROUTINE</span>
            <h2>Your programme</h2>
          </div>
          <button className="icon-button" aria-label="Close settings" onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="plan-settings">
          <div>
            <span className="eyebrow">{SOURCE_LABEL[plan.source]}</span>
            <strong>{plan.title}</strong>
            <span className="small muted">
              {plan.weeks} weeks · {plan.days.length}× per week · {plan.minutes} min
            </span>
          </div>
          <button className="secondary" onClick={onRedoSetup}>
            <RefreshCw size={16} /> Redo setup
          </button>
        </div>
        <label>
          Programme starts on a Monday
          <input
            type="date"
            value={startInput}
            onChange={(e) => onStartInputChange(e.target.value)}
          />
        </label>
        <button
          className="secondary wide"
          disabled={!startInput || weekday(startInput) !== 1}
          onClick={onSaveStartDate}
        >
          Save start date
        </button>
        {startInput && weekday(startInput) !== 1 && (
          <p className="small danger">Choose a Monday so the A/B schedule lines up.</p>
        )}
        <p className="small muted">
          Changing the date shifts the schedule. Existing logs stay unchanged. Set progression
          remains optional.
        </p>
        <label>
          Display name (optional)
          <input
            type="text"
            maxLength={60}
            value={nameInput}
            placeholder="Your name"
            onChange={(e) => onNameInputChange(e.target.value)}
            onBlur={() => {
              const name = nameInput.trim() || undefined;
              if (name !== d.name) save({ ...d, name });
            }}
          />
        </label>
        <h3>Your training guidelines</h3>
        <ul className="guidelines">
          <li>
            Strength on {listDays(plan.days)}. Walking or gentle movement on the days between.
          </li>
          <li>Train at a time that still lets you protect 7–9 hours of sleep.</li>
          <li>
            Start light. Log the weight of one dumbbell or kettlebell, or the total on a barbell.
          </li>
          <li>
            Check dumbbell selectors and bench locks before every set. Keep children and pets clear
            of equipment.
          </li>
          <li>
            Lower slowly, breathe normally, and leave spare repetitions. Never push through sharp,
            spreading or increasing pain.
          </li>
          <li>
            If you have a history of back pain or injury, consider a physiotherapy assessment before
            progressing to challenging loads.
          </li>
          <li>
            Seek urgent care for new bladder or bowel problems, groin numbness, or new or worsening
            leg weakness.
          </li>
        </ul>
        <div className="sources">
          <a
            href="https://www.who.int/publications/i/item/9789240015128"
            target="_blank"
            rel="noreferrer"
          >
            WHO physical activity guidelines ↗
          </a>
        </div>
        <h3>Your data</h3>
        <p>
          Your log is stored only in this browser, and this app has no server. The one exception is
          an AI plan: when you choose “Plan with Claude”, your setup answers and any photos you
          added are sent from your browser directly to Anthropic with your API key. Photos are never
          saved. Export a backup regularly, and import it to move your log to another device.
        </p>
        <div className="two-fields">
          <button className="secondary" onClick={() => exportCsv(d.sessions, plan)}>
            <Download size={16} /> Workout CSV
          </button>
          <button className="secondary" onClick={() => downloadBackup(d)}>
            <Download size={16} /> Full backup
          </button>
        </div>
        <label className="secondary import-button">
          <Upload size={16} /> Import backup
          <input
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void onImport(file);
            }}
          />
        </label>
        <div className="two-fields">
          <button className="secondary" onClick={onLoadSample}>
            <Sparkles size={16} /> Load sample data
          </button>
          <button className="secondary danger-button" onClick={onReset}>
            <Trash2 size={16} /> Reset all data
          </button>
        </div>
        {hasKey && (
          <button
            className="secondary wide"
            onClick={() => {
              setApiKey(null);
              setHasKey(false);
            }}
          >
            <KeyRound size={16} /> Forget my saved API key
          </button>
        )}
        <p className="small muted">
          Importing or loading sample data replaces the log in this browser. On iPhone, open the
          site in Safari, then use Share → Add to Home Screen.
        </p>
      </section>
    </div>
  );
}
