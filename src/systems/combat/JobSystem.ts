import { state } from '../../core/GameState';
import { bus } from '../../core/EventBus';
import { JOBS } from './ClassSystem';
import { checkWeaponForJob, recalcStats } from '../items/Items';
import { outfitFor } from './Origins';

// Jobs are earned by what the player does, and can be changed anytime from the JOBS menu.
// Everyone starts as a classless Adventurer.

export type JobCounter = 'kills' | 'crits' | 'built';

export interface JobUnlock {
  id: string; // matches jobs.id in supabase/seed.sql
  how: string;
  skill: string;
  counter?: JobCounter;
  goal?: number;
  /** Unlocked by a story event instead of a counter (e.g. a lesson from an NPC). */
  manual?: boolean;
}

export const JOB_LIST: JobUnlock[] = [
  { id: 'adventurer', how: 'Your starting job.', skill: 'SKILL follows your weapon: bow = Multi Shot, sword = Slash.' },
  { id: 'warrior', how: 'Defeat 15 monsters.', skill: 'Heavy Slash: harder hits in a wider arc.', counter: 'kills', goal: 15 },
  { id: 'rogue', how: 'Land 8 critical hits.', skill: 'Quick Strikes: faster attacks, more crits. Can use bows.', counter: 'crits', goal: 8 },
  { id: 'mage', how: 'Reach level 3, then learn from Old Ezra in Oakhaven.', skill: 'Firebolt: a ranged fire spell (5 MP).', manual: true },
  { id: 'builder', how: 'Build 5 structures in town.', skill: 'Quick Repair: fix walls and towers.', counter: 'built', goal: 5 },
];

export function isUnlocked(id: string) {
  return state.jobs.unlocked.includes(id);
}

export function progressOf(j: JobUnlock): number {
  return j.counter ? Math.min(state.jobs[j.counter], j.goal ?? 0) : 0;
}

export function unlockJob(id: string) {
  if (isUnlocked(id)) return;
  state.jobs.unlocked.push(id);
  bus.emit('toast', `New job unlocked: ${JOBS[id].name}! Open JOBS to change.`);
  bus.emit('jobs-changed');
}

/** Counts an action toward job unlocks (kills, critical hits, buildings). */
export function countJobAction(counter: JobCounter) {
  state.jobs[counter]++;
  for (const j of JOB_LIST) {
    if (j.counter === counter && !isUnlocked(j.id) && state.jobs[counter] >= (j.goal ?? Infinity)) unlockJob(j.id);
  }
}

/** Switches job; stats are recomputed and HP / MP keep the same fraction of their max. */
export function changeJob(id: string) {
  const ps = state.player!;
  if (!isUnlocked(id) || ps.jobId === id) return;
  ps.jobId = id;
  ps.texture = outfitFor(ps.raceId, ps.gender, id);
  recalcStats();
  checkWeaponForJob();
  bus.emit('appearance-changed', ps.texture);
  bus.emit('toast', `You are now a ${JOBS[id].name}.`);
  bus.emit('jobs-changed');
}
