import Phaser from 'phaser';
import { Actor } from './Actor';
import type { IsoMap } from '../iso/IsoMap';
import { frameCount } from '../assets/sprites';

const BASE_SPEED = 150; // px/s at spd 10

/** The player hero: free movement in screen space with per-axis collision sliding. */
export class Player extends Actor {
  facing = new Phaser.Math.Vector2(1, 0);
  invulnerableUntil = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture);
  }

  move(dx: number, dy: number, spd: number, dtMs: number, map: IsoMap) {
    const len = Math.hypot(dx, dy);
    if (len < 0.15) {
      this.bob = 0;
      const f = Number(this.sprite.frame.name);
      if (f !== 0 && f !== 3) this.sprite.setFrame(f >= 3 ? 3 : 0);
      this.sync();
      return;
    }
    const nx = dx / Math.max(len, 1), ny = dy / Math.max(len, 1);
    const step = (BASE_SPEED * (spd / 10) * dtMs) / 1000;
    // Try each axis separately so the hero slides along walls instead of sticking.
    if (map.walkable(this.x + nx * step, this.y)) this.x += nx * step;
    if (map.walkable(this.x, this.y + ny * step)) this.y += ny * step;
    this.facing.set(nx, ny).normalize();
    if (Math.abs(nx) > 0.1) this.sprite.setFlipX(nx < 0);
    // Walk cycle: idle, step, idle, step (frames 0-2). Sheets with 6 frames have a back view
    // (frames 3-5) used while walking away from the camera.
    const n = frameCount(this.sprite.texture.key);
    if (n >= 3) {
      const base = n >= 6 && ny < -0.3 ? 3 : 0;
      const phase = Math.floor(this.bob / 2.2) % 4;
      this.sprite.setFrame(base + [0, 1, 0, 2][phase]);
    }
    this.bob += dtMs / 70;
    this.sync();
  }

  flashHurt(now: number) {
    this.invulnerableUntil = now + 600;
    this.sprite.setTint(0xff6666);
    this.scene.time.delayedCall(150, () => this.sprite.clearTint());
  }

  teleport(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.sync();
  }
}
