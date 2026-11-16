import { describe, expect, it } from 'vitest';
import { createSampleState } from '../src/lib/sample';
import { parseState } from '../src/lib/storage';

describe('sample data', () => {
  const sample = createSampleState('2026-11-18');

  it('is a valid, deterministic log', () => {
    expect(parseState(sample)).toEqual(sample);
    expect(createSampleState('2026-11-18')).toEqual(sample);
  });

  it('starts on a Monday three weeks back and stops before today', () => {
    expect(sample.startDate).toBe('2026-10-26');
    expect(sample.sessions.every((s) => s.date < '2026-11-18')).toBe(true);
    expect(sample.sessions.map((s) => s.type).slice(0, 4)).toEqual(['A', 'B', 'A', 'B']);
  });

  it('progresses dumbbell weight over time', () => {
    const press = sample.sessions.filter((s) => s.sets.press).map((s) => s.sets.press[0].kg);
    expect(press.at(-1)!).toBeGreaterThan(press[0]);
  });
});
