import { state, emitStats, addItem } from '../../core/GameState';
import { bus } from '../../core/EventBus';
import { computeStats, JOBS } from '../combat/ClassSystem';

// Local mirror of the items table in supabase/seed.sql, plus which weapons each job can use
// (jobs.allowed_weapons). Equipment adds its stats on top of race x job x level.

export type Slot = 'weapon' | 'armor' | 'accessory';
export type WeaponType = 'sword' | 'dagger' | 'staff' | 'hammer' | 'bow';
type StatKey = 'hp' | 'mp' | 'atk' | 'def' | 'spd';

export interface ItemDef {
  id: string;
  name: string;
  type: Slot | 'consumable' | 'material';
  weapon?: WeaponType;
  stats?: Partial<Record<StatKey, number>>;
  heal?: { hp?: number; mp?: number };
  buy?: number; // shop price (missing = not sold)
  sell: number;
  icon: string;
  tint?: number;
  desc: string;
}

export const ITEMS: Record<string, ItemDef> = {
  rusty_sword: { id: 'rusty_sword', name: 'Rusty Sword', type: 'weapon', weapon: 'sword', stats: { atk: 4 }, buy: 30, sell: 5, icon: 'item_sword', tint: 0xc8906a, desc: 'Old, but it still cuts.' },
  iron_sword: { id: 'iron_sword', name: 'Iron Sword', type: 'weapon', weapon: 'sword', stats: { atk: 9 }, buy: 120, sell: 30, icon: 'item_sword', desc: 'A solid blade from Grom\'s forge.' },
  hunter_dagger: { id: 'hunter_dagger', name: 'Hunter Dagger', type: 'weapon', weapon: 'dagger', stats: { atk: 6, spd: 2 }, buy: 80, sell: 15, icon: 'item_dagger', desc: 'Light and quick.' },
  oak_staff: { id: 'oak_staff', name: 'Oak Staff', type: 'weapon', weapon: 'staff', stats: { atk: 3, mp: 15 }, buy: 60, sell: 10, icon: 'item_staff', desc: 'Channels magic. Mages need a staff.' },
  hunter_bow: { id: 'hunter_bow', name: 'Hunter Bow', type: 'weapon', weapon: 'bow', stats: { atk: 5 }, buy: 90, sell: 20, icon: 'item_bow', desc: 'Shoots arrows from afar.' },
  // Bree's stock in the smithy: a step up from Gus's goods.
  steel_sword: { id: 'steel_sword', name: 'Steel Sword', type: 'weapon', weapon: 'sword', stats: { atk: 14 }, buy: 320, sell: 80, icon: 'item_sword', tint: 0xcfe0f0, desc: 'Folded steel from Grom\'s forge.' },
  steel_dagger: { id: 'steel_dagger', name: 'Steel Dagger', type: 'weapon', weapon: 'dagger', stats: { atk: 10, spd: 3 }, buy: 260, sell: 60, icon: 'item_dagger', tint: 0xcfe0f0, desc: 'Thin, quick and wicked sharp.' },
  yew_bow: { id: 'yew_bow', name: 'Yew Bow', type: 'weapon', weapon: 'bow', stats: { atk: 9 }, buy: 280, sell: 70, icon: 'item_bow', tint: 0xe0b070, desc: 'A strong bow of old yew.' },
  crystal_staff: { id: 'crystal_staff', name: 'Crystal Staff', type: 'weapon', weapon: 'staff', stats: { atk: 6, mp: 35 }, buy: 300, sell: 75, icon: 'item_staff', tint: 0x9fe3ff, desc: 'Topped with a Core crystal. It hums.' },
  chain_mail: { id: 'chain_mail', name: 'Chain Mail', type: 'armor', stats: { def: 10 }, buy: 240, sell: 60, icon: 'item_shield', tint: 0xcfe0f0, desc: 'Heavy, but it stops a goblin blade.' },
  // Lyra's stall in the Sylvan Wood (Chapter 2), and Vaelen's gift.
  elven_bow: { id: 'elven_bow', name: 'Elven Bow', type: 'weapon', weapon: 'bow', stats: { atk: 13, spd: 1 }, buy: 560, sell: 140, icon: 'item_bow', tint: 0xb8f0a0, desc: 'Light as a leaf, strung with spider silk.' },
  leaf_mail: { id: 'leaf_mail', name: 'Leafweave Mail', type: 'armor', stats: { def: 15 }, buy: 520, sell: 130, icon: 'item_shield', tint: 0x9fd88a, desc: 'Woven bark and leaves, harder than steel.' },
  sylvan_longbow: { id: 'sylvan_longbow', name: 'Sylvan Longbow', type: 'weapon', weapon: 'bow', stats: { atk: 18, spd: 2 }, sell: 300, icon: 'item_bow', tint: 0xd0b8ff, desc: 'The Warden\'s own bow. It remembers every arrow.' },
  leather_armor: { id: 'leather_armor', name: 'Leather Armor', type: 'armor', stats: { def: 5 }, buy: 70, sell: 15, icon: 'item_shield', desc: 'Light protection.' },
  core_shard: { id: 'core_shard', name: 'Core Shard', type: 'accessory', stats: { mp: 20 }, sell: 100, icon: 'item_core_shard', desc: 'It hums faintly. Warm to the touch.' },
  health_potion: { id: 'health_potion', name: 'Health Potion', type: 'consumable', heal: { hp: 50 }, buy: 25, sell: 5, icon: 'item_health_potion', desc: 'Restores 50 HP.' },
  mana_potion: { id: 'mana_potion', name: 'Mana Potion', type: 'consumable', heal: { mp: 30 }, buy: 30, sell: 6, icon: 'item_mana_potion', desc: 'Restores 30 MP.' },
  slime_gel: { id: 'slime_gel', name: 'Slime Gel', type: 'material', sell: 2, icon: 'item_slime_gel', desc: 'Sticky. Merchants buy it.' },
  old_locket: { id: 'old_locket', name: 'Old Locket', type: 'material', sell: 0, icon: 'item_core_shard', tint: 0xd9b45a, desc: 'Found inside Gravemaw. A name is scratched on the back: "Rowan, from Hana".' },
  wolf_pelt: { id: 'wolf_pelt', name: 'Wolf Pelt', type: 'material', sell: 6, icon: 'item_wolf_pelt', desc: 'Grom wants these.' },
};

/** Weapon types each job can use. Adventurers can use anything; Mages need a staff to cast. */
export const ALLOWED: Record<string, WeaponType[]> = {
  adventurer: ['sword', 'dagger', 'staff', 'hammer', 'bow'],
  warrior: ['sword'],
  rogue: ['dagger', 'bow'],
  mage: ['staff'],
  builder: ['hammer', 'sword'],
};

export function canEquip(itemId: string, jobId = state.player!.jobId): boolean {
  const it = ITEMS[itemId];
  if (!it || (it.type !== 'weapon' && it.type !== 'armor' && it.type !== 'accessory')) return false;
  return it.type !== 'weapon' || ALLOWED[jobId]?.includes(it.weapon!) !== false;
}

/** Recomputes max stats from race, job, level and equipment; HP/MP keep their fraction. */
export function recalcStats(fullHeal = false) {
  const ps = state.player!;
  const base = computeStats(ps.raceId, ps.jobId, ps.level);
  for (const id of Object.values(state.equipment)) {
    const st = id ? ITEMS[id]?.stats : undefined;
    if (st) for (const k of Object.keys(st) as StatKey[]) base[k] += st[k]!;
  }
  const hpFrac = ps.maxHp ? ps.hp / ps.maxHp : 1, mpFrac = ps.maxMp ? ps.mp / ps.maxMp : 1;
  Object.assign(ps, { maxHp: base.hp, maxMp: base.mp, atk: base.atk, def: base.def, spd: base.spd });
  ps.hp = fullHeal ? base.hp : Math.max(1, Math.round(base.hp * hpFrac));
  ps.mp = fullHeal ? base.mp : Math.round(base.mp * mpFrac);
  emitStats();
}

export function equip(itemId: string) {
  const it = ITEMS[itemId];
  if (!canEquip(itemId)) {
    bus.emit('toast', `A ${JOBS[state.player!.jobId].name} can't use a ${it.name}.`);
    return;
  }
  if ((state.inventory.get(itemId) ?? 0) <= 0) return;
  const slot = it.type as Slot;
  const old = state.equipment[slot];
  if (old) addItem(old, 1);
  addItem(itemId, -1);
  state.equipment[slot] = itemId;
  recalcStats();
  bus.emit('equipment-changed');
}

export function unequip(slot: Slot) {
  const old = state.equipment[slot];
  if (!old) return;
  state.equipment[slot] = null;
  addItem(old, 1);
  recalcStats();
  bus.emit('equipment-changed');
}

/** Each job's main weapon type and the basic weapon a new job comes with. */
const JOB_WEAPON: Record<string, { type: WeaponType; starter: string }> = {
  adventurer: { type: 'sword', starter: 'rusty_sword' },
  warrior: { type: 'sword', starter: 'rusty_sword' },
  rogue: { type: 'bow', starter: 'hunter_bow' },
  mage: { type: 'staff', starter: 'oak_staff' },
  builder: { type: 'sword', starter: 'rusty_sword' },
};

/**
 * After a job change: switch to the best weapon of the job's main type (carried or worn), and if
 * there is none, the job comes with its basic weapon.
 */
export function checkWeaponForJob() {
  const jw = JOB_WEAPON[state.player!.jobId];
  if (!jw) return;
  const worn = state.equipment.weapon;
  // Adventurers can use anything, so they keep what they hold.
  if (worn && (ITEMS[worn].weapon === jw.type || (state.player!.jobId === 'adventurer' && canEquip(worn)))) return;
  const owned = [...state.inventory.entries()].filter(([id, n]) => n > 0 && ITEMS[id]?.weapon === jw.type).map(([id]) => id);
  const best = owned.sort((a, b) => (ITEMS[b].stats?.atk ?? 0) - (ITEMS[a].stats?.atk ?? 0))[0];
  if (!best) {
    addItem(jw.starter, 1);
    bus.emit('toast', `You received a ${ITEMS[jw.starter].name} for your new job.`);
  }
  equip(best ?? jw.starter);
}

export function weaponType(): WeaponType | null {
  const w = state.equipment.weapon;
  return w ? ITEMS[w].weapon ?? null : null;
}
