import { describe, expect, it } from 'vitest';
import { loadState, parseState, saveState, STORAGE_KEY } from '../src/lib/storage';
import { initialState, type State } from '../src/lib/training';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
}

const sample: State = {
  startDate: '2026-11-09',
  sessions: [
    {
      id: 's1',
      date: '2026-11-09',
      type: 'A',
      week: 1,
      startedAt: 1,
      finishedAt: 2,
      sleep: 8,
      backBefore: 0,
      backAfter: 1,
      energy: 4,
      sets: { press: [{ kg: 7.5, reps: 10, done: true }] },
    },
  ],
  draft: null,
  walks: [{ id: 'w1', date: '2026-11-10', minutes: 25 }],
  name: 'Alex',
};

describe('storage', () => {
  it('round-trips a log through storage', () => {
    const storage = memoryStorage();
    expect(saveState(sample, storage)).toBe(true);
    expect(loadState(storage)).toEqual({ state: sample });
  });

  it('starts a fresh programme when nothing is stored', () => {
    const { state, error } = loadState(memoryStorage());
    expect(error).toBeUndefined();
    expect(state).toEqual(initialState());
  });

  it('reports corrupt data instead of throwing', () => {
    const { state, error } = loadState(memoryStorage({ [STORAGE_KEY]: '{not json' }));
    expect(error).toMatch(/could not be read/);
    expect(state.sessions).toEqual([]);
  });

  it('reports when storage throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
    };
    expect(loadState(broken).error).toMatch(/unavailable/);
    const full = {
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(saveState(sample, full)).toBe(false);
  });

  it('rejects invalid backups with a readable message', () => {
    expect(() => parseState({ ...sample, startDate: 'tomorrow' })).toThrow(/startDate/);
    expect(() => parseState(null)).toThrow(/not a valid Hermes Workout backup/);
  });
});
