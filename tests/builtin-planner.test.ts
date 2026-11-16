import { describe, expect, it } from 'vitest';
import { buildPlan } from '../src/lib/builtin-planner';
import { planSchema, type Profile } from '../src/lib/plan';

const full = ['dumbbells', 'bench', 'incline-bench', 'chair', 'wall', 'support', 'mat'];
const profile = (over: Partial<Profile> = {}): Profile => ({
  experience: 'new',
  goals: [],
  injuries: [],
  equipment: full,
  days: [5, 1, 3],
  minutes: 30,
  ...over,
});
const ids = (p: Profile) => buildPlan(p).exercises.map((e) => e.id);

describe('buildPlan', () => {
  it('produces valid plans for varied profiles', () => {
    const profiles = [
      profile(),
      profile({
        experience: 'regular',
        days: [1, 2, 4, 5],
        minutes: 60,
        goals: ['Build muscle'],
        maxDumbbellKg: 20,
      }),
      profile({ experience: 'returning', days: [2], minutes: 15, goals: ['Get stronger'] }),
      profile({
        equipment: [],
        injuries: [{ area: 'Knee' }, { area: 'Shoulder' }, { area: 'Wrist / hand' }],
      }),
    ];
    for (const p of profiles) {
      const plan = buildPlan(p);
      expect(planSchema.safeParse(plan).success).toBe(true);
      expect(plan.source).toBe('builtin');
      expect(plan.weeks).toBe(8);
      for (const w of plan.workouts)
        for (const id of w.exerciseIds) expect(plan.exercises.some((e) => e.id === id)).toBe(true);
    }
  });

  it('sorts training days and alternates two workouts', () => {
    const plan = buildPlan(profile());
    expect(plan.days).toEqual([1, 3, 5]);
    expect(plan.workouts.map((w) => w.id)).toEqual(['A', 'B']);
  });

  it('scales exercise count with session length', () => {
    const short = buildPlan(profile({ minutes: 20 }));
    const long = buildPlan(profile({ minutes: 60 }));
    expect(short.workouts[0].exerciseIds.length).toBe(4);
    expect(long.workouts[0].exerciseIds.length).toBe(6);
  });

  it('removes exercises that aggravate each injury', () => {
    expect(ids(profile({ injuries: [{ area: 'Knee' }] }))).not.toContain('split');
    expect(ids(profile({ injuries: [{ area: 'Knee' }] }))).toContain('squat');
    const shoulder = ids(profile({ injuries: [{ area: 'Shoulder' }] }));
    expect(shoulder).not.toContain('press');
    expect(shoulder).not.toContain('pushup');
    expect(shoulder).toContain('row');
    const wrist = ids(profile({ injuries: [{ area: 'Wrist / hand' }] }));
    expect(wrist).not.toContain('pushup');
    expect(wrist).not.toContain('bird');
    expect(ids(profile({ injuries: [{ area: 'Hip' }] }))).not.toContain('split');
    const ankle = ids(profile({ injuries: [{ area: 'Ankle / foot' }] }));
    expect(ankle).not.toContain('calf');
    expect(ankle).not.toContain('split');
    expect(ids(profile({ injuries: [{ area: 'Elbow' }] }))).not.toContain('curl');
  });

  it('caps sets for a lower back and labels the check-in', () => {
    const plan = buildPlan(profile({ experience: 'regular', injuries: [{ area: 'Lower back' }] }));
    expect(Math.max(...plan.exercises.map((e) => e.sets.max))).toBe(2);
    expect(plan.checkInLabel).toBe('Back comfort');
    expect(buildPlan(profile({ injuries: [{ area: 'Knee' }] })).checkInLabel).toBe('Knee comfort');
    expect(buildPlan(profile({ injuries: [{ area: 'Knee' }, { area: 'Hip' }] })).checkInLabel).toBe(
      'Discomfort',
    );
    expect(plan.safety.some((s) => s.startsWith('Lower back'))).toBe(true);
  });

  it('only uses equipment the person owns', () => {
    const wall = ids(profile({ equipment: ['wall'] }));
    for (const id of ['press', 'row', 'curl', 'squat']) expect(wall).not.toContain(id);
    expect(wall).toContain('pushup');
    const dumbbellsOnly = ids(profile({ equipment: ['dumbbells'] }));
    for (const id of ['press', 'row', 'curl']) expect(dumbbellsOnly).not.toContain(id);
    expect(ids(profile({ equipment: ['dumbbells', 'chair'] }))).toContain('curl');
  });

  it('still builds a plan with no equipment', () => {
    const plan = buildPlan(
      profile({ equipment: [], injuries: [{ area: 'Wrist / hand' }, { area: 'Hip' }] }),
    );
    expect(plan.exercises.length).toBeGreaterThanOrEqual(3);
    expect(plan.exercises.every((e) => e.equipment === 'Floor' || e.equipment === 'None')).toBe(
      true,
    );
  });

  it('suggests a starting weight only when the dumbbell limit is known', () => {
    const none = buildPlan(profile());
    expect(none.exercises.every((e) => e.startKg === undefined)).toBe(true);
    const known = buildPlan(profile({ maxDumbbellKg: 10 }));
    const weighted = known.exercises.filter((e) => e.weighted);
    expect(weighted.length).toBeGreaterThan(0);
    expect(weighted.every((e) => e.startKg === 2.5)).toBe(true);
  });

  it('shifts weighted rep ranges with goals', () => {
    const rep = (goals: string[]) =>
      buildPlan(profile({ goals })).exercises.find((e) => e.id === 'press')!.reps;
    expect(rep(['Build muscle'])).toEqual([10, 12]);
    expect(rep(['Get stronger'])).toEqual([8, 10]);
    expect(rep([])).toEqual([8, 12]);
  });
});
