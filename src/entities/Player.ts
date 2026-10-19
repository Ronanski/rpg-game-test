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

  /**
   * Arms in motion: a short wind-up, then the strike. Melee swings the held weapon in an arc in
   * front of the hero; bows are drawn back (body leans away) and released with a recoil.
   */
  attackAnim(kind: 'swing' | 'bow' | 'cast', weaponIcon: string | null) {
    const s = this.sprite, f = this.facing, dir = f.x < 0 ? -1 : 1;
    this.scene.tweens.killTweensOf(s);
    s.setAngle(0).setScale(this.baseScale);
    if (kind === 'bow') {
      // Draw (lean back, squash), then release (snap forward).
      this.scene.tweens.chain({ targets: s, tweens: [
        { angle: -6 * dir, scaleX: this.baseScale * 0.94, duration: 90 },
        { angle: 3 * dir, scaleX: this.baseScale * 1.04, duration: 50 },
        { angle: 0, scaleX: this.baseScale, duration: 90 },
      ] });
      return;
    }
    if (kind === 'cast') {
      // Raise the staff: stretch up, then thrust.
      this.scene.tweens.chain({ targets: s, tweens: [
        { scaleY: this.baseScale * 1.08, angle: -4 * dir, duration: 80 },
        { scaleY: this.baseScale * 0.96, angle: 6 * dir, duration: 60 },
        { scaleY: this.baseScale, angle: 0, duration: 100 },
      ] });
      return;
    }
    // Melee: wind-up away from the target, then a strike that leans in.
    this.scene.tweens.chain({ targets: s, tweens: [
      { angle: -10 * dir, duration: 60 },
      { angle: 12 * dir, scaleY: this.baseScale * 0.95, duration: 70 },
      { angle: 0, scaleY: this.baseScale, duration: 110 },
    ] });
    if (weaponIcon) {
      // The weapon itself swings from over the shoulder down through the target.
      const base = Math.atan2(f.y, f.x);
      // Held at the hand on the facing side (not over the body), small enough not to hide the hero.
      const handX = () => this.x + dir * 14, handY = () => this.y - 22;
      const w = this.scene.add.image(handX(), handY(), weaponIcon).setOrigin(0.15, 0.85).setDepth(this.y + 2);
      w.setScale(Math.min(1.4, 30 / Math.max(w.width, w.height))).setRotation(base - 1.9).setFlipY(dir < 0);
      this.scene.tweens.add({
        targets: w, rotation: base + 0.9, duration: 160, delay: 50, ease: 'Cubic.easeOut',
        onUpdate: () => w.setPosition(handX(), handY()),
        onComplete: () => this.scene.tweens.add({ targets: w, alpha: 0, duration: 80, onComplete: () => w.destroy() }),
      });
    }
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
