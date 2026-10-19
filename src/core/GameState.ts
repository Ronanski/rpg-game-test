import { bus } from './EventBus';

export interface PlayerStats {
  name: string;
  starterId: string;
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
};

export function emitStats() {
  if (state.player) bus.emit('player-stats', state.player);
}

export function addItem(id: string, qty = 1) {
  state.inventory.set(id, (state.inventory.get(id) ?? 0) + qty);
  bus.emit('inventory-changed');
}
