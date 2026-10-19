import Phaser from 'phaser';

export const MAP_W = 48;
export const MAP_H = 48;

export enum Tile {
  Grass,
  Grass2,
  Flowers,
  Path,
  Stone,
  Water,
  Bridge,
}

export const TILE_TEXTURE: Record<Tile, string> = {
  [Tile.Grass]: 'tile_grass',
  [Tile.Grass2]: 'tile_grass2',
  [Tile.Flowers]: 'tile_flowers',
  [Tile.Path]: 'tile_path',
  [Tile.Stone]: 'tile_stone',
  [Tile.Water]: 'tile_water',
  [Tile.Bridge]: 'tile_bridge',
};

export interface Prop {
  kind: 'tree' | 'house';
  x: number;
  y: number; // grid; houses occupy 2x2 starting here
}

export interface NpcDef {
  id: string;
  name: string;
  texture: string;
  x: number;
  y: number;
}

export interface SpawnZone {
  monster: 'slime' | 'wolf';
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  count: number;
}

export interface WorldData {
  tiles: Tile[][];
  props: Prop[];
  blocked: boolean[][];
  playerStart: { x: number; y: number };
  npcs: NpcDef[];
  spawns: SpawnZone[];
}

const VILLAGE = { x0: 18, y0: 18, x1: 29, y1: 29 };
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

  // Houses around the plaza (2x2 footprint).
  for (const [hx, hy] of [[19, 19], [26, 19], [19, 26], [27, 27]]) {
    props.push({ kind: 'house', x: hx, y: hy });
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) blocked[hy + dy][hx + dx] = true;
  }

  // Forest border, then scattered trees outside the village.
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const edge = x < 2 || y < 2 || x >= MAP_W - 2 || y >= MAP_H - 2;
      const scatter = !inVillage(x, y) && rnd.frac() < 0.07;
      if ((edge || scatter) && free(x, y)) {
        props.push({ kind: 'tree', x, y });
        blocked[y][x] = true;
      }
    }
  }
  // Keep the map edge solid even where roads run out.
  for (let i = 0; i < MAP_W; i++) blocked[0][i] = blocked[MAP_H - 1][i] = blocked[i][0] = blocked[i][MAP_W - 1] = true;

  const npcs: NpcDef[] = [
    { id: 'elder', name: 'Elder Maren', texture: 'npc_elder', x: 23, y: 21 },
    { id: 'smith', name: 'Toma the Smith', texture: 'npc_smith', x: 21, y: 25 },
    { id: 'stranger', name: 'Hooded Stranger', texture: 'npc_stranger', x: 43, y: 21 },
  ];
  const playerStart = { x: 24, y: 24 };

  // Clear any tree that landed on (or next to) an NPC or the start point.
  const keepClear = [...npcs, playerStart];
  const near = (p: Prop) => keepClear.some((c) => Math.abs(c.x - p.x) <= 1 && Math.abs(c.y - p.y) <= 1);
  const kept = props.filter((p) => p.kind === 'house' || !near(p));
  for (const p of props) if (!kept.includes(p)) blocked[p.y][p.x] = false;

  return {
    tiles,
    props: kept,
    blocked,
    playerStart,
    npcs,
    spawns: [
      { monster: 'slime', x0: 29, y0: 8, x1: 35, y1: 17, count: 5 },
      { monster: 'slime', x0: 10, y0: 31, x1: 20, y1: 40, count: 5 },
      { monster: 'wolf', x0: 41, y0: 28, x1: 45, y1: 42, count: 4 },
    ],
  };
}
