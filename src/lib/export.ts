import { exercises, type Session, type State } from './training';

export function uid() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
}

export function initials(name?: string) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'H';
  return parts
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

export function download(name: string, content: string, type = 'application/json') {
  const u = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}

export function downloadBackup(state: State) {
  download('hermes-workout-backup.json', JSON.stringify(state, null, 2));
}

export function exportCsv(sessions: Session[]) {
  const rows = [
    [
      'Date',
      'Workout',
      'Week',
      'Exercise',
      'Set',
      'Kg per dumbbell',
      'Reps per side if unilateral',
      'Completed',
      'Sleep hours',
      'Back before',
      'Back after',
      'Back next morning',
      'Energy',
    ],
  ];
  sessions.forEach((s) =>
    Object.entries(s.sets).forEach(([id, sets]) =>
      sets.forEach((x, i) =>
        rows.push([
          s.date,
          s.type,
          String(s.week),
          exercises.find((e) => e.id === id)?.name || id,
          String(i + 1),
          String(x.kg),
          String(x.reps),
          x.done ? 'Yes' : 'No',
          String(s.sleep),
          String(s.backBefore),
          String(s.backAfter ?? ''),
          String(s.backNext ?? ''),
          String(s.energy ?? ''),
        ]),
      ),
    ),
  );
  download(
    'hermes-workout-log.csv',
    rows.map((r) => r.map((c) => '"' + c.replaceAll('"', '""') + '"').join(',')).join('\n'),
    'text/csv',
  );
}
