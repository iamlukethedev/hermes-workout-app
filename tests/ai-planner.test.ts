import { describe, expect, it } from 'vitest';
import { normaliseAiPlan, type AiPlan } from '../src/lib/ai-planner';
import { planSchema, type Profile } from '../src/lib/plan';

const profile: Profile = {
  experience: 'new',
  goals: [],
  injuries: [],
  equipment: [],
  days: [3, 1],
  minutes: 30,
};

type Raw = AiPlan['exercises'][number];
const exercise = (over: Partial<Raw> = {}): Raw => ({
  id: 'goblet-squat',
  name: 'Goblet squat',
  libraryId: 'none',
  group: 'Legs',
  equipment: 'Dumbbell',
  setsStart: 2,
  setsMax: 3,
  repsMin: 8,
  repsMax: 12,
  perSide: false,
  weighted: true,
  startKg: 6,
  restSec: 90,
  cue: 'Chest up.',
  steps: ['Hold the weight at your chest.', 'Sit down and stand up.'],
  avoid: 'Rounding your back.',
  swap: '',
  ...over,
});
const raw = (over: Partial<AiPlan> = {}): AiPlan => ({
  title: 'Plan',
  summary: 'A plan.',
  weeks: 8,
  days: [1, 3],
  exercises: [exercise()],
  workouts: [{ id: 'A', name: 'Workout A', focus: 'Legs', exerciseIds: ['goblet-squat'] }],
  warmup: ['March'],
  progression: 'Add reps first.',
  safety: ['Stop if it hurts.'],
  checkInLabel: 'Discomfort',
  ...over,
});

describe('normaliseAiPlan', () => {
  it('passes a well-formed plan through', () => {
    const plan = normaliseAiPlan(raw(), profile);
    expect(planSchema.safeParse(plan).success).toBe(true);
    expect(plan.source).toBe('ai');
    expect(plan.minutes).toBe(30);
    expect(plan.exercises[0].startKg).toBe(6);
    expect(plan.exercises[0].swap).toBeUndefined();
  });

  it('clamps out-of-range numbers and orders reps and sets', () => {
    const plan = normaliseAiPlan(
      raw({
        weeks: 99,
        exercises: [
          exercise({
            setsStart: 9,
            setsMax: 0,
            repsMin: 500,
            repsMax: -4,
            restSec: 5,
            startKg: 9999,
          }),
        ],
      }),
      profile,
    );
    const [e] = plan.exercises;
    expect(plan.weeks).toBe(16);
    expect(e.sets).toEqual({ start: 6, max: 6 });
    expect(e.reps).toEqual([1, 100]);
    expect(e.restSec).toBe(15);
    expect(e.startKg).toBe(200);
    expect(planSchema.safeParse(plan).success).toBe(true);
  });

  it('drops unknown exercise references and empty workouts', () => {
    const plan = normaliseAiPlan(
      raw({
        workouts: [
          { id: 'A', name: 'A', focus: '', exerciseIds: ['goblet-squat', 'ghost'] },
          { id: 'B', name: 'B', focus: '', exerciseIds: ['ghost'] },
        ],
      }),
      profile,
    );
    expect(plan.workouts).toHaveLength(1);
    expect(plan.workouts[0].exerciseIds).toEqual(['goblet-squat']);
  });

  it('keeps valid demo ids and strips invalid ones', () => {
    const plan = normaliseAiPlan(
      raw({
        exercises: [
          exercise({ id: 'a', libraryId: 'squat' }),
          exercise({ id: 'b', libraryId: 'teleport' as Raw['libraryId'] }),
          exercise({ id: 'c', libraryId: 'none' }),
        ],
        workouts: [{ id: 'A', name: 'A', focus: '', exerciseIds: ['a', 'b', 'c'] }],
      }),
      profile,
    );
    expect(plan.exercises.map((e) => e.demo)).toEqual(['squat', undefined, undefined]);
  });

  it('slugifies ids and maps duplicate references to the first exercise', () => {
    const plan = normaliseAiPlan(
      raw({
        exercises: [
          exercise({ id: 'Goblet Squat!' }),
          exercise({ id: 'goblet-squat', name: 'Second' }),
        ],
        workouts: [
          { id: 'A', name: 'A', focus: '', exerciseIds: ['Goblet Squat!', 'goblet-squat'] },
        ],
      }),
      profile,
    );
    expect(plan.exercises.map((e) => e.id)).toEqual(['goblet-squat']);
    expect(plan.workouts[0].exerciseIds).toEqual(['goblet-squat']);
  });

  it('falls back to profile days when the model gives none that are valid', () => {
    expect(normaliseAiPlan(raw({ days: [9, -1, 2.5] }), profile).days).toEqual([1, 3]);
    expect(normaliseAiPlan(raw({ days: [5, 5, 2] }), profile).days).toEqual([2, 5]);
  });

  it('truncates over-long strings and drops exercises no workout uses', () => {
    const plan = normaliseAiPlan(
      raw({
        title: 'T'.repeat(500),
        summary: 'S'.repeat(5000),
        exercises: [exercise({ cue: 'c'.repeat(900) }), exercise({ id: 'unused' })],
      }),
      profile,
    );
    expect(plan.title.length).toBeLessThanOrEqual(80);
    expect(plan.summary.length).toBeLessThanOrEqual(800);
    expect(plan.exercises).toHaveLength(1);
    expect(planSchema.safeParse(plan).success).toBe(true);
  });
});
