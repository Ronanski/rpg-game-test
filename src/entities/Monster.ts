import Phaser from 'phaser';
import { Actor } from './Actor';
import type { IsoMap } from '../iso/IsoMap';
import { screenToTile } from '../iso/iso';
import { inTown, isSafeTile } from '../world/worldData';
import { FONT } from '../ui/theme';
import { isMonsterAnim } from '../assets/sprites';

const LEASH = 280; // wild monsters give up a chase this far from home

/** Which way each monster's art faces (it is mirrored to face the other way). */
const FACES_LEFT = new Set(['goblin', 'orc', 'skeleton', 'zombie', 'bat']);
const FACES_RIGHT = new Set(['wolf', 'dragon']);

/** Raiders push through trees and rocks in the wilds (only the town's walls stop them). */
function inTownAt(x: number, y: number) {
  const t = screenToTile(x, y);
  return inTown(t.x, t.y);
}

function safeAt(x: number, y: number) {
  const t = screenToTile(x, y);
  return isSafeTile(t.x, t.y);
}

export interface MonsterDef {
  id: 'slime' | 'slime_blue' | 'slime_red' | 'wolf' | 'goblin' | 'orc' | 'skeleton' | 'zombie' | 'bat' | 'spider' | 'slime_king' | 'dragon';
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
  /** Night boss: shown with this title, a big health bar and a larger body. */
  boss?: string;
  /** Size multiplier for the sprite. */
  size?: number;
  /** Story boss tag: quests count it by this, and a "<tag>_down" story flag is set when it falls. */
  tag?: string;
}

export const MONSTERS: Record<MonsterDef['id'], MonsterDef> = {
  slime: { id: 'slime', name: 'Slime', hp: 30, atk: 7, def: 1, speed: 55, aggroRange: 170, exp: 12, gold: 3, drop: { item: 'slime_gel', chance: 0.6 } },
  slime_blue: { id: 'slime_blue', name: 'Blue Slime', hp: 45, atk: 9, def: 2, speed: 60, aggroRange: 180, exp: 18, gold: 5, drop: { item: 'slime_gel', chance: 0.7 }, extra: [{ item: 'mana_potion', chance: 0.15 }] },
  goblin: { id: 'goblin', name: 'Goblin', hp: 50, atk: 11, def: 2, speed: 90, aggroRange: 210, exp: 24, gold: 10, drop: { item: 'health_potion', chance: 0.2 }, extra: [{ item: 'iron_sword', chance: 0.04 }, { item: 'leather_armor', chance: 0.05 }, { item: 'oak_staff', chance: 0.04 }] },
  orc: { id: 'orc', name: 'Orc', hp: 120, atk: 16, def: 5, speed: 60, aggroRange: 200, exp: 45, gold: 18, drop: { item: 'health_potion', chance: 0.3 }, extra: [{ item: 'iron_sword', chance: 0.06 }] },
  skeleton: { id: 'skeleton', name: 'Skeleton', hp: 70, atk: 13, def: 4, speed: 80, aggroRange: 200, exp: 32, gold: 12, drop: { item: 'mana_potion', chance: 0.2 } },
  slime_red: { id: 'slime_red', name: 'Fire Slime', hp: 40, atk: 10, def: 1, speed: 60, aggroRange: 180, exp: 16, gold: 4, drop: { item: 'slime_gel', chance: 0.6 } },
  zombie: { id: 'zombie', name: 'Zombie', hp: 90, atk: 14, def: 3, speed: 45, aggroRange: 190, exp: 30, gold: 9, drop: { item: 'health_potion', chance: 0.15 } },
  bat: { id: 'bat', name: 'Bat', hp: 25, atk: 8, def: 0, speed: 120, aggroRange: 220, exp: 14, gold: 3, drop: { item: 'mana_potion', chance: 0.1 } },
  spider: { id: 'spider', name: 'Cave Spider', hp: 45, atk: 11, def: 2, speed: 95, aggroRange: 200, exp: 20, gold: 6, drop: { item: 'health_potion', chance: 0.1 } },
  // Night bosses only (never in the wilds).
  // (Gravemaw, the cave boss, is a King Slime grown huge on the Core's light: see GRAVEMAW.)
  slime_king: { id: 'slime_king', name: 'King Slime', hp: 160, atk: 14, def: 4, speed: 50, aggroRange: 200, exp: 60, gold: 25, drop: { item: 'slime_gel', chance: 1 }, extra: [{ item: 'health_potion', chance: 0.6 }] },
  dragon: { id: 'dragon', name: 'Dragon', hp: 220, atk: 18, def: 8, speed: 55, aggroRange: 240, exp: 150, gold: 80, drop: { item: 'health_potion', chance: 1 }, extra: [{ item: 'iron_sword', chance: 0.3 }], size: 0.6 },
  wolf: { id: 'wolf', name: 'Wolf', hp: 60, atk: 12, def: 3, speed: 105, aggroRange: 230, exp: 28, gold: 8, drop: { item: 'wolf_pelt', chance: 0.5 } },
};

/** The boss at the bottom of the Old Cave (Chapter 1). */
export const GRAVEMAW: MonsterDef = {
  ...MONSTERS.slime_king, name: 'Gravemaw', boss: 'Gravemaw', tag: 'gravemaw', hp: 650, atk: 17, def: 5, speed: 45,
  aggroRange: 260, exp: 300, gold: 120, size: 1.7, drop: { item: 'old_locket', chance: 1 }, extra: [{ item: 'health_potion', chance: 1 }],
};

/** Simple AI: wander near home, chase the player when close, give up when too far. */
export class Monster extends Actor {
  hp: number;
  readonly hpBar: Phaser.GameObjects.Graphics;
  private title: Phaser.GameObjects.Text | null = null;
  /** Drawn frames (idle, attack, hurt, dying); an attack or hurt frame shows until `actionUntil`. */
  readonly animated: boolean;
  private actionUntil = 0;
  /** Slowed (Mage Tower frost): speed multiplier until `slowUntil`. */
  private slowBy = 1;
  private slowUntil = 0;
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
    this.animated = isMonsterAnim(def.id);
    this.hp = def.hp;
    if (def.size) (this.baseScale *= def.size), this.sprite.setScale(this.baseScale);
    this.hpBar = scene.add.graphics().setDepth(100000);
    if (def.boss) {
      this.title = scene.add
        .text(x, y, def.boss, { fontFamily: FONT, fontStyle: 'bold', resolution: 2, fontSize: '13px', color: '#ffb347', stroke: '#07080e', strokeThickness: 4 })
        .setOrigin(0.5, 1)
        .setDepth(100000);
      // A dark-red glow under the boss's feet.
      this.shadow.setVisible(true).setTint(0x8a1a1a).setScale(1.8);
    }
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
    const chilled = this.scene.time.now < this.slowUntil;
    if (!chilled && this.slowBy !== 1) (this.slowBy = 1), this.sprite.clearTint();
    const speed = (this.wanderTarget ? this.def.speed * 0.4 : this.def.speed) * (chilled ? this.slowBy : 1);
    let mx = len > 1 ? (vx / len) * speed * dt : 0;
    let my = len > 1 ? (vy / len) * speed * dt : 0;
    // Stop just short of the player instead of stacking on top of them.
    if (!this.wanderTarget && dist < 26) mx = my = 0;
    mx += this.knockback.x * dt;
    my += this.knockback.y * dt;
    this.knockback.scale(Math.pow(0.0005, dt));

    const ox = this.x, oy = this.y;
    // Wild monsters stay out of the village and the town (raiders don't).
    const ok = (x: number, y: number) =>
      this.goal ? map.walkable(x, y) || !inTownAt(x, y) : map.walkable(x, y) && !safeAt(x, y);
    if (ok(this.x + mx, this.y)) this.x += mx;
    if (ok(this.x, this.y + my)) this.y += my;
    this.heading.set(vx, vy).normalize();
    this.stuck = len > 1 && Math.hypot(this.x - ox, this.y - oy) < 0.05 * Math.hypot(mx, my) + 0.01;
    this.stuckMs = this.stuck ? this.stuckMs + dtMs : 0;
    if (Math.abs(mx) > 0.01) {
      if (FACES_LEFT.has(this.def.id)) this.sprite.setFlipX(mx > 0);
      else if (FACES_RIGHT.has(this.def.id)) this.sprite.setFlipX(mx < 0);
    }
    if (len > 1) this.bob += dtMs / (this.def.id.startsWith('slime') ? 120 : 60);
    // Drawn monsters step between their two idle poses (faster while moving).
    // (Attack and hurt frames are timed on the scene clock, like strikeAnim and hit.)
    const t = this.scene.time.now;
    if (this.animated && t > this.actionUntil) this.sprite.setFrame(Math.floor(t / (len > 1 ? 180 : 420)) % 2);
    this.sync();
    this.drawHp();
  }

  /** Frost: moves at `factor` speed for `ms`, tinted icy blue. */
  slow(factor: number, ms: number) {
    this.slowBy = factor;
    this.slowUntil = this.scene.time.now + ms;
    this.sprite.setTint(0x9fd8ff);
  }

  /** Wind-up then strike (when it bites the hero or hits a building). */
  strikeAnim() {
    if (!this.animated || this.dead) return;
    const now = this.scene.time.now;
    this.actionUntil = now + 300;
    this.sprite.setFrame(2);
    this.scene.time.delayedCall(110, () => !this.dead && this.sprite.setFrame(3));
  }

  /** Falls over (drawn dying frames). Returns false if the monster has none. */
  dieAnim(): boolean {
    if (!this.animated) return false;
    this.sprite.setFrame(5);
    this.scene.time.delayedCall(140, () => this.sprite.active && this.sprite.setFrame(6));
    return true;
  }

  hit(dmg: number, from: { x: number; y: number }) {
    if (this.animated) {
      this.actionUntil = this.scene.time.now + 160;
      this.sprite.setFrame(4);
    }
    this.hp = Math.max(0, this.hp - dmg);
    const away = new Phaser.Math.Vector2(this.x - from.x, this.y - from.y).normalize().scale(420);
    this.knockback.copy(away);
    this.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(80, () => this.sprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY));
    this.drawHp();
  }

  private drawHp() {
    const g = this.hpBar.clear();
    const top = this.y - this.sprite.displayHeight - 6;
    this.title?.setPosition(this.x, top - 4).setVisible(!this.dead);
    if (this.dead || (this.hp >= this.def.hp && !this.def.boss)) return;
    const w = this.def.boss ? 64 : 32, x = this.x - w / 2, y = top;
    g.fillStyle(0x000000, 0.7).fillRect(x - 1, y - 1, w + 2, 6);
    g.fillStyle(0xd94a3d).fillRect(x, y, (w * this.hp) / this.def.hp, 4);
  }

  destroy() {
    super.destroy();
    this.hpBar.destroy();
    this.title?.destroy();
  }
}
