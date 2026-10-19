import Phaser from 'phaser';
import { Actor } from './Actor';
import type { IsoMap } from '../iso/IsoMap';
import { state } from '../core/GameState';
import { frameCount, isAnimated } from '../assets/sprites';
import * as fx from '../systems/combat/Fx';

const BASE_SPEED = 150; // px/s at spd 10
const ROLL_MS = 260;
const ROLL_SPEED = 480;
const ROLL_COOLDOWN = 800;
/** Frame-by-frame heroes (see isAnimated): which frame shows what. */
const F = { idle: 0, walk: [1, 2, 3, 4, 5], windup: 6, strike: 7, hurt: 8, front: [9, 10, 11, 12], back: [13, 14, 15, 16], side: [17, 18, 19, 20] };

/** The player hero: free movement in screen space with per-axis collision sliding. */
export class Player extends Actor {
  facing = new Phaser.Math.Vector2(1, 0);
  invulnerableUntil = 0;
  /** Dodge roll in progress: moves fast along `rollDir` until `rollUntil`, untouchable. */
  private rollUntil = 0;
  private rollDir = new Phaser.Math.Vector2();
  nextRollAt = 0;
  private walking = false;
  /**
   * Pose offsets for animations (tweened). Sprites are never rotated: rotating these sprites
   * makes parts of them disappear on screen, so motion is done with small shifts and squash.
   */
  readonly pose = { ox: 0, oy: 0, sx: 1, sy: 1 };
  private lastPhase = -1;
  /** Frame-by-frame heroes: an attack or hurt frame is showing until then (walk/idle wait). */
  private actionUntil = 0;
  /** Last walking direction, for heroes with front/back/side walks (idle keeps facing that way). */
  private dir: 'front' | 'back' | 'side' = 'front';

  /** Heroes whose sheet also has 3-direction walk frames (21 frames: 9 actions + 12 walks). */
  get directional() {
    return this.animated && frameCount(this.sprite.texture.key) >= 21;
  }

  /** True when the hero has real drawn frames for walking, attacking and getting hurt. */
  get animated() {
    return isAnimated(this.sprite.texture.key);
  }

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
    // Tuck into a low, squashed roll and spring back up.
    this.sprite.setAlpha(0.75);
    this.scene.tweens.killTweensOf(this.pose);
    this.scene.tweens.chain({ targets: this.pose, tweens: [
      { sx: 1.15, sy: 0.7, duration: ROLL_MS * 0.4 },
      { sx: 0.95, sy: 1.08, duration: ROLL_MS * 0.4 },
      { sx: 1, sy: 1, duration: ROLL_MS * 0.4, onComplete: () => this.sprite.setAlpha(1) },
    ] });
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
      // Idle: breathe and settle the sway (unless an animation is playing).
      if (!this.scene.tweens.isTweening(this.pose)) {
        this.pose.ox = 0;
        this.pose.sy = 1 + Math.sin(this.scene.time.now / 450) * 0.025;
      }
      if (this.animated) {
        // Standing still: face the way the hero last walked.
        const idle = this.directional && this.dir === 'back' ? F.back[0] : this.directional && this.dir === 'side' ? F.side[0] : F.idle;
        if (this.scene.time.now > this.actionUntil) this.sprite.setFrame(idle);
      } else {
        const f = Number(this.sprite.frame.name);
        if (f !== 0 && f !== 3) this.sprite.setFrame(f >= 3 ? 3 : 0);
      }
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
    if (this.directional) {
      // Front, back or side walk by the way the hero moves on screen (side frames face right).
      this.dir = Math.abs(nx) > Math.abs(ny) * 1.3 ? 'side' : ny < 0 ? 'back' : 'front';
      if (this.scene.time.now > this.actionUntil) this.sprite.setFrame(F[this.dir][Math.floor(this.bob / 2) % 4]);
    } else if (this.animated) {
      if (this.scene.time.now > this.actionUntil) this.sprite.setFrame(F.walk[Math.floor(this.bob / 1.7) % F.walk.length]);
    } else if (n >= 3) {
      const base = n >= 6 && ny < -0.3 ? 3 : 0;
      const phase = Math.floor(this.bob / 2.2) % 4;
      this.sprite.setFrame(base + [0, 1, 0, 2][phase]);
    }
    // Each footfall kicks up a little dust.
    // (Drawn walks plant a foot on their 1st and 3rd walk frames.)
    const phase = this.animated ? Math.floor(this.bob / 1.7) % 5 : Math.floor(this.bob / 2.2) % 4;
    const footfall = this.animated ? phase === 0 || phase === 2 : phase === 1 || phase === 3;
    if (phase !== this.lastPhase && footfall) fx.dust(this.scene, this.x - nx * 6, this.y);
    this.lastPhase = phase;
    this.walking = true;
    // Sway side to side with each step, so it reads as walking, not gliding (drawn walks don't need it).
    if (!this.animated && !this.scene.tweens.isTweening(this.pose)) this.pose.ox = Math.round(Math.sin((this.bob * Math.PI) / 2.2));
    this.bob += dtMs / 70;
    this.sync();
  }

  /** One small hop per step while walking (instead of the generic bob). */
  protected sync() {
    // Drawn walk frames already step; they only get a tiny bob.
    const hop = !this.walking ? 0 : this.animated ? Math.abs(Math.sin((this.bob * Math.PI) / 3.4)) * 1.5 : Math.abs(Math.sin((this.bob * Math.PI) / 2.2)) * 4;
    // The base Actor constructor calls sync() before `pose` exists.
    const pz = this.pose ?? { ox: 0, oy: 0, sx: 1, sy: 1 };
    this.sprite.setPosition(Math.round(this.x + pz.ox), Math.round(this.y + 2 - hop + pz.oy)).setScale(this.baseScale * pz.sx, this.baseScale * pz.sy);
    this.sprite.setDepth(this.y);
    this.shadow.setPosition(this.x, this.y).setScale(1 - hop / 16, 1 - hop / 16);
  }

  /**
   * Arms in motion: a short wind-up, then the strike. Melee swings the held weapon in an arc in
   * front of the hero; bows are drawn back (body leans away) and released with a recoil.
   */
  attackAnim(kind: 'swing' | 'bow' | 'cast', weaponIcon: string | null) {
    const f = this.facing, dir = f.x < 0 ? -1 : 1, pz = this.pose;
    this.scene.tweens.killTweensOf(pz);
    Object.assign(pz, { ox: 0, oy: 0, sx: 1, sy: 1 });
    if (this.animated) {
      // Drawn frames: wind-up, then the strike held a moment, with a small step into it.
      const windup = kind === 'bow' ? 100 : kind === 'cast' ? 80 : 60;
      this.actionUntil = this.scene.time.now + windup + 170;
      this.sprite.setFrame(F.windup);
      this.scene.time.delayedCall(windup, () => this.animated && this.sprite.setFrame(F.strike));
      this.scene.tweens.chain({ targets: pz, tweens: [
        { ox: -1 * dir, duration: windup },
        { ox: 2 * dir, duration: 60 },
        { ox: 0, duration: 110 },
      ] });
      return;
    }
    if (kind === 'bow') {
      // Draw: lean back and tense; release: snap forward; settle.
      this.scene.tweens.chain({ targets: pz, tweens: [
        { ox: -4 * dir, sx: 0.93, sy: 1.04, duration: 100 },
        { ox: 3 * dir, sx: 1.06, sy: 0.97, duration: 50 },
        { ox: 0, sx: 1, sy: 1, duration: 110 },
      ] });
      return;
    }
    if (kind === 'cast') {
      // Raise the staff (stretch up), then thrust forward.
      this.scene.tweens.chain({ targets: pz, tweens: [
        { sy: 1.1, sx: 0.95, oy: -3, duration: 80 },
        { sy: 0.94, sx: 1.05, oy: 0, ox: 4 * dir, duration: 60 },
        { sy: 1, sx: 1, ox: 0, duration: 100 },
      ] });
      return;
    }
    // Melee: wind-up (pull back), then a strike that lunges in, then recover.
    this.scene.tweens.chain({ targets: pz, tweens: [
      { ox: -3 * dir, sx: 0.96, sy: 1.05, duration: 60 },
      { ox: 6 * dir, sx: 1.07, sy: 0.94, duration: 70 },
      { ox: 0, sx: 1, sy: 1, duration: 120 },
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
    if (this.animated) {
      this.actionUntil = now + 220;
      this.sprite.setFrame(F.hurt);
    }
    this.sprite.setTint(0xff6666);
    this.scene.time.delayedCall(150, () => this.sprite.clearTint());
  }

  teleport(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.sync();
  }
}
