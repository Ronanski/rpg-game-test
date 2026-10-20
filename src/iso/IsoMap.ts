import Phaser from 'phaser';
import { gridToScreen, screenToGrid, screenToTile, TILE_H } from './iso';
import { Tile, TILE_TEXTURE, type WorldData } from '../world/worldData';
import { frameCount, spriteScale } from '../assets/sprites';
import { LIGHT_DEPTH } from '../systems/LightingSystem';

/** A tree, rock or crystal the player can hit for wood, stone or mana. */
export interface ResourceNode {
  x: number;
  y: number;
  sprite: Phaser.GameObjects.Sprite;
  res: 'wood' | 'stone' | 'mana';
  amount: number;
  readyAt: number;
}

const NODE_RES: Record<string, [ResourceNode['res'], number]> = {
  tree: ['wood', 3], pine: ['wood', 3], rock: ['stone', 2], crystal: ['mana', 1],
};

const GRASS = new Set([Tile.Grass, Tile.Grass2, Tile.Flowers]);

/** Small or flat things that cast no long shadow. */
const FLAT = new Set(['flowers', 'mushroom', 'bush', 'flowerbed', 'bone_pile', 'tile_flowers', 'rabbit', 'chicken']);

/**
 * Long afternoon shadow (sun from the upper left, as in the reference): the sprite's own shape,
 * flattened onto the ground and leaning to the lower right, in a soft dark tint.
 */
export function sunShadow(scene: Phaser.Scene, x: number, y: number, key: string, frame: string | number, scale: number, flip: boolean) {
  return scene.add.image(x, y, key, frame).setOrigin(0.5, 1).setScale(scale * (flip ? -1 : 1), -scale * 0.5)
    .setRotation(0.85).setTint(0x1c1408).setTintMode(Phaser.TintModes.FILL).setAlpha(0.26).setDepth(-99990);
}

/** Which of the 32 grass tiles (one seamless painting) sits at grid cell (x, y). */
function lattice(x: number, y: number) {
  const a = (((x - y) % 8) + 8) % 8, b = (((x + y) % 8) + 8) % 8;
  return a * 4 + (b >> 1);
}

/** Renders the ground and props of a WorldData, and answers collision queries. */
export class IsoMap {
  private water: Phaser.GameObjects.Image[] = [];
  readonly nodes: ResourceNode[] = [];

  /**
   * Tiles blocked only by a small object (a tree trunk, a rock, a barrel): just the middle of the
   * tile is solid, so you can walk past close to them instead of bumping into empty space.
   */
  private soft = new Set<string>();

  constructor(private scene: Phaser.Scene, private world: WorldData) {
    for (const p of world.props) if (p.kind !== 'building' && !p.hard) this.soft.add(`${p.x},${p.y}`);
  }

  render() {
    const grassAt = (x: number, y: number) => GRASS.has(this.world.tiles[y]?.[x] as Tile);
    for (let y = 0; y < this.world.h; y++) {
      for (let x = 0; x < this.world.w; x++) {
        const p = gridToScreen(x, y);
        const tile = this.world.tiles[y][x];
        const key = TILE_TEXTURE[tile];
        if (!key) continue;
        // Grass: one seamless meadow (see tools/art/ground.py), so no tile grid shows.
        const cell = lattice(x, y);
        if (GRASS.has(tile)) {
          this.scene.add.image(p.x, p.y, 'ground_grass', cell).setDepth(-100000);
          continue;
        }
        // Pick a stable variant per cell so the ground doesn't repeat visibly.
        const frame = ((x * 73856093) ^ (y * 19349663)) >>> 0;
        const img = this.scene.add.image(p.x, p.y, key, frame % frameCount(key)).setDepth(-100000).setScale(spriteScale(key));
        if (tile === Tile.Water) this.water.push(img);
        // Sun-warmed stone and earth, like the reference village.
        else if (tile !== Tile.Bridge) img.setTint(0xfff0dc);
        // Grass spills over the edges of paths, the plaza and river banks.
        ([[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const).forEach(([nx, ny], dir) => {
          if (grassAt(nx, ny)) this.scene.add.image(p.x, p.y, 'ground_edge', cell * 4 + dir).setDepth(-99999);
        });
      }
    }
    // Water ripples: step every water tile through its frames (each starts on a different one).
    const n = frameCount('tile_water');
    this.scene.time.addEvent({
      delay: 260,
      loop: true,
      callback: () => this.water.forEach((w) => w.setFrame((Number(w.frame.name) + 1) % n)),
    });

    for (const prop of this.world.props) {
      const s = spriteScale(prop.texture);
      if (prop.kind === 'building') {
        // Anchored on the bottom vertex of its 2x2 footprint.
        const p = gridToScreen(prop.x + 1.5, prop.y + 1.5);
        const bx = p.x, by = p.y + TILE_H / 2 + 4;
        this.scene.add.image(bx, by, prop.texture).setOrigin(0.5, 1).setDepth(p.y).setScale(s).setFlipX(!!prop.flip);
        sunShadow(this.scene, bx, by, prop.texture, 0, s, !!prop.flip);
        // The forge breathes smoke from its chimney.
        if (prop.texture === 'blacksmith') this.smoke(bx - 32 * (prop.flip ? -1 : 1), by - 112);
        continue;
      }
      const p = gridToScreen(prop.x, prop.y);
      const img = this.scene.add.sprite(p.x, p.y + 6, prop.texture, prop.frame ?? 0).setOrigin(0.5, 1).setDepth(p.y).setScale(s);
      if (!FLAT.has(prop.texture)) sunShadow(this.scene, p.x, p.y + 6, prop.texture, prop.frame ?? 0, s, false);
      if (prop.texture === 'fountain') this.spray(p.x, p.y - 36, p.y + 1);
      const node = NODE_RES[prop.texture];
      if (node) this.nodes.push({ x: p.x, y: p.y, sprite: img, res: node[0], amount: node[1], readyAt: 0 });
      if (prop.light) {
        // Flickering flame + warm light pool on the ground around it.
        if (prop.texture === 'torch') img.play({ key: 'torch_burn', startFrame: (prop.x + prop.y) % frameCount('torch') });
        // Drawn above the ambient overlay so it lights up the dusk.
        const glow = this.scene.add.image(p.x, p.y - 30, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(LIGHT_DEPTH).setScale(1.6);
        this.scene.tweens.add({ targets: glow, alpha: 0.75, scale: 1.5, duration: 180 + (prop.x % 3) * 40, yoyo: true, repeat: -1 });
      }
    }
  }

  /** True if a screen-space point can be walked on. */
  walkable(x: number, y: number): boolean {
    const t = screenToTile(x, y);
    if (t.x < 0 || t.y < 0 || t.x >= this.world.w || t.y >= this.world.h) return false;
    if (!this.world.blocked[t.y][t.x]) return true;
    if (!this.soft.has(`${t.x},${t.y}`)) return false;
    // Inside a small object's tile: only its inner part (a diamond half the tile's size) blocks.
    const g = screenToGrid(x, y);
    return Math.abs(g.x - t.x) + Math.abs(g.y - t.y) > 0.32;
  }

  /** Tile type at a grid cell (undefined outside the map). */
  tileAt(x: number, y: number): Tile | undefined {
    return this.world.tiles[y]?.[x];
  }

  isBlocked(x: number, y: number): boolean {
    return this.world.blocked[y]?.[x] ?? true;
  }

  setBlocked(x: number, y: number, v: boolean) {
    if (this.world.blocked[y]?.[x] !== undefined) this.world.blocked[y][x] = v;
    // Town buildings and walls block their whole tile.
    if (v) this.soft.delete(`${x},${y}`);
  }

  /** Soft grey puffs rising and drifting (chimneys). */
  private smoke(x: number, y: number) {
    this.scene.add.particles(x, y, 'dust', {
      lifespan: 2600, frequency: 420, speedY: { min: -22, max: -14 }, speedX: { min: 2, max: 9 },
      scale: { start: 0.9, end: 2.6 }, alpha: { start: 0.6, end: 0 }, tint: 0xd8d2c8,
    }).setDepth(y + 400);
  }

  /** Water sparkling up and falling back into a fountain. */
  private spray(x: number, y: number, depth: number) {
    this.scene.add.particles(x, y, 'spark', {
      lifespan: 700, frequency: 70, speedX: { min: -16, max: 16 }, speedY: { min: -46, max: -30 }, gravityY: 120,
      scale: { start: 0.75, end: 0.25 }, alpha: { start: 0.95, end: 0 }, tint: [0xbfe8ff, 0xffffff, 0x8fd0ff],
    }).setDepth(depth);
  }

  /** World bounds in screen space, for the camera. */
  bounds(): Phaser.Geom.Rectangle {
    const { w, h } = this.world;
    const left = gridToScreen(0, h).x, right = gridToScreen(w, 0).x;
    const bottom = gridToScreen(w, h).y;
    return new Phaser.Geom.Rectangle(left, -TILE_H * 4, right - left, bottom + TILE_H * 5);
  }
}
