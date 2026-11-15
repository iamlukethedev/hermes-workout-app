import { Download, Upload, X } from 'lucide-react';
import { weekday, type State } from '../../lib/training';
import { downloadBackup, exportCsv } from '../../lib/export';

type Props = {
  data: State;
  save: (state: State) => void;
  startInput: string;
  onStartInputChange: (date: string) => void;
  nameInput: string;
  onNameInputChange: (name: string) => void;
  onSaveStartDate: () => void;
  onImport: (file: File) => Promise<void>;
  onClose: () => void;
};

export default function SettingsModal({
  data: d,
  save,
  startInput,
  onStartInputChange,
  nameInput,
  onNameInputChange,
  onSaveStartDate,
  onImport,
  onClose,
}: Props) {
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
          <li>Monday, Wednesday and Friday strength. Walk on the days between.</li>
          <li>Train at a time that still lets you protect 7–9 hours of sleep.</li>
          <li>
            Start with the lowest practical dumbbell setting. Logged weights are per dumbbell, not
            the combined pair.
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
            href="https://www.healthdirect.gov.au/symptoms/aches-and-pains/back-pain"
            target="_blank"
            rel="noreferrer"
          >
            Back pain guidance ↗
          </a>
          <a
            href="https://www.health.gov.au/topics/physical-activity/24-hour-movement-guidelines-for-all-australians/recommendations-for-adults-18-to-64-years"
            target="_blank"
            rel="noreferrer"
          >
            Australian activity guidance ↗
          </a>
        </div>
        <h3>Your data</h3>
        <p>
          Your log is stored only in this browser. Nothing is sent to a server. Export a backup
          regularly, and import it to move your log to another device or browser.
        </p>
        <div className="two-fields">
          <button className="secondary" onClick={() => exportCsv(d.sessions)}>
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
        <p className="small muted">
          Importing replaces the log in this browser. On iPhone, open the site in Safari, then use
          Share → Add to Home Screen.
        </p>
      </section>
    </div>
  );
}
