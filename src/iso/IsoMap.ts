import Phaser from 'phaser';
import { gridToScreen, screenToTile, TILE_H } from './iso';
import { MAP_H, MAP_W, Tile, TILE_TEXTURE, type WorldData } from '../world/worldData';
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

/** Renders the ground and props of a WorldData, and answers collision queries. */
export class IsoMap {
  private water: Phaser.GameObjects.Image[] = [];
  readonly nodes: ResourceNode[] = [];

  constructor(private scene: Phaser.Scene, private world: WorldData) {}

  render() {
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const p = gridToScreen(x, y);
        const tile = this.world.tiles[y][x];
        const key = TILE_TEXTURE[tile];
        // Pick a stable variant per cell so the ground doesn't repeat visibly.
        const frame = ((x * 73856093) ^ (y * 19349663)) >>> 0;
        const img = this.scene.add.image(p.x, p.y, key, frame % frameCount(key)).setDepth(-100000).setScale(spriteScale(key));
        if (tile === Tile.Water) this.water.push(img);
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
        this.scene.add.image(p.x, p.y + TILE_H / 2 + 4, prop.texture).setOrigin(0.5, 1).setDepth(p.y).setScale(s).setFlipX(!!prop.flip);
        continue;
      }
      const p = gridToScreen(prop.x, prop.y);
      const img = this.scene.add.sprite(p.x, p.y + 6, prop.texture, prop.frame ?? 0).setOrigin(0.5, 1).setDepth(p.y).setScale(s);
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
    if (t.x < 0 || t.y < 0 || t.x >= MAP_W || t.y >= MAP_H) return false;
    return !this.world.blocked[t.y][t.x];
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
  }

  /** World bounds in screen space, for the camera. */
  bounds(): Phaser.Geom.Rectangle {
    const left = gridToScreen(0, MAP_H).x, right = gridToScreen(MAP_W, 0).x;
    const bottom = gridToScreen(MAP_W, MAP_H).y;
    return new Phaser.Geom.Rectangle(left, -TILE_H * 4, right - left, bottom + TILE_H * 5);
  }
}
