import Phaser from 'phaser';
import type { MonsterDef } from '../entities/Monster';

export const MAP_W = 64;
export const MAP_H = 64;

export enum Tile {
  Grass,
  Grass2,
  Flowers,
  Path,
  Stone,
  Water,
  Bridge,
  /** Solid darkness (cave rock, the space outside a room): not drawn, can't be walked on. */
  Void,
}

export const TILE_TEXTURE: Record<Tile, string> = {
  [Tile.Grass]: 'tile_grass',
  [Tile.Grass2]: 'tile_grass',
  [Tile.Flowers]: 'tile_grass_deco',
  [Tile.Path]: 'tile_path',
  [Tile.Stone]: 'tile_stone',
  [Tile.Water]: 'tile_water',
  [Tile.Bridge]: 'tile_bridge',
  [Tile.Void]: '',
};

export interface Prop {
  kind: 'tree' | 'building' | 'deco';
  texture: string;
  x: number;
  y: number; // grid; buildings occupy 2x2 starting here
  frame?: number;
  flip?: boolean;
  light?: boolean; // casts a warm glow (torches)
}

export interface NpcDef {
  id: string;
  name: string;
  texture: string;
  x: number;
  y: number;
  /** What they do, shown under the name ("Potions", "Blacksmith"). Villagers have none and wander. */
  role?: string;
  /** Quest giver (shows ! / ?), shopkeeper (shows a bag), or teacher. */
  mark?: 'quest' | 'shop' | 'teacher';
  /** Quest this NPC gives (for the ! / ? marker). */
  quest?: string;
}

export interface SpawnZone {
  monster: MonsterDef['id'];
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  count: number;
}

/** Separate maps: the open world, and places you walk into (cave, tavern). */
export type AreaId = 'overworld' | 'cave' | 'tavern';

/** Step on it to go to another area; you arrive at `at` (grid) there. */
export interface Door {
  x: number;
  y: number; // grid (can be fractional)
  to: AreaId;
  at: { x: number; y: number };
  label: string;
}

export interface WorldData {
  id: AreaId;
  w: number;
  h: number;
  doors: Door[];
  /** Fixed light for indoor areas (the overworld follows the day/night cycle). */
  ambient?: { color: number; alpha: number };
  /** Screen background behind the map (dark for caves and rooms). */
  bg?: number;
  tiles: Tile[][];
  props: Prop[];
  blocked: boolean[][];
  playerStart: { x: number; y: number };
  npcs: NpcDef[];
  spawns: SpawnZone[];
}

/** Where you arrive inside the cave and the tavern (grid), and where you come back out. */
export const CAVE_ENTRY = { x: 7, y: 35 };
export const TAVERN_ENTRY = { x: 5, y: 8 };
export const OUTSIDE_CAVE = { x: 24.6, y: 4.4 };
export const OUTSIDE_TAVERN = { x: 19.4, y: 22.6 };

const VILLAGE = { x0: 18, y0: 18, x1: 29, y1: 29 };
/** Town grounds south-east of the village, across the bridge: the Ancient Core and the land around it. */
export const TOWN = { coreX: 51, coreY: 50, radius: 10 };

export function inTown(x: number, y: number) {
  return Math.hypot(x - (TOWN.coreX + 0.5), y - (TOWN.coreY + 0.5)) <= TOWN.radius;
}

let activeArea: AreaId = 'overworld';
/** The area being played (safe zones only exist in the overworld). */
export function setActiveArea(id: AreaId) {
  activeArea = id;
}

/** The village and the town grounds: wild monsters never come in, and stop chasing you there. */
export function isSafeTile(x: number, y: number) {
  return activeArea === 'overworld' && (inVillage(x, y) || inTown(x, y));
}
const RIVER_X = 37;

function inVillage(x: number, y: number) {
  return x >= VILLAGE.x0 - 1 && x <= VILLAGE.x1 + 1 && y >= VILLAGE.y0 - 1 && y <= VILLAGE.y1 + 1;
}

/** Deterministic starter region: village in the middle, fields around it, river to the east. */
export function buildWorld(): WorldData {
  const rnd = new Phaser.Math.RandomDataGenerator(['echoes-of-the-core']);
  const tiles: Tile[][] = [];
  const blocked: boolean[][] = [];
  for (let y = 0; y < MAP_H; y++) {
    tiles.push([]);
    blocked.push([]);
    for (let x = 0; x < MAP_W; x++) {
      const r = rnd.frac();
      tiles[y].push(r < 0.06 ? Tile.Flowers : r < 0.4 ? Tile.Grass2 : Tile.Grass);
      blocked[y].push(false);
    }
  }
  const set = (x: number, y: number, t: Tile) => {
    if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) tiles[y][x] = t;
  };

  // Village plaza.
  for (let y = VILLAGE.y0; y <= VILLAGE.y1; y++) for (let x = VILLAGE.x0; x <= VILLAGE.x1; x++) set(x, y, Tile.Stone);

  // Roads: east to the bridge, south and north out of the village.
  for (let x = VILLAGE.x1; x < MAP_W - 3; x++) set(x, 23, Tile.Path), set(x, 24, Tile.Path);
  for (let y = VILLAGE.y1; y < MAP_H - 3; y++) set(23, y, Tile.Path), set(24, y, Tile.Path);
  for (let y = 3; y < VILLAGE.y0; y++) set(23, y, Tile.Path);
  // Road from the east road down to the town grounds.
  for (let y = 24; y < TOWN.coreY - 2; y++) set(47, y, Tile.Path), set(48, y, Tile.Path);

  // River with a bridge where the east road crosses.
  for (let y = 0; y < MAP_H; y++) {
    const wobble = Math.round(Math.sin(y / 5) * 1.5);
    for (let dx = 0; dx < 3; dx++) {
      const x = RIVER_X + wobble + dx;
      const onRoad = y === 23 || y === 24;
      set(x, y, onRoad ? Tile.Bridge : Tile.Water);
      if (!onRoad) blocked[y][x] = true;
    }
  }

  const props: Prop[] = [];
  const free = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < MAP_W && y < MAP_H && !blocked[y][x] &&
    tiles[y][x] !== Tile.Path && tiles[y][x] !== Tile.Bridge && tiles[y][x] !== Tile.Water;

  // Buildings around the plaza (2x2 footprint).
  const buildings: [number, number, string, boolean][] = [
    [19, 19, 'tavern', false], [26, 19, 'house_thatch', false], [19, 26, 'blacksmith', false], [27, 27, 'house_thatch', true],
    // Outside the plaza.
    [31, 26, 'market', false], [14, 16, 'chapel', false], [9, 20, 'windmill', false], [33, 19, 'watchtower', false], [15, 31, 'house_small', true], [10, 34, 'house_red', false],
    [33, 29, 'inn', false], [17, 12, 'warehouse', false], [6, 9, 'ruins', false], [45, 19, 'tent', false], [5, 23, 'stable', false],
  ];
  for (const [hx, hy, texture, flip] of buildings) {
    props.push({ kind: 'building', texture, x: hx, y: hy, flip });
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) blocked[hy + dy][hx + dx] = true;
  }

  // Village decorations. Solid ones block movement.
  const deco = (texture: string, x: number, y: number, solid = true, extra: Partial<Prop> = {}) => {
    props.push({ kind: 'deco', texture, x, y, ...extra });
    if (solid) blocked[y][x] = true;
  };
  deco('fountain', 25, 22);
  deco('chest', 21, 21);
  deco('stall_red', 20, 23);
  deco('stall_yellow', 27, 23);
  deco('barrels', 25, 19);
  deco('crate', 29, 25);
  deco('barrel', 18, 24);
  deco('crate', 21, 19);
  deco('stall_blue', 26, 28);
  deco('stall_green', 31, 29);
  deco('cart', 30, 25);
  deco('hay_cart', 11, 22);
  deco('well', 13, 31);
  // Street lamps along the roads.
  for (const [lx, ly] of [[24, 14], [25, 33], [33, 22]]) deco('lamp', lx, ly, true, { light: true });
  for (const [tx, ty] of [[18, 18], [29, 18], [18, 29], [29, 29], [22, 18], [18, 22]]) deco('torch', tx, ty, true, { light: true });
  // Signposts where the roads leave the village.
  deco('signpost', 31, 22);
  deco('signpost', 25, 31);
  deco('signpost', 22, 16);
  // A little fenced pen west of the village.
  for (const [fx, fy, f] of [[12, 28, 0], [13, 27, 1], [15, 25, 0], [16, 24, 1]]) deco('fence', fx, fy, true, { frame: f });
  deco('gate', 14, 26);

  // The cave at the end of the north road (the way to the dungeon, later).
  props.push({ kind: 'building', texture: 'cave', x: 22, y: 1 });
  for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) blocked[1 + dy][22 + dx] = true;
  deco('crystal', 20, 3);
  deco('crystal', 26, 4);
  deco('mushroom', 21, 5, false, { frame: 1 });
  deco('mushroom', 25, 3, false);
  deco('signpost', 25, 6);

  // Farm animals and wildlife (decoration for now).
  deco('chicken', 17, 34, false);
  deco('chicken', 18, 33, false);
  deco('cow', 7, 27);
  deco('horse', 4, 26);
  deco('deer', 40, 8);
  deco('rabbit', 30, 10, false);
  deco('boar', 42, 40);
  // Goblin ruins in the north-west.
  deco('grave', 9, 12);
  deco('grave', 10, 9);
  deco('bone_pile', 8, 13, false);
  deco('stump', 12, 7);

  // The stranger's camp across the river.
  deco('campfire', 44, 22, true, { light: true });

  // Forest border, then scattered trees outside the village.
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const edge = x < 2 || y < 2 || x >= MAP_W - 2 || y >= MAP_H - 2;
      const scatter = !inVillage(x, y) && !inTown(x, y) && rnd.frac() < 0.07;
      if ((edge || scatter) && free(x, y)) {
        const pine = rnd.frac() < 0.45;
        props.push({ kind: 'tree', texture: pine ? 'pine' : 'tree', frame: rnd.between(0, pine ? 1 : 2), x, y });
        blocked[y][x] = true;
      }
    }
  }
  // Small nature details on open grass: flowers and mushrooms can be walked over; bushes and rocks block.
  for (let y = 2; y < MAP_H - 2; y++) {
    for (let x = 2; x < MAP_W - 2; x++) {
      if (inVillage(x, y) || inTown(x, y) || !free(x, y)) continue;
      const r = rnd.frac();
      if (r < 0.035) props.push({ kind: 'deco', texture: 'flowers', frame: rnd.between(0, 3), x, y });
      else if (r < 0.05) props.push({ kind: 'deco', texture: 'mushroom', frame: rnd.between(0, 1), x, y });
      else if (r < 0.07) (props.push({ kind: 'deco', texture: 'bush', frame: rnd.between(0, 2), x, y }), (blocked[y][x] = true));
      else if (r < 0.08) (props.push({ kind: 'deco', texture: 'rock', frame: rnd.between(0, 1), x, y }), (blocked[y][x] = true));
    }
  }

  // Keep the map edge solid even where roads run out.
  for (let i = 0; i < MAP_W; i++) blocked[0][i] = blocked[MAP_H - 1][i] = blocked[i][0] = blocked[i][MAP_W - 1] = true;

  const npcs: NpcDef[] = [
    // Key characters stand still where you can find them.
    { id: 'elder', name: 'Martha', texture: 'npc_martha', x: 24, y: 20, role: 'Village Elder', mark: 'quest', quest: 'main_01_slimes' },
    { id: 'smith', name: 'Grom', texture: 'npc_grom', x: 21, y: 25, role: 'Blacksmith', mark: 'quest', quest: 'guild_wolves' },
    { id: 'healer', name: 'Serena', texture: 'npc_serena', x: 26, y: 24, role: 'Potions', mark: 'shop' },
    { id: 'merchant', name: 'Gus', texture: 'npc_merchant', x: 33, y: 25, role: 'Weapons & Armor', mark: 'shop' },
    { id: 'wizard', name: 'Old Ezra', texture: 'npc_wizard', x: 18, y: 21, role: 'Mage Teacher', mark: 'teacher' },
    { id: 'guard', name: 'Cole', texture: 'npcanim_guard', x: 31, y: 22, role: 'Guard' },
    { id: 'ranger', name: 'Wren', texture: 'npc_ranger', x: 36, y: 22, role: 'Ranger' },
    { id: 'stranger', name: 'Hooded Stranger', texture: 'npc_stranger', x: 43, y: 21, role: '???' },
    // Villagers wander around their spot.
    { id: 'villager', name: 'Lena', texture: 'npcanim_villager_f', x: 22, y: 22 },
    { id: 'villager2', name: 'Hana', texture: 'npc_archer', x: 28, y: 28 },
    { id: 'villager3', name: 'Ned', texture: 'npcanim_villager_m', x: 12, y: 22 },
    { id: 'farmer', name: 'Jory', texture: 'npcanim_farmer', x: 15, y: 29 },
    { id: 'child', name: 'Pip', texture: 'npc_child', x: 25, y: 27 },
    { id: 'bard', name: 'Finn', texture: 'npc_bard', x: 22, y: 20, role: 'Bard' },
  ];
  const playerStart = { x: 24, y: 25 };

  // Clear any tree that landed on (or next to) an NPC or the start point.
  // Also keep the cave mouth visible.
  const caveArea = [[21, 1], [22, 0], [23, 0], [24, 1], [24, 2], [21, 2], [21, 3], [24, 3]].map(([x, y]) => ({ x, y }));
  // And keep trees from hiding the buildings (most of all in front of them).
  const buildingArea = buildings.flatMap(([bx, by]) => [[bx + 2, by + 2], [bx + 2, by + 1], [bx + 1, by + 2], [bx + 3, by + 3]].map(([x, y]) => ({ x, y })));
  const keepClear = [...npcs, playerStart, ...caveArea, ...buildingArea];
  const near = (p: Prop) => keepClear.some((c) => Math.abs(c.x - p.x) <= 1 && Math.abs(c.y - p.y) <= 1);
  const kept = props.filter((p) => !['tree', 'bush', 'rock'].includes(p.texture) || !near(p));
  for (const p of props) if (!kept.includes(p)) blocked[p.y][p.x] = false;

  return {
    id: 'overworld',
    w: MAP_W,
    h: MAP_H,
    doors: [
      { x: 24.2, y: 3.2, to: 'cave', at: CAVE_ENTRY, label: 'Old Cave' },
      { x: 19.8, y: 21.1, to: 'tavern', at: TAVERN_ENTRY, label: 'Tavern' },
    ],
    tiles,
    props: kept,
    blocked,
    playerStart,
    npcs,
    spawns: [
      { monster: 'slime', x0: 33, y0: 17, x1: 36, y1: 21, count: 5 },
      { monster: 'slime', x0: 10, y0: 31, x1: 20, y1: 40, count: 5 },
      { monster: 'wolf', x0: 54, y0: 12, x1: 60, y1: 26, count: 4 },
      { monster: 'slime_blue', x0: 28, y0: 36, x1: 34, y1: 43, count: 4 },
      { monster: 'goblin', x0: 4, y0: 6, x1: 12, y1: 13, count: 4 },
    ],
  };
}
