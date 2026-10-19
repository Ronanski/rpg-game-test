import { state, type PlayerStats } from './GameState';
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
}
