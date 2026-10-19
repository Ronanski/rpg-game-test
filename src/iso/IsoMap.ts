import Phaser from 'phaser';
import { gridToScreen, screenToTile, TILE_H } from './iso';
import { MAP_H, MAP_W, TILE_TEXTURE, type WorldData } from '../world/worldData';

/** Renders the ground and props of a WorldData, and answers collision queries. */
export class IsoMap {
  constructor(private scene: Phaser.Scene, private world: WorldData) {}

  render() {
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const p = gridToScreen(x, y);
        this.scene.add.image(p.x, p.y, TILE_TEXTURE[this.world.tiles[y][x]]).setDepth(-100000);
      }
    }
    for (const prop of this.world.props) {
      if (prop.kind === 'tree') {
        const p = gridToScreen(prop.x, prop.y);
        this.scene.add.image(p.x, p.y + 4, 'shadow').setDepth(-99999).setScale(1.3);
        this.scene.add.image(p.x, p.y + 6, 'tree').setOrigin(0.5, 1).setDepth(p.y);
      } else {
        // House sprite is anchored on the bottom vertex of its 2x2 footprint.
        const p = gridToScreen(prop.x + 1.5, prop.y + 1.5);
        this.scene.add.image(p.x, p.y + TILE_H / 2, 'house').setOrigin(0.5, 1).setDepth(p.y);
      }
    }
  }

  /** True if a screen-space point can be walked on. */
  walkable(x: number, y: number): boolean {
    const t = screenToTile(x, y);
    if (t.x < 0 || t.y < 0 || t.x >= MAP_W || t.y >= MAP_H) return false;
    return !this.world.blocked[t.y][t.x];
  }

  /** World bounds in screen space, for the camera. */
  bounds(): Phaser.Geom.Rectangle {
    const left = gridToScreen(0, MAP_H).x, right = gridToScreen(MAP_W, 0).x;
    const bottom = gridToScreen(MAP_W, MAP_H).y;
    return new Phaser.Geom.Rectangle(left, -TILE_H, right - left, bottom + TILE_H * 2);
  }
}
