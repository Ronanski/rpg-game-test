import { state, newTown, newCycle, type PlayerStats } from './GameState';
import type { QuestState } from '../systems/quest/QuestTracker';

// Saves progress in this browser (localStorage), so a refresh or a closed tab doesn't lose it.
// Cloud saves that follow the player across devices come later, through Supabase.

const KEY = 'aethelgard.save.v1';

export interface SaveData {
  version: 1;
  savedAt: number;
  player: PlayerStats;
  inventory: [string, number][];
  storyFlags: string[];
  jobs?: typeof state.jobs; // missing in saves made before jobs existed
  equipment?: typeof state.equipment;
  town?: typeof state.town;
  cycle?: typeof state.cycle;
  quests: QuestState;
  pos: { x: number; y: number };
}

/** Quests and position are owned by the world scene; it registers how to read them. */
let snapshot: (() => { quests: QuestState; pos: { x: number; y: number } }) | null = null;

export function setSnapshotSource(fn: typeof snapshot) {
  snapshot = fn;
}

export function saveGame(): boolean {
  if (!state.player || !snapshot) return false;
  const data: SaveData = {
    version: 1,
    savedAt: Date.now(),
    player: { ...state.player },
    inventory: [...state.inventory.entries()],
    storyFlags: [...state.storyFlags],
    jobs: { ...state.jobs, unlocked: [...state.jobs.unlocked] },
    equipment: { ...state.equipment },
    town: { ...state.town, buildings: state.town.buildings.map((b) => ({ ...b })) },
    // A night in progress restarts as the end of that day (raiders aren't saved).
    cycle: state.cycle.phase === 'night' ? { ...state.cycle, phase: 'day', left: 15_000 } : { ...state.cycle },
    ...snapshot(),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    // Private windows or blocked storage: the game still plays, it just can't save.
    console.warn('save failed', e);
    return false;
  }
}

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    return data.version === 1 && data.player ? data : null;
  } catch {
    return null;
  }
}

export function deleteSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to delete if storage is blocked.
  }
}

/** Restores the global state from a save. The world scene restores quests and position itself. */
export function applySave(data: SaveData) {
  state.player = { ...data.player };
  state.inventory = new Map(data.inventory);
  state.storyFlags = new Set(data.storyFlags);
  state.jobs = data.jobs ?? { unlocked: ['adventurer'], kills: 0, crits: 0, built: 0 };
  state.equipment = data.equipment ?? { weapon: null, armor: null, accessory: null };
  state.town = data.town ?? newTown();
  state.cycle = data.cycle ?? newCycle();
  // Older saves started with a job the player never earned; keep it usable.
  if (!state.jobs.unlocked.includes(state.player.jobId)) state.jobs.unlocked.push(state.player.jobId);
}
