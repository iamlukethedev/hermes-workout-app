import * as z from 'zod/v4';
import { addDays, exercises as library, weekday, workouts as classicWorkouts } from './training';

/** Exercises that have a rigged 3D demonstration in the movement studio. */
export const DEMO_IDS = [
  'squat',
  'press',
  'row',
  'bridge',
  'heel',
  'calf',
  'split',
  'pushup',
  'bird',
  'curl',
  'march',
] as const;
export type DemoId = (typeof DEMO_IDS)[number];
export const isDemoId = (id: unknown): id is DemoId => DEMO_IDS.includes(id as DemoId);

/** Upper bound for a logged weight, in kg per dumbbell or implement. */
export const MAX_KG = 200;

export const EQUIPMENT = [
  { id: 'dumbbells', label: 'Dumbbells' },
  { id: 'bench', label: 'Flat bench' },
  { id: 'incline-bench', label: 'Adjustable / incline bench' },
  { id: 'chair', label: 'Sturdy chair' },
  { id: 'wall', label: 'Clear wall space' },
  { id: 'support', label: 'Stable support to hold (counter, rail)' },
  { id: 'mat', label: 'Exercise mat' },
  { id: 'bands', label: 'Resistance bands' },
  { id: 'kettlebell', label: 'Kettlebell' },
  { id: 'barbell', label: 'Barbell and plates' },
  { id: 'pullup-bar', label: 'Pull-up bar' },
  { id: 'cable', label: 'Cable machine' },
  { id: 'cardio', label: 'Bike, rower or treadmill' },
] as const;

export const INJURY_AREAS = [
  'Lower back',
  'Upper back / neck',
  'Shoulder',
  'Elbow',
  'Wrist / hand',
  'Hip',
  'Knee',
  'Ankle / foot',
] as const;

export const GOALS = [
  'Get stronger',
  'Build muscle',
  'Lose fat',
  'Move without pain',
  'Improve fitness',
  'Better balance and mobility',
] as const;

const num = z.number().finite();
const weekdayNum = num.int().min(0).max(6);

export const profileSchema = z.object({
  name: z.string().max(60).optional(),
  age: num.int().min(13).max(100).optional(),
  sex: z.enum(['female', 'male', 'other', 'unspecified']).optional(),
  heightCm: num.min(100).max(250).optional(),
  weightKg: num.min(30).max(300).optional(),
  experience: z.enum(['new', 'returning', 'regular']),
  goals: z.array(z.string().max(60)).max(10),
  injuries: z
    .array(z.object({ area: z.string().max(40), notes: z.string().max(500).optional() }))
    .max(12),
  healthNotes: z.string().max(1000).optional(),
  equipment: z.array(z.string().max(40)).max(30),
  maxDumbbellKg: num.min(0).max(MAX_KG).optional(),
  equipmentNotes: z.string().max(500).optional(),
  days: z.array(weekdayNum).min(1).max(7),
  minutes: num.int().min(10).max(120),
});
export type Profile = z.infer<typeof profileSchema>;

export const planExerciseSchema = z.object({
  id: z.string().min(1).max(60),
  name: z.string().min(1).max(80),
  demo: z.enum(DEMO_IDS).optional(),
  group: z.string().max(40),
  equipment: z.string().max(120),
  sets: z.object({ start: num.int().min(1).max(6), max: num.int().min(1).max(6) }),
  reps: z.tuple([num.int().min(1).max(100), num.int().min(1).max(100)]),
  perSide: z.boolean().optional(),
  weighted: z.boolean().optional(),
  startKg: num.min(0).max(MAX_KG).optional(),
  restSec: num.int().min(15).max(300),
  cue: z.string().max(200),
  steps: z.array(z.string().max(300)).min(1).max(8),
  avoid: z.string().max(300),
  swap: z.string().max(300).optional(),
});
export type PlanExercise = z.infer<typeof planExerciseSchema>;

export const planSchema = z.object({
  version: z.literal(1),
  source: z.enum(['ai', 'builtin', 'classic']),
  createdAt: num,
  title: z.string().max(80),
  summary: z.string().max(800),
  weeks: num.int().min(2).max(16),
  days: z.array(weekdayNum).min(1).max(7),
  minutes: num.int().min(10).max(120),
  exercises: z.array(planExerciseSchema).min(1).max(40),
  workouts: z
    .array(
      z.object({
        id: z.string().min(1).max(12),
        name: z.string().max(60),
        focus: z.string().max(120),
        exerciseIds: z.array(z.string().max(60)).min(1).max(12),
      }),
    )
    .min(1)
    .max(7),
  warmup: z.array(z.string().max(200)).max(10),
  progression: z.string().max(800),
  safety: z.array(z.string().max(300)).max(12),
  checkInLabel: z.string().max(40),
});
export type Plan = z.infer<typeof planSchema>;
export type Workout = Plan['workouts'][number];

export const exerciseById = (plan: Plan, id: string) => plan.exercises.find((e) => e.id === id);
export const workoutById = (plan: Plan, id: string) => plan.workouts.find((w) => w.id === id);
export const workoutExercises = (plan: Plan, workout: Workout) =>
  workout.exerciseIds.map((id) => exerciseById(plan, id)).filter((e): e is PlanExercise => !!e);

/** Programme week (1-based) for a date, clamped to the plan length. */
export function planWeek(plan: Plan, start: string, date: string) {
  const w = Math.floor((Date.parse(date) - Date.parse(start)) / 604_800_000) + 1;
  return Math.max(1, Math.min(plan.weeks, w));
}

/**
 * Which workout falls on a date, or null for a rest day. Workouts rotate in order across the
 * plan's training days, counting from the programme start.
 */
export function workoutOn(plan: Plan, start: string, date: string): string | null {
  if (date < start || date >= addDays(start, plan.weeks * 7)) return null;
  if (!plan.days.includes(weekday(date))) return null;
  let index = 0;
  for (let d = start; d < date; d = addDays(d, 1)) if (plan.days.includes(weekday(d))) index++;
  return plan.workouts[index % plan.workouts.length].id;
}

/** Sets for an exercise in a given week: start in week 1, build to max by the second half. */
export function setsFor(plan: Plan, week: number, exercise: PlanExercise) {
  const { start, max } = exercise.sets;
  if (week <= 1) return start;
  if (week > Math.ceil(plan.weeks / 2)) return Math.max(start, max);
  return Math.min(start + 1, Math.max(start, max));
}

/** First training day on or after `date`. */
export function nextTrainingDay(plan: Plan, date: string) {
  for (let i = 0; i < 7; i++) {
    const d = addDays(date, i);
    if (plan.days.includes(weekday(d))) return d;
  }
  return date;
}

/** The original eight-week dumbbell programme, kept for existing logs and as a reference plan. */
export function classicPlan(): Plan {
  const firstThree = new Set([...classicWorkouts.A.slice(0, 3), ...classicWorkouts.B.slice(0, 3)]);
  return {
    version: 1,
    source: 'classic',
    createdAt: 0,
    title: 'Back-friendly dumbbell foundations',
    summary:
      'Eight weeks of three full-body sessions a week with a pair of dumbbells, a bench and bodyweight. Start light, build to two and then three sets, and add repetitions before weight.',
    weeks: 8,
    days: [1, 3, 5],
    minutes: 30,
    exercises: library.map((e) => ({
      id: e.id,
      name: e.name,
      demo: isDemoId(e.id) ? e.id : undefined,
      group: e.group,
      equipment: e.equipment,
      sets: { start: 1, max: firstThree.has(e.id) ? 3 : 2 },
      reps: e.range,
      perSide: e.side,
      weighted: e.weighted,
      restSec: 90,
      cue: e.cue,
      steps: e.steps,
      avoid: e.avoid,
      swap: e.swap,
    })),
    workouts: [
      {
        id: 'A',
        name: 'Workout A',
        focus: 'Full body foundations',
        exerciseIds: classicWorkouts.A,
      },
      {
        id: 'B',
        name: 'Workout B',
        focus: 'Full body foundations',
        exerciseIds: classicWorkouts.B,
      },
    ],
    warmup: [
      'Walk or march gently for 3 minutes',
      '8 comfortable sit-to-stands',
      '8 gentle wall push-ups',
      '10 supported calf raises',
      'Practise your first exercise with no weight',
    ],
    progression:
      'Reach the top of your rep range on every set for two sessions, with controlled movement and spare repetitions, then use the smallest weight increase. Never increase weight and sets in the same session.',
    safety: [
      'Leave 2–3 good repetitions in reserve on every set.',
      'Stop if you feel sharp, spreading or increasing pain.',
    ],
    checkInLabel: 'Back comfort',
  };
}

/** Display name for a logged exercise id, even if it came from an earlier plan. */
export function exerciseName(plan: Plan | undefined, id: string) {
  return (
    plan?.exercises.find((e) => e.id === id)?.name ??
    library.find((e) => e.id === id)?.name ??
    id.replace(/[-_]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
  );
}
