import { addDays, weekday, type Session, type State } from './training';
import {
  classicPlan,
  planWeek,
  setsFor,
  workoutById,
  workoutExercises,
  workoutOn,
  type Plan,
} from './plan';

/** Small seeded PRNG so the sample log is the same on every load. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const startingKg: Record<string, number> = { press: 6, row: 7, curl: 4 };
const DEFAULT_KG = 5;

/**
 * A realistic three-week log ending yesterday, for exploring the app without
 * training first. The programme starts on the Monday three weeks before `today`.
 */
export function createSampleState(today: string, plan: Plan = classicPlan()): State {
  const rand = mulberry32(20261116);
  const between = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const thisMonday = addDays(today, -((weekday(today) + 6) % 7));
  const startDate = addDays(thisMonday, -21);
  const sessions: Session[] = [];
  const walks: State['walks'] = [];
  const done: Record<string, number> = {};

  for (let date = startDate; date < today; date = addDays(date, 1)) {
    const type = workoutOn(plan, startDate, date);
    if (!type) {
      if (rand() < 0.75)
        walks.push({ id: `sample-walk-${date}`, date, minutes: 5 * between(3, 8) });
      continue;
    }
    const week = planWeek(plan, startDate, date);
    const sets: Session['sets'] = {};
    workoutExercises(plan, workoutById(plan, type)!).forEach((ex) => {
      const sessionsDone = (done[ex.id] = (done[ex.id] ?? 0) + 1) - 1;
      const base = ex.startKg || startingKg[ex.demo ?? ''] || DEFAULT_KG;
      const kg = ex.weighted ? base + Math.floor(sessionsDone / 2) : 0;
      sets[ex.id] = Array.from({ length: setsFor(plan, week, ex) }, () => ({
        kg,
        reps: between(ex.reps[0], ex.reps[1]),
        done: true,
      }));
    });
    const startedAt = Date.parse(`${date}T06:10:00`);
    sessions.push({
      id: `sample-${date}`,
      date,
      type,
      week,
      startedAt,
      finishedAt: startedAt + between(22, 31) * 60_000,
      sleep: 6.5 + between(0, 4) * 0.5,
      backBefore: 0,
      backAfter: between(0, 1),
      backNext: 0,
      energy: between(3, 5),
      sets,
    });
  }
  return { startDate, sessions, draft: null, walks, plan };
}
