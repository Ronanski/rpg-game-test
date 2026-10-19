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
  dodge: boolean;
  skill: boolean;
}

/** A building the player placed in town. Times are real-world epoch ms, so timers survive reloads. */
export interface PlacedBuilding {
  id: number;
  type: string; // key in systems/town/Buildings
  level: number;
  x: number; // grid tile (top corner of the footprint)
  y: number;
  status: 'building' | 'upgrading' | 'idle';
  /** Damage taken (missing = full health). */
  hp?: number;
  endsAt: number;
  lastCollected: number;
}

/** Day/night cycle: which day, the phase, and ms left in it (game time; paused while away). */
export function newCycle() {
  return { day: 1, phase: 'day' as 'day' | 'night', left: 150_000 };
}

export function newTown() {
  return { wood: 20, stone: 0, mana: 0, buildings: [] as PlacedBuilding[], nextId: 1 };
}

/** Shared runtime state. Persistent parts are mirrored to Supabase via services/api. */
export const state = {
  online: false,
  player: null as PlayerStats | null,
  controls: { moveX: 0, moveY: 0, attack: false, talk: false, potion: false, dodge: false, skill: false } as ControlState,
  inDialogue: false,
  inventory: new Map<string, number>(),
  storyFlags: new Set<string>(),
  /** Earned jobs and the counters that earn them (see systems/combat/JobSystem). */
  jobs: { unlocked: ['adventurer'] as string[], kills: 0, crits: 0, built: 0 },
  /** Worn items by slot (item ids from systems/items/Items). */
  equipment: { weapon: null, armor: null, accessory: null } as Record<'weapon' | 'armor' | 'accessory', string | null>,
  /** Town resources (gold is on the player) and placed buildings. */
  town: newTown(),
  cycle: newCycle(),
  /** Recharge timers the HUD draws on the SKILL and DODGE buttons (game time, ms). */
  cooldowns: { skillReady: 0, skillTotal: 1, dodgeReady: 0, dodgeTotal: 1 },
  /** Build mode: camera over the town, grid shown, hero stands still. */
  buildMode: false,
  /** AUTO: the hero attacks the nearest monster in reach by itself. */
  autoAttack: (() => {
    try {
      return localStorage.getItem('aethelgard.auto') !== '0';
    } catch {
      return true;
    }
  })(),
  /** True while a full-screen menu (e.g. JOBS) is open; the world pauses input like dialogue. */
  inMenu: false,
};

export function resetEquipment() {
  state.equipment = { weapon: null, armor: null, accessory: null };
}

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
