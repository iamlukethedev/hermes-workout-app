import { isDemoId, planSchema, type Plan, type PlanExercise, type Profile } from './plan';
import { exercises as library, type Exercise } from './training';

const WEEKS = 8;

const march: Exercise = {
  id: 'march',
  name: 'Marching in place',
  group: 'Warm-up & cardio',
  range: [20, 30],
  equipment: 'None',
  cue: 'Stand tall. Easy breathing.',
  steps: [
    'Stand tall with feet hip width apart, near a wall or chair if you want something to touch.',
    'March on the spot, lifting each knee to a comfortable height and swinging your arms gently.',
    'Keep the pace conversational. Count each step with the left foot.',
  ],
  avoid: 'Avoid rushing or lifting your knees higher than feels easy.',
  swap: 'Walk gently on the spot if marching bothers your hips or knees.',
};

const byId = new Map<string, Exercise>([...library, march].map((e) => [e.id, e]));

const has = (owned: Set<string>, ...ids: string[]) => ids.some((id) => owned.has(id));

/** What each library exercise needs. Floor work needs no equipment at all. */
const requirements: Record<string, (owned: Set<string>) => boolean> = {
  squat: (o) => has(o, 'chair', 'bench', 'incline-bench'),
  press: (o) => has(o, 'dumbbells') && has(o, 'bench', 'incline-bench'),
  row: (o) => has(o, 'dumbbells') && has(o, 'incline-bench', 'bench'),
  curl: (o) => has(o, 'dumbbells') && has(o, 'bench', 'incline-bench', 'chair'),
  calf: (o) => has(o, 'support', 'wall'),
  split: (o) => has(o, 'support', 'wall'),
  pushup: (o) => has(o, 'wall'),
  bridge: () => true,
  heel: () => true,
  bird: () => true,
  march: () => true,
};

/** Exercises each area rules out. */
const dropped: Record<string, string[]> = {
  Knee: ['split'],
  Shoulder: ['press', 'pushup'],
  'Wrist / hand': ['pushup', 'bird'],
  Hip: ['split'],
  'Ankle / foot': ['calf', 'split'],
  Elbow: ['curl'],
};

const injuryNotes: Record<string, string> = {
  'Lower back':
    'Lower back: sets are capped at two and floor work stays small and controlled. Stop an exercise if your back pain spreads or increases.',
  'Upper back / neck':
    'Upper back / neck: keep your head in line with your spine and avoid shrugging. Reduce the weight or range if your neck tightens.',
  Shoulder:
    'Shoulder: pressing exercises are left out. Rows stay light and the range stays small. Stop if you feel a pinch or sharp pain at the shoulder.',
  Elbow:
    'Elbow: curls are left out. Keep rows light and stop if the elbow joint aches during or after a session.',
  'Wrist / hand':
    'Wrist / hand: wall push-ups and bird dogs, which load the wrists, are left out. Keep wrists straight when holding dumbbells.',
  Hip: 'Hip: split squats are left out. Keep ranges small and stop if you feel pinching at the front of the hip.',
  Knee: 'Knee: split squats are left out and sit-to-stands should use a higher seat so your knees bend less. Stop if the knee clicks painfully or swells.',
  'Ankle / foot':
    'Ankle / foot: calf raises and split squats are left out. Wear supportive shoes and stop if you feel sharp ankle or foot pain.',
};

const checkInShort: Record<string, string> = {
  'Lower back': 'Back',
  'Upper back / neck': 'Upper back',
  'Wrist / hand': 'Wrist',
  'Ankle / foot': 'Ankle',
};

const sets = {
  new: { start: 1, max: 2 },
  returning: { start: 1, max: 3 },
  regular: { start: 2, max: 3 },
} as const;

const fullBody: [string[], string[]] = [
  ['squat', 'press', 'row', 'bridge', 'heel', 'calf'],
  ['split', 'pushup', 'row', 'bridge', 'bird', 'curl'],
];
const upperLower: [string[], string[]] = [
  ['press', 'row', 'pushup', 'curl', 'bridge', 'bird'],
  ['squat', 'split', 'bridge', 'calf', 'heel', 'bird'],
];
const filler = ['bridge', 'heel', 'bird', 'march', 'squat', 'calf', 'row'];

function repsFor(e: Exercise, profile: Profile): [number, number] {
  const [lo, hi] = e.range;
  if (!e.weighted || lo === hi) return [lo, hi];
  const mid = Math.round((lo + hi) / 2);
  const muscle = profile.goals.includes('Build muscle');
  const strength = profile.goals.includes('Get stronger');
  if (muscle && !strength) return [mid, hi];
  if (strength && !muscle) return [lo, mid];
  return [lo, hi];
}

function summaryFor(profile: Profile, areas: string[]) {
  const goals = profile.goals;
  const lead = goals.includes('Build muscle')
    ? 'Eight weeks of steady strength work, with repetitions towards the upper end of each range to build muscle.'
    : goals.includes('Get stronger')
      ? 'Eight weeks of steady strength work, with lower repetition ranges so you can use slightly heavier weights.'
      : goals.includes('Move without pain')
        ? 'Eight weeks of gentle, controlled strength work that builds support around your joints.'
        : goals.includes('Better balance and mobility')
          ? 'Eight weeks of controlled strength and balance work through comfortable ranges.'
          : 'Eight weeks of simple, full-body strength work you can do at home.';
  const length = `Sessions fit about ${profile.minutes} minutes on ${profile.days.length} ${profile.days.length === 1 ? 'day' : 'days'} a week.`;
  const care = areas.length
    ? ` Exercises that tend to aggravate ${areas.join(', ').toLowerCase()} are left out.`
    : '';
  return `${lead} ${length}${care} Start light and build gradually.`;
}

function checkInLabel(areas: string[]) {
  if (areas.length !== 1) return 'Discomfort';
  const area = areas[0];
  return area === 'Lower back'
    ? 'Back comfort'
    : `${checkInShort[area] ?? area} comfort`.slice(0, 40);
}

/** A deterministic, conservative plan from the user's equipment and limitations. Uses no AI. */
export function buildPlan(profile: Profile): Plan {
  const owned = new Set(profile.equipment);
  const areas = profile.injuries.map((i) => i.area);
  const blocked = new Set(areas.flatMap((a) => dropped[a] ?? []));
  const allowed = (id: string) => requirements[id](owned) && !blocked.has(id);

  const days = [...new Set(profile.days)].sort((a, b) => a - b);
  const count = Math.min(6, Math.max(4, Math.floor((profile.minutes - 5) / 5)));
  const [listA, listB] = days.length >= 4 ? upperLower : fullBody;

  const pick = (priority: string[]) => {
    const chosen: string[] = [];
    for (const id of [...priority, ...filler]) {
      if (chosen.length >= count) break;
      if (allowed(id) && !chosen.includes(id)) chosen.push(id);
    }
    return chosen;
  };
  const a = pick(listA);
  const b = pick(listB);
  const sameWorkout = a.length === b.length && a.every((id, i) => id === b[i]);
  const lists = sameWorkout ? [a] : [a, b];

  const base = sets[profile.experience];
  const cap = areas.includes('Lower back') ? 2 : 3;
  const setRange = { start: Math.min(base.start, cap), max: Math.min(base.max, cap) };
  const kg =
    profile.maxDumbbellKg && profile.maxDumbbellKg > 0
      ? Math.max(1, Math.round(profile.maxDumbbellKg * 0.25 * 2) / 2)
      : undefined;

  const used = [...new Set(lists.flat())];
  const planExercises: PlanExercise[] = used.map((id) => {
    const e = byId.get(id)!;
    let avoid = e.avoid;
    let equipment = e.equipment;
    if (id === 'squat' && areas.includes('Knee'))
      avoid = `Use a higher seat so your knees bend less. ${avoid}`;
    if (id === 'row' && areas.includes('Shoulder'))
      avoid = `Use a light weight and a small range. ${avoid}`;
    if (id === 'row' && !owned.has('incline-bench'))
      equipment = 'Flat bench + two dumbbells (keep the load light)';
    return {
      id,
      name: e.name,
      demo: isDemoId(id) ? id : undefined,
      group: e.group,
      equipment,
      sets: { ...setRange },
      reps: repsFor(e, profile),
      perSide: e.side,
      weighted: e.weighted,
      startKg: e.weighted ? kg : undefined,
      restSec: e.weighted ? 90 : 60,
      cue: e.cue,
      steps: e.steps,
      avoid: avoid.slice(0, 300),
      swap: e.swap,
    };
  });

  const warmup = [
    'March or walk gently for 3 minutes',
    ...(allowed('squat') ? ['6 slow sit-to-stands'] : []),
    ...(allowed('pushup') ? ['6 gentle wall push-ups'] : []),
    ...(allowed('calf') ? ['10 supported calf raises'] : []),
    'Practise your first exercise with no weight',
  ];

  const safety = [
    ...areas.map((a) => injuryNotes[a]).filter((n): n is string => !!n),
    ...areas
      .filter((a) => !injuryNotes[a])
      .map((a) => `${a}: keep ranges small and stop if it hurts.`),
    'This plan is general guidance, not medical advice. Check with a clinician first if you have a recent injury, surgery, pregnancy or a heart condition.',
    'Leave 2–3 good repetitions in reserve on every set.',
    'Stop if you feel sharp, spreading or increasing pain, dizziness or chest discomfort.',
  ];

  return planSchema.parse({
    version: 1,
    source: 'builtin',
    createdAt: Date.now(),
    title: `Your ${WEEKS}-week home strength plan`,
    summary: summaryFor({ ...profile, days }, areas),
    weeks: WEEKS,
    days,
    minutes: profile.minutes,
    exercises: planExercises,
    workouts: lists.map((ids, i) => ({
      id: 'AB'[i],
      name: `Workout ${'AB'[i]}`,
      focus:
        lists.length === 1
          ? 'Full body'
          : days.length >= 4
            ? ['Upper body and core', 'Lower body and core'][i]
            : ['Full body, session A', 'Full body, session B'][i],
      exerciseIds: ids,
    })),
    warmup,
    progression: `Sets build from ${setRange.start} to ${setRange.max} over the plan. Once you reach the top of the rep range on every set for two sessions, with controlled movement and spare repetitions, use the smallest weight increase. Never increase weight and sets in the same session.`,
    safety,
    checkInLabel: checkInLabel(areas),
  });
}
