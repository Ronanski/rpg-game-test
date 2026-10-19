import Phaser from 'phaser';
import { Actor } from './Actor';
import type { IsoMap } from '../iso/IsoMap';
import { frameCount } from '../assets/sprites';
import { FONT } from '../ui/theme';

const FOLLOW = 46; // px she keeps behind the hero
const SPEED = 165;
const RANGE = 230; // px she shoots from
const SHOT_MS = 1300;

/**
 * A hero who travels with the player (Hana, after Chapter 1). She follows a step behind, catches
 * up instantly if left far behind, and shoots arrows at the nearest monster near the hero.
 * Monsters ignore her, so she can't be defeated.
 */
export class Companion extends Actor {
  private label: Phaser.GameObjects.Text;
  private nextShot = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, name: string) {
    super(scene, x, y, texture);
    this.label = scene.add
      .text(x, y, name, { fontFamily: FONT, fontSize: '11px', color: '#9fe3ff', stroke: '#07080e', strokeThickness: 3 })
      .setOrigin(0.5, 1)
      .setDepth(100000);
  }

  /** Moves after the hero; returns a monster to shoot when it's time to. */
  update<T extends { x: number; y: number; dead: boolean }>(now: number, dtMs: number, hero: { x: number; y: number }, map: IsoMap, monsters: T[]): T | null {
    const dx = hero.x - this.x, dy = hero.y - this.y, d = Math.hypot(dx, dy);
    if (d > 420) {
      // Lost behind a wall or left in another corner: she catches up.
      this.x = hero.x - 20;
      this.y = hero.y + 8;
    } else if (d > FOLLOW) {
      const step = Math.min(d - FOLLOW, (SPEED * dtMs) / 1000);
      const nx = this.x + (dx / d) * step, ny = this.y + (dy / d) * step;
      if (map.walkable(nx, this.y)) this.x = nx;
      if (map.walkable(this.x, ny)) this.y = ny;
      this.bob += dtMs / 90;
      if (Math.abs(dx) > 2) this.sprite.setFlipX(dx < 0);
      if (frameCount(this.sprite.texture.key) >= 3) this.sprite.setFrame([0, 1, 0, 2][Math.floor(this.bob / 2) % 4]);
    } else {
      this.bob = 0;
      if (Number(this.sprite.frame.name) !== 0) this.sprite.setFrame(0);
    }
    this.sync();
    this.label.setPosition(this.x, this.y - this.sprite.displayHeight - 2);

    if (now < this.nextShot) return null;
    let target: T | null = null, best = RANGE;
    for (const m of monsters) {
      if (m.dead) continue;
      const md = Phaser.Math.Distance.Between(this.x, this.y, m.x, m.y);
      if (md < best && Phaser.Math.Distance.Between(hero.x, hero.y, m.x, m.y) < RANGE + 40) (best = md), (target = m);
    }
    if (target) {
      this.nextShot = now + SHOT_MS;
      this.sprite.setFlipX(target.x < this.x);
    }
    return target;
  }

  destroy() {
    super.destroy();
    this.label.destroy();
  }
}
