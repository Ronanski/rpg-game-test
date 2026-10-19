// Local mirror of the race / job catalog in supabase/seed.sql, used to compute stats
// in real time. The database stays the source of truth for unlocks and progress.

export interface BaseStats {
  hp: number;
  mp: number;
  atk: number;
  def: number;
  spd: number;
}

export const RACES: Record<string, BaseStats> = {
  human: { hp: 100, mp: 30, atk: 10, def: 10, spd: 10 },
  beastkin: { hp: 110, mp: 15, atk: 13, def: 9, spd: 12 },
  elf: { hp: 85, mp: 50, atk: 8, def: 8, spd: 13 },
  dwarf: { hp: 120, mp: 20, atk: 11, def: 14, spd: 7 },
  demonkin: { hp: 95, mp: 40, atk: 13, def: 8, spd: 11 },
};

export interface JobDef {
  name: string;
  parent?: string;
  mods: Partial<Record<keyof BaseStats, number>>;
}

export const JOBS: Record<string, JobDef> = {
  // Everyone starts classless; jobs are earned in play.
  adventurer: { name: 'Adventurer', mods: {} },
  warrior: { name: 'Warrior', mods: { hp: 1.2, atk: 1.1 } },
  mage: { name: 'Mage', mods: { mp: 1.4, def: 0.9 } },
  rogue: { name: 'Rogue', mods: { spd: 1.25, atk: 1.05 } },
  warrior_knight: { name: 'Knight', parent: 'warrior', mods: { def: 1.3, hp: 1.2 } },
  warrior_paladin: { name: 'Paladin', parent: 'warrior', mods: { def: 1.2, mp: 1.3 } },
  warrior_berserker: { name: 'Berserker', parent: 'warrior', mods: { atk: 1.4, def: 0.8 } },
  warrior_shield_master: { name: 'Shield Master', parent: 'warrior', mods: { hp: 1.4, def: 1.5 } },
};

/** Stats per level: +8% of base per level above 1, then job multipliers. */
export function computeStats(raceId: string, jobId: string, level: number): BaseStats {
  const base = RACES[raceId];
  const mods = JOBS[jobId].mods;
  const grow = 1 + (level - 1) * 0.08;
  const stat = (k: keyof BaseStats) => Math.round(base[k] * grow * (mods[k] ?? 1));
  return { hp: stat('hp'), mp: stat('mp'), atk: stat('atk'), def: stat('def'), spd: stat('spd') };
}

export function expToNext(level: number): number {
  return Math.round(40 * Math.pow(level, 1.5));
}
