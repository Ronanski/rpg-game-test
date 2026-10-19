// Local mirror of building_types in supabase/seed.sql: costs, build times, and what each level does.
// Times are real seconds; generator output is per hour (`per` seconds), capped by `cap`.

export type Resource = 'gold' | 'wood' | 'stone' | 'mana';
export type Cost = Partial<Record<Resource, number>>;

export interface LevelDef {
  cost: Cost;
  seconds: number;
  hp: number;
  attack?: { dmg: number; range: number; rate: number }; // range in tiles, rate in shots per second
  produces?: Partial<Record<Resource, number>>;
  per?: number;
  cap?: number;
}

export interface BuildingDef {
  id: string;
  name: string;
  category: 'utility' | 'wall' | 'tower' | 'trap' | 'generator';
  size: 1 | 2; // footprint in tiles (size x size)
  /** Walls and towers block movement; traps and fields can be walked over. */
  solid: boolean;
  /** Sprite per level (the last one repeats). */
  sprites: string[];
  desc: string;
  levels: LevelDef[];
  /** Hidden from the build menu (the Core is there from the start). */
  unique?: boolean;
}

export const BUILDINGS: Record<string, BuildingDef> = {
  ancient_core: {
    id: 'ancient_core', name: 'Ancient Core', category: 'utility', size: 2, solid: true, unique: true,
    sprites: ['b_core'], desc: 'The heart of the town. Build within its light.',
    levels: [
      { cost: { gold: 0 }, seconds: 0, hp: 2000 },
      { cost: { gold: 800, stone: 400, mana: 100 }, seconds: 1800, hp: 3000 },
      { cost: { gold: 2000, stone: 1000, mana: 400 }, seconds: 7200, hp: 4500 },
    ],
  },
  builder_hut: {
    id: 'builder_hut', name: "Builder's Hut", category: 'utility', size: 2, solid: true,
    sprites: ['house_small'], desc: 'Home of one builder. Each builder works on one building at a time.',
    levels: [{ cost: { gold: 0 }, seconds: 0, hp: 300 }],
  },
  wooden_wall: {
    id: 'wooden_wall', name: 'Wall', category: 'wall', size: 1, solid: true,
    sprites: ['fence', 'fence', 'b_stone_wall'], desc: 'Blocks monsters. Level 3 is stone.',
    levels: [
      { cost: { wood: 10 }, seconds: 5, hp: 150 },
      { cost: { wood: 25, stone: 10 }, seconds: 30, hp: 300 },
      { cost: { stone: 60 }, seconds: 120, hp: 600 },
    ],
  },
  arrow_tower: {
    id: 'arrow_tower', name: 'Arrow Tower', category: 'tower', size: 1, solid: true,
    sprites: ['b_tower'], desc: 'Shoots monsters in range.',
    levels: [
      { cost: { gold: 50, wood: 40 }, seconds: 30, hp: 200, attack: { dmg: 8, range: 4, rate: 1.0 } },
      { cost: { gold: 120, wood: 80 }, seconds: 180, hp: 300, attack: { dmg: 14, range: 5, rate: 1.2 } },
      { cost: { gold: 300, stone: 150 }, seconds: 900, hp: 450, attack: { dmg: 22, range: 5, rate: 1.5 } },
    ],
  },
  spike_trap: {
    id: 'spike_trap', name: 'Spike Trap', category: 'trap', size: 1, solid: false,
    sprites: ['b_spikes'], desc: 'Hurts monsters that step on it.',
    levels: [
      { cost: { wood: 20, stone: 10 }, seconds: 10, hp: 50, attack: { dmg: 20, range: 0, rate: 0.5 } },
      { cost: { stone: 40 }, seconds: 120, hp: 80, attack: { dmg: 35, range: 0, rate: 0.5 } },
    ],
  },
  lumber_mill: {
    id: 'lumber_mill', name: 'Lumber Mill', category: 'generator', size: 2, solid: true,
    sprites: ['warehouse'], desc: 'Makes wood over time.',
    levels: [
      { cost: { gold: 40 }, seconds: 20, hp: 200, produces: { wood: 60 }, per: 3600, cap: 300 },
      { cost: { gold: 120, wood: 50 }, seconds: 300, hp: 300, produces: { wood: 120 }, per: 3600, cap: 700 },
      { cost: { gold: 300, stone: 100 }, seconds: 1200, hp: 400, produces: { wood: 220 }, per: 3600, cap: 1500 },
    ],
  },
  stone_mine: {
    id: 'stone_mine', name: 'Stone Mine', category: 'generator', size: 2, solid: true,
    sprites: ['b_mine'], desc: 'Digs up stone over time.',
    levels: [
      { cost: { gold: 60, wood: 30 }, seconds: 30, hp: 250, produces: { stone: 40 }, per: 3600, cap: 200 },
      { cost: { gold: 150, wood: 80 }, seconds: 400, hp: 350, produces: { stone: 90 }, per: 3600, cap: 500 },
      { cost: { gold: 350, wood: 200 }, seconds: 1500, hp: 450, produces: { stone: 160 }, per: 3600, cap: 1100 },
    ],
  },
  farm: {
    id: 'farm', name: 'Farm', category: 'generator', size: 2, solid: false,
    sprites: ['b_farm'], desc: 'Grows crops you sell for gold.',
    levels: [
      { cost: { wood: 30 }, seconds: 20, hp: 150, produces: { gold: 50 }, per: 3600, cap: 250 },
      { cost: { gold: 80, wood: 80 }, seconds: 300, hp: 220, produces: { gold: 110 }, per: 3600, cap: 600 },
      { cost: { gold: 200, wood: 200 }, seconds: 1200, hp: 300, produces: { gold: 200 }, per: 3600, cap: 1200 },
    ],
  },
  mana_extractor: {
    id: 'mana_extractor', name: 'Mana Extractor', category: 'generator', size: 1, solid: true,
    sprites: ['b_extractor'], desc: 'Draws mana from the Core\'s light.',
    levels: [
      { cost: { gold: 300, stone: 150 }, seconds: 600, hp: 200, produces: { mana: 15 }, per: 3600, cap: 80 },
      { cost: { gold: 700, stone: 350 }, seconds: 2400, hp: 300, produces: { mana: 35 }, per: 3600, cap: 200 },
    ],
  },
};

/** Builder's Huts cost more for each one you already have (the first one is free). Max 3. */
export const HUT_COSTS: Cost[] = [{ gold: 0 }, { gold: 250, wood: 100 }, { gold: 1000, stone: 300 }];

/** How many builders the town has, and how many are not working on anything. */
export function builders(list: { type: string; status: string }[]) {
  const total = list.filter((b) => b.type === 'builder_hut').length;
  const busy = list.filter((b) => b.status !== 'idle').length;
  return { total, free: total - busy };
}

/** Cost to place a new building (Builder's Huts get pricier); null when no more can be built. */
export function placeCost(def: BuildingDef, list: { type: string }[]): Cost | null {
  if (def.id !== 'builder_hut') return def.levels[0].cost;
  return HUT_COSTS[list.filter((b) => b.type === 'builder_hut').length] ?? null;
}

export function spriteFor(def: BuildingDef, level: number) {
  return def.sprites[Math.min(level, def.sprites.length) - 1];
}

export function costText(c: Cost) {
  const parts = (Object.entries(c) as [Resource, number][]).filter(([, n]) => n > 0).map(([r, n]) => `${n} ${r}`);
  return parts.length ? parts.join(', ') : 'free';
}

export function timeText(sec: number) {
  if (sec < 60) return `${Math.ceil(sec)}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${Math.ceil(sec % 60)}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}
