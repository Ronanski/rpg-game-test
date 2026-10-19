import Phaser from 'phaser';
import { Actor } from './Actor';
import type { IsoMap } from '../iso/IsoMap';

const BASE_SPEED = 150; // px/s at spd 10
const FRAME_MS = 120;

/** The player hero: free movement with wall sliding, 4-frame walk cycle facing toward or away from the camera. */
export class Player extends Actor {
  facing = new Phaser.Math.Vector2(1, 0.5);
  invulnerableUntil = 0;
  private walkTime = 0;
  private back = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'hero_front_0');
  }

  move(dx: number, dy: number, spd: number, dtMs: number, map: IsoMap) {
    const len = Math.hypot(dx, dy);
    if (len < 0.15) {
      this.walkTime = 0;
      this.setTexture(`hero_${this.back ? 'back' : 'front'}_0`);
      this.sync();
      return;
    }
    const nx = dx / Math.max(len, 1), ny = dy / Math.max(len, 1);
    const step = (BASE_SPEED * (spd / 10) * dtMs) / 1000;
    // Try each axis separately so the hero slides along walls instead of sticking.
    if (map.walkable(this.x + nx * step, this.y)) this.x += nx * step;
    if (map.walkable(this.x, this.y + ny * step)) this.y += ny * step;
    this.facing.set(nx, ny).normalize();
    if (Math.abs(ny) > 0.2) this.back = ny < 0;
    if (Math.abs(nx) > 0.1) this.sprite.setFlipX(this.back ? nx > 0 : nx < 0);
    this.walkTime += dtMs;
    const frame = Math.floor(this.walkTime / FRAME_MS) % 4;
    this.setTexture(`hero_${this.back ? 'back' : 'front'}_${frame}`);
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
