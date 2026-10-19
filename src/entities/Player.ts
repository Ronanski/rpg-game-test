import Phaser from 'phaser';
import { Actor } from './Actor';
import type { IsoMap } from '../iso/IsoMap';
import { state } from '../core/GameState';
import { frameCount } from '../assets/sprites';
import * as fx from '../systems/combat/Fx';

const BASE_SPEED = 150; // px/s at spd 10
const ROLL_MS = 260;
const ROLL_SPEED = 480;
const ROLL_COOLDOWN = 800;

/** The player hero: free movement in screen space with per-axis collision sliding. */
export class Player extends Actor {
  facing = new Phaser.Math.Vector2(1, 0);
  invulnerableUntil = 0;
  /** Dodge roll in progress: moves fast along `rollDir` until `rollUntil`, untouchable. */
  private rollUntil = 0;
  private rollDir = new Phaser.Math.Vector2();
  nextRollAt = 0;
  private walking = false;
  private lastPhase = -1;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture);
  }

  /** Quick roll in the move direction (or facing). Returns false while on cooldown. */
  roll(dx: number, dy: number, now: number): boolean {
    if (now < this.nextRollAt) return false;
    const dir = Math.hypot(dx, dy) > 0.15 ? new Phaser.Math.Vector2(dx, dy).normalize() : this.facing.clone();
    this.rollDir.copy(dir);
    this.rollUntil = now + ROLL_MS;
    this.nextRollAt = now + ROLL_COOLDOWN;
    state.cooldowns.dodgeReady = this.nextRollAt;
    state.cooldowns.dodgeTotal = ROLL_COOLDOWN;
    this.invulnerableUntil = Math.max(this.invulnerableUntil, now + ROLL_MS + 60);
    this.sprite.setAlpha(0.65);
    this.scene.tweens.add({ targets: this.sprite, angle: dir.x < 0 ? -360 : 360, duration: ROLL_MS, onComplete: () => this.sprite.setAngle(0).setAlpha(1) });
    return true;
  }

  get rolling() {
    return this.scene.time.now < this.rollUntil;
  }

  move(dx: number, dy: number, spd: number, dtMs: number, map: IsoMap) {
    if (this.rolling) {
      const step = (ROLL_SPEED * dtMs) / 1000;
      if (Math.random() < dtMs / 40) fx.dust(this.scene, this.x, this.y, 1.2);
      if (map.walkable(this.x + this.rollDir.x * step, this.y)) this.x += this.rollDir.x * step;
      if (map.walkable(this.x, this.y + this.rollDir.y * step)) this.y += this.rollDir.y * step;
      this.sync();
      return;
    }
    const len = Math.hypot(dx, dy);
    if (len < 0.15) {
      this.bob = 0;
      this.walking = false;
      this.lastPhase = -1;
      if (!this.scene.tweens.isTweening(this.sprite)) this.sprite.setAngle(0);
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
    // Each footfall kicks up a little dust.
    const phase = Math.floor(this.bob / 2.2) % 4;
    if (phase !== this.lastPhase && (phase === 1 || phase === 3)) fx.dust(this.scene, this.x - nx * 6, this.y);
    this.lastPhase = phase;
    this.walking = true;
    // Lean into the walk and sway a little with each step, so it reads as walking, not gliding.
    if (!this.scene.tweens.isTweening(this.sprite)) this.sprite.setAngle(nx * 4 + Math.sin((this.bob * Math.PI) / 2.2) * 3);
    this.bob += dtMs / 70;
    this.sync();
  }

  /** One small hop per step while walking (instead of the generic bob). */
  protected sync() {
    const hop = this.walking ? Math.abs(Math.sin((this.bob * Math.PI) / 2.2)) * 4 : 0;
    this.sprite.setPosition(this.x, this.y + 2 - hop);
    this.sprite.setDepth(this.y);
    this.shadow.setPosition(this.x, this.y).setScale(1 - hop / 16, 1 - hop / 16);
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
