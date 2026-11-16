import type { Plan, Profile } from './plan';

export type Exercise = {
  id: string;
  name: string;
  group: string;
  range: [number, number];
  side?: boolean;
  weighted?: boolean;
  equipment: string;
  cue: string;
  steps: string[];
  avoid: string;
  swap?: string;
};
export const exercises: Exercise[] = [
  {
    id: 'squat',
    name: 'Sit-to-stand',
    group: 'Legs',
    range: [8, 12],
    equipment: 'Stable chair or flat bench',
    cue: 'Stand tall. Sit softly.',
    steps: [
      'Sit near the front of a stable seat with feet comfortably apart.',
      'Lean forward slightly and stand up through your feet.',
      'Lower slowly to the seat. Start with body weight and a comfortable seat height.',
    ],
    avoid: 'Avoid dropping onto the seat or forcing a deep squat.',
  },
  {
    id: 'press',
    name: 'Dumbbell bench press',
    group: 'Chest & arms',
    range: [8, 12],
    weighted: true,
    equipment: 'Flat bench + two dumbbells',
    cue: 'Press smoothly. Keep feet planted.',
    steps: [
      'Use weights you can comfortably position. Lie on a locked, flat bench with feet planted.',
      'Start with elbows about 30–45° from your torso and wrists above elbows.',
      'Press up, then lower slowly to a comfortable depth. Breathe out as you press.',
    ],
    avoid: 'Avoid a large back arch or weights you cannot safely put down.',
    swap: 'If getting into position bothers your back, use wall push-ups.',
  },
  {
    id: 'row',
    name: 'Chest-supported row',
    group: 'Back & arms',
    range: [10, 12],
    weighted: true,
    equipment: 'Incline bench + two dumbbells',
    cue: 'Chest stays supported. Elbows to hips.',
    steps: [
      'Set and lock the bench around 30–45°. Support your chest and plant your feet.',
      'With light dumbbells hanging below your shoulders, pull elbows towards your hips.',
      'Lower slowly. Keep your chest in contact with the pad throughout.',
    ],
    avoid: 'Avoid lifting your chest or shrugging to move the weight.',
  },
  {
    id: 'bridge',
    name: 'Glute bridge',
    group: 'Hips',
    range: [10, 15],
    equipment: 'Floor',
    cue: 'Squeeze your glutes. Keep ribs quiet.',
    steps: [
      'Lie on your back with knees bent and feet flat.',
      'Squeeze your buttocks and lift your hips through a comfortable range.',
      'Pause briefly, then lower slowly. Keep shoulders on the floor.',
    ],
    avoid: 'Avoid pushing so high that your lower back arches.',
  },
  {
    id: 'heel',
    name: 'Heel slide',
    group: 'Core control',
    range: [6, 8],
    side: true,
    equipment: 'Floor',
    cue: 'Slide slowly. Keep your pelvis steady.',
    steps: [
      'Lie on your back with both knees bent and feet flat.',
      'Gently tighten your abdomen while breathing normally.',
      'Slide one heel away along the floor. Return before your back or pelvis starts moving. Repeat on the other side.',
    ],
    avoid: 'Avoid forcing your back flat or sliding beyond your control.',
  },
  {
    id: 'calf',
    name: 'Supported calf raise',
    group: 'Lower legs',
    range: [12, 15],
    equipment: 'Stable support',
    cue: 'Rise, pause, lower slowly.',
    steps: [
      'Stand holding a stable support with feet about hip width apart.',
      'Rise onto the balls of both feet and pause briefly.',
      'Lower your heels slowly to the floor.',
    ],
    avoid: 'Avoid bouncing or rolling onto the outer edges of your feet.',
  },
  {
    id: 'split',
    name: 'Supported split squat',
    group: 'Legs & balance',
    range: [6, 10],
    side: true,
    equipment: 'Stable support',
    cue: 'Small range. Both feet stay down.',
    steps: [
      'Hold a stable support with one foot forward and the other behind.',
      'Bend both knees a little, allowing the back heel to lift naturally. Keep the back toes grounded.',
      'Stand back up without twisting. Complete both sides. Start with body weight.',
    ],
    avoid: 'Avoid a stance so narrow that you lose balance.',
    swap: 'Use sit-to-stands if this bothers your knees or back.',
  },
  {
    id: 'pushup',
    name: 'Wall push-up',
    group: 'Chest & arms',
    range: [8, 12],
    equipment: 'Wall',
    cue: 'Move as one line. Breathe out to press.',
    steps: [
      'Place hands on a wall at chest height, slightly wider than your shoulders.',
      'Step back to a comfortable distance and bend your elbows to move towards the wall.',
      'Press away while keeping your trunk steady. Start close to the wall.',
    ],
    avoid: 'Avoid letting your lower back sag. Progress to a stable bench only when comfortable.',
  },
  {
    id: 'bird',
    name: 'Bird dog · leg slide',
    group: 'Core control',
    range: [5, 5],
    side: true,
    equipment: 'Floor',
    cue: 'Keep hips level. Slide, hold, return.',
    steps: [
      'Start on hands and knees, hands under shoulders and knees under hips.',
      'Gently brace your abdomen and slide one foot backwards along the floor.',
      'Hold for 3 seconds, then return. Repeat on the other side. Lift limbs only after this is comfortable and controlled.',
    ],
    avoid: 'Avoid twisting your pelvis or arching your back.',
  },
  {
    id: 'curl',
    name: 'Seated dumbbell curl',
    group: 'Arms',
    range: [10, 12],
    weighted: true,
    equipment: 'Bench + two dumbbells',
    cue: 'Elbows stay close. No rocking.',
    steps: [
      'Sit upright on your bench with feet planted and light dumbbells by your sides.',
      'Curl both weights towards your shoulders, keeping elbows near your torso.',
      'Lower slowly without leaning backwards.',
    ],
    avoid: 'Avoid swinging the weights or holding your breath.',
  },
];
export const workouts = {
  A: ['squat', 'press', 'row', 'bridge', 'heel', 'calf'],
  B: ['split', 'pushup', 'row', 'bridge', 'bird', 'curl'],
};
export type SetLog = { kg: number; reps: number; done: boolean };
export type Session = {
  id: string;
  date: string;
  /** Id of the plan workout this session followed. */
  type: string;
  week: number;
  startedAt: number;
  finishedAt?: number;
  sleep: number;
  backBefore: number;
  backAfter?: number;
  backNext?: number;
  energy?: number;
  notes?: string;
  sets: Record<string, SetLog[]>;
};
export type State = {
  startDate: string;
  sessions: Session[];
  draft: Session | null;
  walks: { id: string; date: string; minutes: number }[];
  /** Optional display name shown on the profile card. */
  name?: string;
  /** Answers from the setup wizard. */
  profile?: Profile;
  /** The active training plan. Absent until setup is finished. */
  plan?: Plan;
};
/** Today's date in the device's local time zone, formatted as YYYY-MM-DD. */
export function today() {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
export function addDays(s: string, n: number) {
  const d = new Date(s + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function weekday(s: string) {
  return new Date(s + 'T12:00:00Z').getUTCDay();
}
export function nextMonday(s: string) {
  const d = weekday(s);
  return addDays(s, d === 1 ? 0 : (8 - d) % 7);
}
export function labelDate(s: string) {
  return new Date(s + 'T12:00:00Z').toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}
export function initialState(): State {
  return { startDate: nextMonday(today()), sessions: [], draft: null, walks: [] };
}
