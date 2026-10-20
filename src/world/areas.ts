import Phaser from 'phaser';
import {
  buildWorld, CAVE_ENTRY, OUTSIDE_CAVE, OUTSIDE_SMITHY, OUTSIDE_SYLVAN, OUTSIDE_TAVERN, SMITHY_ENTRY, SYLVAN_ENTRY, TAVERN_ENTRY, Tile,
  type AreaId, type NpcDef, type Prop, type WorldData,
} from './worldData';

/** Builds the map for an area. */
export function buildArea(id: AreaId): WorldData {
  if (id === 'cave') return buildCave();
  if (id === 'tavern') return buildTavern();
  if (id === 'smithy') return buildSmithy();
  if (id === 'sylvan') return buildSylvan();
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

// The Sylvan Wood, south of Oakhaven (Chapter 2): the elves' camp under the old trees, the Blight
// Glen, the Moonwell, the Hollow where the husks walk, and the Heart Grove where Vyrnax sleeps.
const SYL_W = 36, SYL_H = 46;
const CAMP = { x: 18, y: 9, r: 4 };
const GLEN = { x: 9, y: 20, r: 5 };
const MOONWELL = { x: 27, y: 20, r: 4 };
const HOLLOW = { x: 12, y: 32, r: 5 };
export const HEART = { x: 23, y: 39, r: 5 };

function buildSylvan(): WorldData {
  const rnd = new Phaser.Math.RandomDataGenerator(['sylvan-wood']);
  const { tiles, blocked, floor } = blank(SYL_W, SYL_H);
  const room = (c: { x: number; y: number; r: number }) => {
    for (let y = c.y - c.r - 1; y <= c.y + c.r + 1; y++)
      for (let x = c.x - c.r - 1; x <= c.x + c.r + 1; x++)
        if (Math.hypot(x - c.x, y - c.y) <= c.r + rnd.frac() * 0.8) floor(x, y, rnd.frac() < 0.12 ? Tile.Flowers : rnd.frac() < 0.5 ? Tile.Grass2 : Tile.Grass);
  };
  // Forest trails: two tiles wide, winding a little.
  const trail = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 2);
    for (let i = 0; i <= n; i++) {
      const t = i / n, bend = Math.round(Math.sin(t * Math.PI) * 2);
      const x = Math.round(a.x + (b.x - a.x) * t + bend), y = Math.round(a.y + (b.y - a.y) * t);
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) floor(x + dx, y + dy, Tile.Path);
    }
  };
  [CAMP, GLEN, MOONWELL, HOLLOW, HEART].forEach(room);
  trail({ x: SYLVAN_ENTRY.x, y: 1 }, CAMP);
  trail(CAMP, GLEN);
  trail(CAMP, MOONWELL);
  trail(GLEN, HOLLOW);
  trail(MOONWELL, HEART);
  trail(HOLLOW, HEART);

  const props: Prop[] = [];
  const put = (texture: string, x: number, y: number, solid = true, extra: Partial<Prop> = {}) => {
    props.push({ kind: 'deco', texture, x, y, ...extra });
    if (solid) blocked[y][x] = true;
  };
  // Trees: the first row around every clearing can be brushed past (soft), the ones behind are
  // a solid wall, and deeper than that is dark canopy (not drawn, like cave rock).
  const dist = (x: number, y: number) => {
    let d = 9;
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) if (!blocked[y + dy]?.[x + dx]) d = Math.min(d, Math.max(Math.abs(dx), Math.abs(dy)));
    return d;
  };
  const ring: [number, number, number][] = [];
  for (let y = 0; y < SYL_H; y++) for (let x = 0; x < SYL_W; x++) if (blocked[y][x]) ring.push([x, y, dist(x, y)]);
  for (const [x, y, d] of ring) {
    if (d > 3) continue;
    tiles[y][x] = Tile.Grass2;
    if (d === 1 || rnd.frac() < 0.75) {
      const pine = rnd.frac() < 0.55;
      props.push({ kind: 'tree', texture: pine ? 'pine' : 'tree', frame: rnd.between(0, pine ? 1 : 2), x, y, hard: d > 1 });
    }
  }
  // Undergrowth on the clearings (walk-through), a few rocks.
  for (let y = 1; y < SYL_H - 1; y++)
    for (let x = 1; x < SYL_W - 1; x++) {
      if (blocked[y][x] || tiles[y][x] === Tile.Path) continue;
      const r = rnd.frac();
      if (r < 0.05) props.push({ kind: 'deco', texture: 'mushroom', frame: rnd.between(0, 1), x, y });
      else if (r < 0.09) props.push({ kind: 'deco', texture: 'bush', frame: rnd.between(0, 2), x, y });
      else if (r < 0.12) props.push({ kind: 'deco', texture: 'flowers', frame: rnd.between(0, 3), x, y });
    }
  const clear = (x: number, y: number) => {
    for (let i = props.length - 1; i >= 0; i--) if (props[i].x === x && props[i].y === y) props.splice(i, 1);
  };
  const place = (texture: string, x: number, y: number, solid = true, extra: Partial<Prop> = {}) => (clear(x, y), put(texture, x, y, solid, extra));
  // The elves' camp: tents, a fire, lanterns.
  props.push({ kind: 'building', texture: 'tent', x: CAMP.x + 2, y: CAMP.y - 3 });
  for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) (clear(CAMP.x + 2 + dx, CAMP.y - 3 + dy), (blocked[CAMP.y - 3 + dy][CAMP.x + 2 + dx] = true));
  place('campfire', CAMP.x, CAMP.y + 1, true, { light: true });
  place('lamp', CAMP.x - 3, CAMP.y - 1, true, { light: true });
  place('lamp', CAMP.x + 3, CAMP.y + 2, true, { light: true });
  place('crate', CAMP.x + 4, CAMP.y);
  place('barrel', CAMP.x - 3, CAMP.y + 2);
  // The Moonwell: an old well that still glows.
  place('well', MOONWELL.x, MOONWELL.y, true, { light: true });
  place('crystal', MOONWELL.x + 2, MOONWELL.y - 2);
  // The Hollow: graves of the ones who walked in and never left.
  [[HOLLOW.x - 2, HOLLOW.y - 1], [HOLLOW.x + 1, HOLLOW.y - 3], [HOLLOW.x + 3, HOLLOW.y + 1]].forEach(([x, y]) => place('grave', x, y));
  [[HOLLOW.x, HOLLOW.y + 2], [HOLLOW.x - 3, HOLLOW.y + 2]].forEach(([x, y]) => place('bone_pile', x, y, false));
  place('stump', HOLLOW.x + 1, HOLLOW.y + 3);
  // The Heart Grove: Core crystals grown through the roots, and torches the elves left burning.
  [[HEART.x - 3, HEART.y - 2], [HEART.x + 3, HEART.y - 3], [HEART.x - 2, HEART.y + 3], [HEART.x + 4, HEART.y + 2]].forEach(([x, y]) => place('crystal', x, y));
  [[HEART.x - 4, HEART.y], [HEART.x + 4, HEART.y - 1]].forEach(([x, y]) => place('torch', x, y, true, { light: true }));
  place('chest', HEART.x, HEART.y + 4);
  place('signpost', SYLVAN_ENTRY.x + 2, Math.round(SYLVAN_ENTRY.y));

  const npcs: NpcDef[] = [
    { id: 'warden', name: 'Vaelen', texture: 'npc_vaelen', x: CAMP.x - 1, y: CAMP.y - 1, role: 'Elf Warden', mark: 'quest', quest: 'main_07_blight' },
    { id: 'herbalist', name: 'Lyra', texture: 'npc_lyra', x: CAMP.x + 2, y: CAMP.y + 2, role: 'Elven Goods', mark: 'shop' },
  ];
  for (const n of npcs) clear(n.x, n.y);
  return {
    id: 'sylvan', w: SYL_W, h: SYL_H,
    // Green, dim light under the leaves.
    ambient: { color: 0x3d6a4a, alpha: 0.32 },
    bg: 0x08110b,
    doors: [{ x: SYLVAN_ENTRY.x + 0.4, y: 1.4, to: 'overworld', at: OUTSIDE_SYLVAN, label: 'Oakhaven' }],
    tiles, blocked, props,
    playerStart: SYLVAN_ENTRY,
    npcs,
    spawns: [
      { monster: 'slime_purple', x0: GLEN.x - 3, y0: GLEN.y - 3, x1: GLEN.x + 3, y1: GLEN.y + 3, count: 5 },
      { monster: 'thorn_spider', x0: GLEN.x - 3, y0: GLEN.y - 2, x1: GLEN.x + 3, y1: GLEN.y + 3, count: 2 },
      { monster: 'blight_wolf', x0: MOONWELL.x - 3, y0: MOONWELL.y - 3, x1: MOONWELL.x + 3, y1: MOONWELL.y + 3, count: 3 },
      { monster: 'husk', x0: HOLLOW.x - 3, y0: HOLLOW.y - 3, x1: HOLLOW.x + 3, y1: HOLLOW.y + 3, count: 4 },
      { monster: 'thorn_spider', x0: HEART.x - 4, y0: HEART.y - 4, x1: HEART.x - 1, y1: HEART.y - 1, count: 2 },
    ],
  };
}
