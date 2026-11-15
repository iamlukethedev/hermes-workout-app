import { describe, expect, it } from 'vitest';
import { nextMonday, schedule, setCount, weekAt } from '../src/lib/training';

describe('programme schedule', () => {
  it('finds the next Monday', () => {
    expect(nextMonday('2026-11-08')).toBe('2026-11-09');
    expect(nextMonday('2026-11-09')).toBe('2026-11-09');
  });

  it('alternates workouts A and B on Monday, Wednesday and Friday', () => {
    expect(schedule('2026-11-09', '2026-11-09')).toBe('A');
    expect(schedule('2026-11-09', '2026-11-11')).toBe('B');
    expect(schedule('2026-11-09', '2026-11-13')).toBe('A');
    expect(schedule('2026-11-09', '2026-11-16')).toBe('B');
  });

  it('returns null on rest days and outside the eight-week programme', () => {
    expect(schedule('2026-11-09', '2026-11-10')).toBeNull();
    expect(schedule('2026-11-09', '2026-11-02')).toBeNull();
    expect(schedule('2026-11-09', '2027-01-04')).toBeNull();
  });

  it('computes the programme week, clamped to 1–8', () => {
    expect(weekAt('2026-11-09', '2026-12-07')).toBe(5);
    expect(weekAt('2026-11-09', '2026-10-01')).toBe(1);
    expect(weekAt('2026-11-09', '2027-06-01')).toBe(8);
  });

  it('progresses set counts by week', () => {
    expect(setCount(1, 0)).toBe(1);
    expect(setCount(2, 0)).toBe(2);
    expect(setCount(5, 0)).toBe(3);
    expect(setCount(5, 3)).toBe(2);
  });
});
