import Phaser from 'phaser';
import {
  buildWorld, CAVE_ENTRY, OUTSIDE_CAVE, OUTSIDE_SMITHY, OUTSIDE_TAVERN, SMITHY_ENTRY, TAVERN_ENTRY, Tile,
  type AreaId, type NpcDef, type Prop, type WorldData,
} from './worldData';

/** Builds the map for an area. */
export function buildArea(id: AreaId): WorldData {
  if (id === 'cave') return buildCave();
  if (id === 'tavern') return buildTavern();
  if (id === 'smithy') return buildSmithy();
  return buildWorld();
}

/** An empty area: all darkness, nothing walkable, until rooms are carved out of it. */
function blank(w: number, h: number) {
  const tiles: Tile[][] = Array.from({ length: h }, () => Array<Tile>(w).fill(Tile.Void));
  const blocked: boolean[][] = Array.from({ length: h }, () => Array<boolean>(w).fill(true));
  const floor = (x: number, y: number, t: Tile) => {
    if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) return;
    tiles[y][x] = t;
    blocked[y][x] = false;
  };
  return { tiles, blocked, floor };
}

// The cave under the north mountain: entrance hall, the slime grotto, the bone hall, and Gravemaw's
// pit at the bottom. Grid points of each chamber (centre and radius).
const CAVE_W = 30, CAVE_H = 42;
const HALL = { x: 7, y: 34, r: 4 };
const GROTTO = { x: 9, y: 22, r: 5 };
const BONES = { x: 21, y: 18, r: 4 };
export const PIT = { x: 15, y: 7, r: 5 };

function buildCave(): WorldData {
  const rnd = new Phaser.Math.RandomDataGenerator(['old-cave']);
  const { tiles, blocked, floor } = blank(CAVE_W, CAVE_H);
  const room = (c: { x: number; y: number; r: number }) => {
    for (let y = c.y - c.r - 1; y <= c.y + c.r + 1; y++)
      for (let x = c.x - c.r - 1; x <= c.x + c.r + 1; x++)
        if (Math.hypot(x - c.x, (y - c.y) * 1.1) <= c.r + rnd.frac() * 0.8) floor(x, y, Tile.Stone);
  };
  const tunnel = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 2);
    for (let i = 0; i <= n; i++) {
      const x = Math.round(a.x + ((b.x - a.x) * i) / n), y = Math.round(a.y + ((b.y - a.y) * i) / n);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) floor(x + dx, y + dy, Tile.Stone);
    }
  };
  [HALL, GROTTO, BONES, PIT].forEach(room);
  tunnel(HALL, GROTTO);
  tunnel(GROTTO, BONES);
  tunnel(BONES, PIT);
  // The way out, just below the entrance hall.
  for (let y = HALL.y + HALL.r; y <= HALL.y + HALL.r + 2; y++) for (let x = HALL.x - 1; x <= HALL.x + 1; x++) floor(x, y, Tile.Path);

  const props: Prop[] = [];
  const put = (p: Prop, solid: boolean) => {
    props.push(p);
    if (solid) blocked[p.y][p.x] = true;
  };
  // Rocks line the walls: dark tiles right next to the floor.
  for (let y = 1; y < CAVE_H - 1; y++)
    for (let x = 1; x < CAVE_W - 1; x++) {
      if (!blocked[y][x]) continue;
      const nextToFloor = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !blocked[y + dy]?.[x + dx]);
      if (nextToFloor && rnd.frac() < 0.45) props.push({ kind: 'deco', texture: rnd.frac() < 0.85 ? 'rock' : 'crystal', x, y });
    }
  // Torches along the way, glowing crystals to mine, and what is left of those who came before.
  [[HALL.x - 2, HALL.y - 2], [HALL.x + 3, HALL.y], [GROTTO.x + 4, GROTTO.y - 2], [BONES.x - 3, BONES.y + 2], [PIT.x - 4, PIT.y + 3], [PIT.x + 4, PIT.y + 3]]
    .forEach(([x, y]) => put({ kind: 'deco', texture: 'torch', x, y, light: true }, true));
  [[GROTTO.x - 3, GROTTO.y + 2], [BONES.x + 2, BONES.y - 2], [PIT.x - 2, PIT.y - 3]].forEach(([x, y]) => put({ kind: 'deco', texture: 'crystal', x, y }, true));
  [[BONES.x, BONES.y + 1], [BONES.x - 1, BONES.y - 2], [PIT.x + 2, PIT.y], [PIT.x - 3, PIT.y - 1]].forEach(([x, y]) => put({ kind: 'deco', texture: 'bone_pile', x, y }, false));
  put({ kind: 'deco', texture: 'grave', x: PIT.x, y: PIT.y - 4 }, true);
  put({ kind: 'deco', texture: 'chest', x: PIT.x + 3, y: PIT.y - 3 }, true);

  return {
    id: 'cave', w: CAVE_W, h: CAVE_H,
    ambient: { color: 0x1b1530, alpha: 0.62 },
    bg: 0x07060c,
    doors: [{ x: HALL.x, y: HALL.y + HALL.r + 2.2, to: 'overworld', at: OUTSIDE_CAVE, label: 'Oakhaven' }],
    tiles, blocked, props,
    playerStart: CAVE_ENTRY,
    npcs: [],
    spawns: [
      { monster: 'slime_blue', x0: GROTTO.x - 3, y0: GROTTO.y - 3, x1: GROTTO.x + 3, y1: GROTTO.y + 3, count: 4 },
      { monster: 'skeleton', x0: BONES.x - 2, y0: BONES.y - 2, x1: BONES.x + 2, y1: BONES.y + 2, count: 3 },
      { monster: 'slime', x0: HALL.x - 2, y0: HALL.y - 3, x1: HALL.x + 2, y1: HALL.y - 1, count: 2 },
      { monster: 'bat', x0: GROTTO.x - 3, y0: GROTTO.y - 3, x1: GROTTO.x + 3, y1: GROTTO.y + 3, count: 2 },
      { monster: 'spider', x0: BONES.x - 2, y0: BONES.y - 2, x1: BONES.x + 2, y1: BONES.y + 2, count: 2 },
    ],
  };
}

// The Sleeping Fox, Oakhaven's tavern: a warm room with the innkeeper, the bard and a few locals.
const TAV_W = 12, TAV_H = 12;

function buildTavern(): WorldData {
  const { tiles, blocked, floor } = blank(TAV_W, TAV_H);
  for (let y = 2; y <= 9; y++) for (let x = 2; x <= 9; x++) floor(x, y, Tile.Bridge);
  // The doorway on the south-east wall.
  floor(TAVERN_ENTRY.x, TAVERN_ENTRY.y + 1, Tile.Bridge);
  floor(TAVERN_ENTRY.x, TAVERN_ENTRY.y + 2, Tile.Path);
  const props: Prop[] = [];
  const put = (texture: string, x: number, y: number, solid = true, light = false) => {
    props.push({ kind: 'deco', texture, x, y, light });
    if (solid) blocked[y][x] = true;
  };
  // Bar along the back wall, tables, the hearth, and lamps.
  [[3, 2], [4, 2], [5, 2]].forEach(([x, y]) => put('crate', x, y));
  put('barrels', 2, 3);
  put('barrel', 2, 5);
  put('campfire', 8, 2, true, true);
  put('lamp', 2, 8, true, true);
  put('lamp', 9, 5, true, true);
  [[7, 6], [4, 6]].forEach(([x, y]) => put('crate', x, y));
  put('barrel', 9, 9);

  const npcs: NpcDef[] = [
    { id: 'innkeeper', name: 'Mabel', texture: 'npcanim_innkeeper', x: 4, y: 3, role: 'Innkeeper', mark: 'shop' },
    { id: 'drunk', name: 'Old Tam', texture: 'npcanim_villager_m', x: 7, y: 7 },
  ];
  return {
    id: 'tavern', w: TAV_W, h: TAV_H,
    ambient: { color: 0xffd7a0, alpha: 0.12 },
    bg: 0x0d0906,
    doors: [{ x: TAVERN_ENTRY.x, y: TAVERN_ENTRY.y + 2.2, to: 'overworld', at: OUTSIDE_TAVERN, label: 'Oakhaven' }],
    tiles, blocked, props,
    playerStart: TAVERN_ENTRY,
    npcs,
    spawns: [],
  };
}

// Grom's smithy: the forge, racks of gear, and Bree, his apprentice, who sells the better blades.
const SMI_W = 11, SMI_H = 11;

function buildSmithy(): WorldData {
  const { tiles, blocked, floor } = blank(SMI_W, SMI_H);
  for (let y = 2; y <= 8; y++) for (let x = 2; x <= 8; x++) floor(x, y, Tile.Stone);
  floor(SMITHY_ENTRY.x, SMITHY_ENTRY.y + 2, Tile.Stone);
  floor(SMITHY_ENTRY.x, SMITHY_ENTRY.y + 3, Tile.Path);
  const props: Prop[] = [];
  const put = (texture: string, x: number, y: number, solid = true, light = false) => {
    props.push({ kind: 'deco', texture, x, y, light });
    if (solid) blocked[y][x] = true;
  };
  // The forge glows in the back corner; crates of ore and finished gear along the walls.
  put('campfire', 7, 2, true, true);
  put('torch', 2, 2, true, true);
  put('lamp', 8, 6, true, true);
  [[3, 2], [4, 2], [2, 4], [2, 5]].forEach(([x, y]) => put('crate', x, y));
  put('barrels', 8, 8);
  put('cart', 3, 7);

  const npcs: NpcDef[] = [
    { id: 'apprentice', name: 'Bree', texture: 'npcanim_villager_f', x: 6, y: 3, role: "Grom's Apprentice", mark: 'shop' },
  ];
  return {
    id: 'smithy', w: SMI_W, h: SMI_H,
    ambient: { color: 0xffc890, alpha: 0.14 },
    bg: 0x0d0906,
    doors: [{ x: SMITHY_ENTRY.x, y: SMITHY_ENTRY.y + 3.2, to: 'overworld', at: OUTSIDE_SMITHY, label: 'Oakhaven' }],
    tiles, blocked, props,
    playerStart: SMITHY_ENTRY,
    npcs,
    spawns: [],
  };
}
