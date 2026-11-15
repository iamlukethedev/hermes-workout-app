import { z } from 'zod';
import { initialState, MAX_KG, type State } from './training';

/** localStorage key holding the full training log. */
export const STORAGE_KEY = 'hermes-workout:state';

const num = z.number().finite();
const setLog = z.object({
  kg: num.min(0).max(MAX_KG),
  reps: num.int().min(0).max(100),
  done: z.boolean(),
});
const session = z.object({
  id: z.string().max(100),
  date: z.string().max(30),
  type: z.enum(['A', 'B']),
  week: num.int().min(1).max(8),
  startedAt: num,
  finishedAt: num.optional(),
  sleep: num.min(0).max(24),
  backBefore: num.min(0).max(10),
  backAfter: num.min(0).max(10).optional(),
  backNext: num.min(0).max(10).optional(),
  energy: num.min(1).max(5).optional(),
  notes: z.string().max(2000).optional(),
  sets: z.record(z.string(), z.array(setLog).max(3)),
});
export const stateSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sessions: z.array(session).max(5000),
  draft: session.nullable(),
  walks: z
    .array(
      z.object({ id: z.string().max(100), date: z.string().max(30), minutes: num.min(1).max(300) }),
    )
    .max(10000),
  name: z.string().max(60).optional(),
});

/** Parse and validate an unknown value as a training log. Throws a readable error on failure. */
export function parseState(value: unknown): State {
  const result = stateSchema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(
      `This file is not a valid Hermes Workout backup (${issue.path.join('.') || 'root'}: ${issue.message}).`,
    );
  }
  return result.data;
}

/** Load the saved log, falling back to a fresh programme if nothing valid is stored. */
export function loadState(storage: Pick<Storage, 'getItem'> = localStorage): {
  state: State;
  error?: string;
} {
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return {
      state: initialState(),
      error: 'Browser storage is unavailable, so changes will not be kept after reloading.',
    };
  }
  if (!raw) return { state: initialState() };
  try {
    return { state: parseState(JSON.parse(raw)) };
  } catch {
    return {
      state: initialState(),
      error: 'Your saved log could not be read. Import a backup to restore it.',
    };
  }
}

/** Persist the log. Returns false if the browser refused to store it (e.g. private mode, quota). */
export function saveState(state: State, storage: Pick<Storage, 'setItem'> = localStorage): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
