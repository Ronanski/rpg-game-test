import { bus } from './EventBus';

export interface PlayerStats {
  name: string;
  gender: 'male' | 'female';
  raceId: string;
  jobId: string;
  texture: string;
  level: number;
  exp: number;
  expToNext: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  atk: number;
  def: number;
  spd: number;
  gold: number;
}

/** Input written by the UI (virtual joystick / buttons) and keyboard, read by the world. */
export interface ControlState {
  moveX: number; // -1..1 screen space
  moveY: number;
  attack: boolean; // consumed by the world on read
  talk: boolean;
  potion: boolean;
}

/** Shared runtime state. Persistent parts are mirrored to Supabase via services/api. */
export const state = {
  online: false,
  player: null as PlayerStats | null,
  controls: { moveX: 0, moveY: 0, attack: false, talk: false, potion: false } as ControlState,
  inDialogue: false,
  inventory: new Map<string, number>(),
  storyFlags: new Set<string>(),
  /** Earned jobs and the counters that earn them (see systems/combat/JobSystem). */
  jobs: { unlocked: ['adventurer'] as string[], kills: 0, crits: 0, built: 0 },
  /** True while a full-screen menu (e.g. JOBS) is open; the world pauses input like dialogue. */
  inMenu: false,
};

export function resetJobs() {
  state.jobs = { unlocked: ['adventurer'], kills: 0, crits: 0, built: 0 };
}

export function emitStats() {
  if (state.player) bus.emit('player-stats', state.player);
}

export function addItem(id: string, qty = 1) {
  state.inventory.set(id, (state.inventory.get(id) ?? 0) + qty);
  bus.emit('inventory-changed');
}
