import Phaser from 'phaser';
import { gridToScreen, screenToTile, TILE_H } from './iso';
import type { WorldData } from '../world/worldData';
import { ART_SCALE, artImage } from '../assets/art';

/** Renders the baked ground layer and the props of a WorldData, and answers collision queries. */
export class IsoMap {
  /** Tall props that can hide characters standing behind them. */
  private occluders: Phaser.GameObjects.Image[] = [];

  constructor(private scene: Phaser.Scene, private world: WorldData) {}

  render() {
    const o = this.world.groundOrigin;
    this.scene.add
      .image(-o.x * ART_SCALE, -o.y * ART_SCALE, 'ground')
      .setOrigin(0, 0)
      .setScale(ART_SCALE)
      .setDepth(-100000);

    for (const prop of this.world.props) {
      // Houses are anchored on the bottom corner of their 2x2 footprint, everything else on its tile centre.
      const p = prop.kind === 'house' ? gridToScreen(prop.x + 1.5, prop.y + 1.5) : gridToScreen(prop.x, prop.y);
      const img = artImage(this.scene, p.x, p.y, `${prop.kind}${prop.variant}`).setDepth(p.y);
      if (prop.kind === 'tree' || prop.kind === 'house') this.occluders.push(img);
    }
  }

  /** Fade trees and houses that stand in front of any of the given characters. */
  updateOcclusion(actors: { x: number; y: number }[]) {
    for (const o of this.occluders) {
      const b = o.getBounds();
      const hidden = actors.some((a) => a.y < o.depth && a.y > b.top + 8 && a.x > b.left + 6 && a.x < b.right - 6);
      const target = hidden ? 0.45 : 1;
      if (o.alpha !== target) o.setAlpha(Phaser.Math.Linear(o.alpha, target, 0.25) + (Math.abs(o.alpha - target) < 0.05 ? target - o.alpha : 0));
    }
  }

  /** True if a screen-space point can be walked on. */
  walkable(x: number, y: number): boolean {
    const t = screenToTile(x, y);
    const n = this.world.size;
    if (t.x < 0 || t.y < 0 || t.x >= n || t.y >= n) return false;
    return !this.world.blocked[t.y][t.x];
  }

  /** World bounds in screen space, for the camera. */
  bounds(): Phaser.Geom.Rectangle {
    const n = this.world.size;
    const left = gridToScreen(0, n).x, right = gridToScreen(n, 0).x;
    const bottom = gridToScreen(n, n).y;
    return new Phaser.Geom.Rectangle(left, -TILE_H, right - left, bottom + TILE_H * 2);
  }
}
