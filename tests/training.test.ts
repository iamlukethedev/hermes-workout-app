import { describe, expect, it } from 'vitest';
import { nextMonday } from '../src/lib/training';
import {
  classicPlan,
  exerciseById,
  exerciseName,
  planSchema,
  planWeek,
  setsFor,
  workoutOn,
  type Plan,
} from '../src/lib/plan';

const plan = classicPlan();
const sets = (week: number, id: string) => setsFor(plan, week, exerciseById(plan, id)!);

describe('classic plan', () => {
  it('is a valid plan', () => {
    expect(planSchema.parse(plan)).toEqual(plan);
  });

  it('finds the next Monday', () => {
    expect(nextMonday('2026-11-08')).toBe('2026-11-09');
    expect(nextMonday('2026-11-09')).toBe('2026-11-09');
  });

  it('alternates workouts A and B on Monday, Wednesday and Friday', () => {
    expect(workoutOn(plan, '2026-11-09', '2026-11-09')).toBe('A');
    expect(workoutOn(plan, '2026-11-09', '2026-11-11')).toBe('B');
    expect(workoutOn(plan, '2026-11-09', '2026-11-13')).toBe('A');
    expect(workoutOn(plan, '2026-11-09', '2026-11-16')).toBe('B');
  });

  it('returns null on rest days and outside the programme', () => {
    expect(workoutOn(plan, '2026-11-09', '2026-11-10')).toBeNull();
    expect(workoutOn(plan, '2026-11-09', '2026-11-02')).toBeNull();
    expect(workoutOn(plan, '2026-11-09', '2027-01-04')).toBeNull();
  });

  it('computes the programme week, clamped to the plan length', () => {
    expect(planWeek(plan, '2026-11-09', '2026-12-07')).toBe(5);
    expect(planWeek(plan, '2026-11-09', '2026-10-01')).toBe(1);
    expect(planWeek(plan, '2026-11-09', '2027-06-01')).toBe(8);
  });

  it('keeps the original set progression', () => {
    expect(sets(1, 'press')).toBe(1);
    expect(sets(2, 'press')).toBe(2);
    expect(sets(5, 'press')).toBe(3);
    expect(sets(5, 'bridge')).toBe(2);
  });
});

describe('custom plans', () => {
  const custom: Plan = {
    ...plan,
    days: [2, 4, 6],
    weeks: 4,
    workouts: [
      { id: 'A', name: 'Upper', focus: 'Upper body', exerciseIds: ['press', 'row'] },
      { id: 'B', name: 'Lower', focus: 'Lower body', exerciseIds: ['squat', 'bridge'] },
      { id: 'C', name: 'Core', focus: 'Trunk', exerciseIds: ['heel', 'bird'] },
    ],
  };

  it('rotates any number of workouts across the chosen days', () => {
    // 2026-11-10 is a Tuesday.
    const days = ['2026-11-10', '2026-11-12', '2026-11-14', '2026-11-17'];
    expect(days.map((d) => workoutOn(custom, '2026-11-10', d))).toEqual(['A', 'B', 'C', 'A']);
    expect(workoutOn(custom, '2026-11-10', '2026-11-11')).toBeNull();
  });

  it('names exercises from earlier plans', () => {
    expect(exerciseName(custom, 'press')).toBe('Dumbbell bench press');
    expect(exerciseName(undefined, 'goblet-squat')).toBe('Goblet squat');
  });
});
