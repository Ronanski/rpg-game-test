import Phaser from 'phaser';
import { Actor } from './Actor';
import type { IsoMap } from '../iso/IsoMap';
import { screenToTile } from '../iso/iso';
import { isSafeTile } from '../world/worldData';

const LEASH = 280; // wild monsters give up a chase this far from home

function safeAt(x: number, y: number) {
  const t = screenToTile(x, y);
  return isSafeTile(t.x, t.y);
}

export interface MonsterDef {
  id: 'slime' | 'slime_blue' | 'wolf' | 'goblin' | 'orc' | 'skeleton';
  name: string;
  hp: number;
  atk: number;
  def: number;
  speed: number; // px/s when chasing
  aggroRange: number;
  exp: number;
  gold: number;
  drop: { item: string; chance: number };
  /** Rarer extra drops (gear, potions). */
  extra?: { item: string; chance: number }[];
}

export const MONSTERS: Record<MonsterDef['id'], MonsterDef> = {
  slime: { id: 'slime', name: 'Slime', hp: 30, atk: 7, def: 1, speed: 55, aggroRange: 170, exp: 12, gold: 3, drop: { item: 'slime_gel', chance: 0.6 } },
  slime_blue: { id: 'slime_blue', name: 'Blue Slime', hp: 45, atk: 9, def: 2, speed: 60, aggroRange: 180, exp: 18, gold: 5, drop: { item: 'slime_gel', chance: 0.7 }, extra: [{ item: 'mana_potion', chance: 0.15 }] },
  goblin: { id: 'goblin', name: 'Goblin', hp: 50, atk: 11, def: 2, speed: 90, aggroRange: 210, exp: 24, gold: 10, drop: { item: 'health_potion', chance: 0.2 }, extra: [{ item: 'iron_sword', chance: 0.04 }, { item: 'leather_armor', chance: 0.05 }, { item: 'oak_staff', chance: 0.04 }] },
  orc: { id: 'orc', name: 'Orc', hp: 120, atk: 16, def: 5, speed: 60, aggroRange: 200, exp: 45, gold: 18, drop: { item: 'health_potion', chance: 0.3 }, extra: [{ item: 'iron_sword', chance: 0.06 }] },
  skeleton: { id: 'skeleton', name: 'Skeleton', hp: 70, atk: 13, def: 4, speed: 80, aggroRange: 200, exp: 32, gold: 12, drop: { item: 'mana_potion', chance: 0.2 } },
  wolf: { id: 'wolf', name: 'Wolf', hp: 60, atk: 12, def: 3, speed: 105, aggroRange: 230, exp: 28, gold: 8, drop: { item: 'wolf_pelt', chance: 0.5 } },
};

/** Simple AI: wander near home, chase the player when close, give up when too far. */
export class Monster extends Actor {
  hp: number;
  readonly hpBar: Phaser.GameObjects.Graphics;
  private wanderTarget: { x: number; y: number } | null = null;
  private nextThink = 0;
  private knockback = new Phaser.Math.Vector2();
  lastHitAt = 0;
  dead = false;
  /** Night raiders march to this point (the Ancient Core) unless the player is right next to them. */
  goal: { x: number; y: number } | null = null;
  /** True when the last move was blocked on both axes (a raider pushing against a wall). */
  stuck = false;
  /** Direction the raider is trying to go (for finding the wall it is stuck on). */
  readonly heading = new Phaser.Math.Vector2();
  /** Raiders strike structures once per second. */
  nextStrike = 0;
  /** How long the raider has been stuck, and an escape direction it tries for a moment. */
  private stuckMs = 0;
  private sidestepUntil = 0;
  private sidestep = new Phaser.Math.Vector2();

  constructor(scene: Phaser.Scene, x: number, y: number, readonly def: MonsterDef, readonly home: { x: number; y: number }) {
    super(scene, x, y, def.id);
    this.hp = def.hp;
    this.hpBar = scene.add.graphics().setDepth(100000);
    this.drawHp();
  }

  update(now: number, dtMs: number, target: { x: number; y: number }, map: IsoMap) {
    if (this.dead) return;
    const dt = dtMs / 1000;
    let vx = 0, vy = 0;

    const dist = this.distanceTo(target);
    const leash = Phaser.Math.Distance.Between(this.x, this.y, this.home.x, this.home.y);
    if (this.goal) {
      // Raider: fight the player only up close; otherwise head for the goal.
      const tgt = dist < 110 ? target : this.goal;
      vx = tgt.x - this.x;
      vy = tgt.y - this.y;
      this.wanderTarget = null;
      // Stuck on trees or a wall for a while: walk sideways for a moment to get around it.
      if (now < this.sidestepUntil) (vx = this.sidestep.x), (vy = this.sidestep.y);
      else if (this.stuckMs > 1600) {
        const side = Math.random() < 0.5 ? 1 : -1;
        this.sidestep.set(-vy * side, vx * side).normalize().scale(100);
        this.sidestepUntil = now + 900;
        this.stuckMs = 0;
      }
    } else if (dist < this.def.aggroRange && leash < LEASH && !safeAt(target.x, target.y)) {
      vx = target.x - this.x;
      vy = target.y - this.y;
      this.wanderTarget = null;
    } else {
      if (now > this.nextThink) {
        this.nextThink = now + Phaser.Math.Between(1500, 3500);
        this.wanderTarget = Math.random() < 0.6
          ? { x: this.home.x + Phaser.Math.Between(-90, 90), y: this.home.y + Phaser.Math.Between(-45, 45) }
          : null;
      }
      if (this.wanderTarget) {
        vx = this.wanderTarget.x - this.x;
        vy = this.wanderTarget.y - this.y;
        if (Math.hypot(vx, vy) < 6) this.wanderTarget = null;
      }
    }

    const len = Math.hypot(vx, vy);
    const speed = this.wanderTarget ? this.def.speed * 0.4 : this.def.speed;
    let mx = len > 1 ? (vx / len) * speed * dt : 0;
    let my = len > 1 ? (vy / len) * speed * dt : 0;
    // Stop just short of the player instead of stacking on top of them.
    if (!this.wanderTarget && dist < 26) mx = my = 0;
    mx += this.knockback.x * dt;
    my += this.knockback.y * dt;
    this.knockback.scale(Math.pow(0.0005, dt));

    const ox = this.x, oy = this.y;
    // Wild monsters stay out of the village and the town (raiders don't).
    const ok = (x: number, y: number) => map.walkable(x, y) && (!!this.goal || !safeAt(x, y));
    if (ok(this.x + mx, this.y)) this.x += mx;
    if (ok(this.x, this.y + my)) this.y += my;
    this.heading.set(vx, vy).normalize();
    this.stuck = len > 1 && Math.hypot(this.x - ox, this.y - oy) < 0.05 * Math.hypot(mx, my) + 0.01;
    this.stuckMs = this.stuck ? this.stuckMs + dtMs : 0;
    if (Math.abs(mx) > 0.01) this.sprite.setFlipX(['wolf', 'goblin', 'orc', 'skeleton'].includes(this.def.id) ? mx < 0 : false);
    if (len > 1) this.bob += dtMs / (this.def.id.startsWith('slime') ? 120 : 60);
    // Slimes squish through their 3 frames as they hop.
    if (this.def.id === 'slime') this.sprite.setFrame(len > 1 ? Math.floor(now / 160) % 3 : 0);
    this.sync();
    this.drawHp();
  }

  hit(dmg: number, from: { x: number; y: number }) {
    this.hp = Math.max(0, this.hp - dmg);
    const away = new Phaser.Math.Vector2(this.x - from.x, this.y - from.y).normalize().scale(420);
    this.knockback.copy(away);
    this.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(80, () => this.sprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY));
    this.drawHp();
  }

  private drawHp() {
    const g = this.hpBar.clear();
    if (this.hp >= this.def.hp || this.dead) return;
    const w = 32, x = this.x - w / 2, y = this.y - this.sprite.displayHeight - 6;
    g.fillStyle(0x000000, 0.7).fillRect(x - 1, y - 1, w + 2, 6);
    g.fillStyle(0xd94a3d).fillRect(x, y, (w * this.hp) / this.def.hp, 4);
  }

  destroy() {
    super.destroy();
    this.hpBar.destroy();
  }
}
