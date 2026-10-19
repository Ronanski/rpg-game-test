import Phaser from 'phaser';
import { Monster, MONSTERS } from '../../entities/Monster';
import type { Player } from '../../entities/Player';
import type { IsoMap } from '../../iso/IsoMap';
import { gridToScreen } from '../../iso/iso';
import type { SpawnZone } from '../../world/worldData';
import { state, emitStats, addItem } from '../../core/GameState';
import { bus } from '../../core/EventBus';
import { expToNext } from './ClassSystem';
import { recalcStats, weaponType, ITEMS } from '../items/Items';
import type { QuestTracker } from '../quest/QuestTracker';
import { countJobAction } from './JobSystem';
import * as fx from './Fx';
import { FONT } from '../../ui/theme';

/** How each job attacks. `arc` is the minimum facing alignment (lower = wider swing). */
interface AttackStyle {
  cooldown: number;
  range: number;
  arc: number;
  crit: number;
  power: number;
}
const STYLES: Record<string, AttackStyle> = {
  adventurer: { cooldown: 380, range: 70, arc: 0.2, crit: 0.1, power: 1 },
  warrior: { cooldown: 420, range: 82, arc: -0.15, crit: 0.1, power: 1.25 },
  rogue: { cooldown: 250, range: 66, arc: 0.3, crit: 0.25, power: 0.9 },
  builder: { cooldown: 420, range: 70, arc: 0.2, crit: 0.08, power: 1 },
  mage: { cooldown: 380, range: 60, arc: 0.2, crit: 0.05, power: 0.6 }, // staff bonk when out of MP
};
const FIREBOLT = { mp: 5, range: 300, speed: 520, power: 1.7, cooldown: 480 };
const ARROW = { range: 340, speed: 760, power: 1.05, cooldown: 520 };

/** One special move per job (SKILL button / F key): MP cost, cooldown, and what it does. */
interface SkillDef {
  name: string;
  mp: number;
  cooldown: number;
}
export const SKILLS: Record<string, SkillDef> = {
  adventurer: { name: 'Power Strike', mp: 6, cooldown: 2000 },
  warrior: { name: 'Whirlwind', mp: 10, cooldown: 3000 },
  rogue: { name: 'Dash Strike', mp: 8, cooldown: 2500 },
  mage: { name: 'Flame Nova', mp: 12, cooldown: 4000 },
  builder: { name: 'Hammer Slam', mp: 8, cooldown: 2500 },
};
const MP_REGEN_MS = 1200; // 1 MP per tick
const RACE_BONUS = { humanExp: 1.1, elfMpRegen: 1.2 };
const RESPAWN_MS = 9000;

/** Spawns monsters, resolves attacks both ways, and awards EXP / gold / loot. */
export class CombatSystem {
  readonly monsters: Monster[] = [];
  private zoneOf = new Map<Monster, SpawnZone>();
  private lastAttack = 0;
  private mpTimer = 0;
  /** When the current job's skill is ready again (time in ms). */
  skillReadyAt = 0;

  constructor(
    private scene: Phaser.Scene,
    private map: IsoMap,
    private player: Player,
    private quests: QuestTracker,
    private respawnPoint: { x: number; y: number },
  ) {}

  spawnAll(zones: SpawnZone[]) {
    for (const z of zones) for (let i = 0; i < z.count; i++) this.spawn(z);
  }

  private spawn(z: SpawnZone) {
    for (let tries = 0; tries < 20; tries++) {
      const p = gridToScreen(Phaser.Math.Between(z.x0, z.x1), Phaser.Math.Between(z.y0, z.y1));
      if (!this.map.walkable(p.x, p.y)) continue;
      const m = new Monster(this.scene, p.x, p.y, MONSTERS[z.monster], p);
      this.zoneOf.set(m, z);
      this.monsters.push(m);
      return;
    }
  }

  walkable(x: number, y: number) {
    return this.map.walkable(x, y);
  }

  /** A night raider: marches on `goal`, never respawns. */
  spawnRaider(id: keyof typeof MONSTERS, x: number, y: number, goal: { x: number; y: number }, boost = 1) {
    const def = { ...MONSTERS[id], hp: Math.round(MONSTERS[id].hp * boost), atk: Math.round(MONSTERS[id].atk * boost) };
    const m = new Monster(this.scene, x, y, def, { x, y });
    m.goal = goal;
    m.sprite.setAlpha(0);
    this.scene.tweens.add({ targets: m.sprite, alpha: 1, duration: 400 });
    this.monsters.push(m);
    return m;
  }

  update(now: number, dtMs: number) {
    const ps = state.player!;
    // Slow MP regen (Elves recover faster).
    this.mpTimer += dtMs * (ps.raceId === 'elf' ? RACE_BONUS.elfMpRegen : 1);
    if (this.mpTimer >= MP_REGEN_MS) {
      this.mpTimer -= MP_REGEN_MS;
      if (ps.mp < ps.maxMp) (ps.mp++, emitStats());
    }
    for (const m of this.monsters) {
      m.update(now, dtMs, this.player, this.map);
      // Contact damage.
      if (!m.dead && m.distanceTo(this.player) < 30 && now > this.player.invulnerableUntil && !state.inDialogue && !state.inMenu) {
        const dmg = Math.max(1, m.def.atk - Math.floor(ps.def / 2) + Phaser.Math.Between(-1, 2));
        ps.hp = Math.max(0, ps.hp - dmg);
        this.player.flashHurt(now);
        this.floatText(this.player.x, this.player.y - 50, `-${dmg}`, '#ff6b6b');
        this.scene.cameras.main.shake(90, 0.004);
        emitStats();
        if (ps.hp === 0) this.playerDefeated();
      }
    }
  }

  /**
   * Auto-aim: turn to face the nearest living monster within `range` (so attacks go where the
   * enemies are, not where the hero last walked). Returns true if a target was found.
   */
  private aim(range: number): boolean {
    let best: Monster | null = null, bd = range;
    for (const m of this.monsters) {
      if (m.dead) continue;
      const d = m.distanceTo(this.player);
      if (d < bd) (bd = d), (best = m);
    }
    if (!best) return false;
    this.player.facing.set(best.x - this.player.x, best.y - this.player.y).normalize();
    if (Math.abs(this.player.facing.x) > 0.05) this.player.sprite.setFlipX(this.player.facing.x < 0);
    return true;
  }

  /** Attacks the way the current job does: a melee swing, or a Firebolt for Mages with MP. */
  playerAttack(now: number) {
    const ps = state.player!;
    const wt0 = weaponType();
    this.aim(wt0 === 'bow' ? ARROW.range : ps.jobId === 'mage' && wt0 === 'staff' ? FIREBOLT.range : 120);
    // Mages cast Firebolt when they hold a staff and have MP; otherwise they bonk with it.
    if (ps.jobId === 'mage' && weaponType() === 'staff' && ps.mp >= FIREBOLT.mp) {
      if (now - this.lastAttack < FIREBOLT.cooldown) return;
      this.lastAttack = now;
      ps.mp -= FIREBOLT.mp;
      emitStats();
      this.player.attackAnim('cast', null);
      this.scene.time.delayedCall(90, () => this.firebolt());
      return;
    }
    const style = { ...(STYLES[ps.jobId] ?? STYLES.adventurer) };
    // The weapon in hand changes the swing: daggers are quick, bare hands are weak, bows shoot.
    const wt = weaponType();
    if (wt === 'bow') {
      if (now - this.lastAttack < ARROW.cooldown) return;
      this.lastAttack = now;
      this.player.attackAnim('bow', null);
      // Nocked arrow at the bow, pulled back during the draw; it flies on release.
      const f0 = this.player.facing.clone().normalize();
      const nock = this.scene.add.image(this.player.x + f0.x * 18, this.player.y - 26, 'arrow').setScale(1.6)
        .setRotation(Math.atan2(f0.y, f0.x)).setDepth(this.player.y + 3);
      this.scene.tweens.add({ targets: nock, x: nock.x - f0.x * 10, duration: 100, onComplete: () => nock.destroy() });
      this.scene.time.delayedCall(110, () => this.shoot('arrow', ARROW.range, ARROW.speed, style.power * ARROW.power, style.crit));
      return;
    }
    if (wt === 'dagger') style.cooldown *= 0.8;
    if (!wt) style.power *= 0.6;
    if (now - this.lastAttack < style.cooldown) return;
    this.lastAttack = now;
    const f = this.player.facing;
    const sx = this.player.x + f.x * 28, fy = this.player.y - 20 + f.y * 18;
    const heavy = style.power > 1.1;
    fx.slash(this.scene, sx, fy, Math.atan2(f.y, f.x), heavy ? 1.35 : wt === 'dagger' ? 0.8 : 1, heavy ? 0xffc070 : 0xe8f4ff);
    const w = state.equipment.weapon;
    this.player.attackAnim('swing', w ? ITEMS[w].icon : null);

    // Trees, rocks and crystals in reach give resources (TownSystem listens).
    bus.emit('player-swing', { x: this.player.x, y: this.player.y, fx: f.x, fy: f.y, range: style.range + 10 });
    for (const m of this.monsters) {
      if (m.dead) continue;
      const dx = m.x - this.player.x, dy = m.y - this.player.y;
      const dist = Math.hypot(dx, dy);
      const inFront = dist < 1 || (dx * f.x + dy * f.y) / dist > style.arc;
      if (dist > style.range || !(inFront || dist < 30)) continue;
      this.damage(m, style.power, style.crit);
    }
  }

  /** The current job's special move. Returns false if on cooldown or out of MP. */
  useSkill(now: number): boolean {
    const ps = state.player!;
    const sk = SKILLS[ps.jobId] ?? SKILLS.adventurer;
    if (now < this.skillReadyAt) return false;
    if (ps.mp < sk.mp) {
      bus.emit('toast', `Not enough MP for ${sk.name}`);
      return false;
    }
    this.aim(160);
    ps.mp -= sk.mp;
    this.skillReadyAt = now + sk.cooldown;
    state.cooldowns.skillReady = this.skillReadyAt;
    state.cooldowns.skillTotal = sk.cooldown;
    emitStats();
    const p = this.player, f = p.facing.clone().normalize();
    const crit = STYLES[ps.jobId]?.crit ?? 0.1;
    const inRadius = (r: number) => this.monsters.filter((m) => !m.dead && m.distanceTo(p) < r);
    switch (ps.jobId) {
      case 'warrior': {
        // Whirlwind: hits everything around you.
        fx.ring(this.scene, p.x, p.y - 6, 95, 0xffc070, 6);
        for (let i = 0; i < 4; i++) this.scene.time.delayedCall(i * 60, () => fx.slash(this.scene, p.x, p.y - 22, (i * Math.PI) / 2, 1.6, 0xffc070));
        // Spin: flip back and forth quickly (no rotation; see Player.pose).
        for (let i = 1; i <= 4; i++) this.scene.time.delayedCall(i * 60, () => p.sprite.setFlipX(!p.sprite.flipX));
        this.scene.cameras.main.shake(140, 0.006);
        for (const m of inRadius(95)) this.damage(m, 1.5, crit);
        break;
      }
      case 'rogue': {
        // Dash Strike: dash forward and cut everything on the way.
        const sx = p.x, sy = p.y;
        p.roll(f.x, f.y, now - 10000);
        p.nextRollAt = now + 400;
        for (let i = 1; i <= 5; i++) this.scene.time.delayedCall(i * 40, () => fx.afterimage(this.scene, p.sprite, 0xb08aff));
        this.scene.time.delayedCall(240, () => {
          for (const m of this.monsters) {
            if (m.dead) continue;
            const t = Phaser.Math.Clamp(((m.x - sx) * (p.x - sx) + (m.y - sy) * (p.y - sy)) / Math.max(1, (p.x - sx) ** 2 + (p.y - sy) ** 2), 0, 1);
            if (Math.hypot(m.x - (sx + (p.x - sx) * t), m.y - (sy + (p.y - sy) * t)) < 40) this.damage(m, 2, 0.4);
          }
        });
        break;
      }
      case 'mage': {
        // Flame Nova: a burst of fire around you.
        const nova = this.scene.add.image(p.x, p.y - 20, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(p.y + 3).setScale(0.3);
        this.scene.tweens.add({ targets: nova, scale: 2.4, alpha: 0, duration: 380, onComplete: () => nova.destroy() });
        fx.ring(this.scene, p.x, p.y - 4, 110, 0xff8a3a, 7);
        fx.flames(this.scene, p.x, p.y - 10, 100);
        this.scene.cameras.main.shake(160, 0.007);
        for (const m of inRadius(110)) this.damage(m, 1.6, 0.05);
        break;
      }
      default: {
        // Power Strike / Hammer Slam: one heavy hit in front.
        const hx = p.x + f.x * 36, hy = p.y - 20 + f.y * 18;
        fx.slash(this.scene, hx - f.x * 10, hy, Math.atan2(f.y, f.x), 1.8, 0xffe08a);
        fx.ring(this.scene, hx, hy + 18, 60, 0xffe08a, 6);
        fx.sparks(this.scene, hx, hy, 0xffe08a, 16, 220);
        this.scene.cameras.main.shake(120, 0.006);
        for (const m of inRadius(85)) {
          const d = Math.max(1, m.distanceTo(p));
          if (((m.x - p.x) * f.x + (m.y - p.y) * f.y) / d > 0.1) this.damage(m, ps.jobId === 'builder' ? 1.7 : 1.9, crit);
        }
      }
    }
    this.floatText(p.x, p.y - 70, sk.name, '#ffe08a', 15);
    return true;
  }

  /** Flat damage from a building (tower arrow, trap). Kills still give EXP and loot. */
  structureHit(m: Monster, dmg: number) {
    if (m.dead) return;
    const d = Math.max(1, dmg - m.def.def);
    m.hit(d, { x: m.x, y: m.y + 1 });
    fx.sparks(this.scene, m.x, m.y - m.sprite.displayHeight / 2, 0xffe0b0, 6, 120);
    this.floatText(m.x, m.y - 40, `${d}`, '#ffe0b0', 16);
    if (m.hp === 0) this.kill(m);
  }

  /** Arrow from a tower top at a monster. */
  towerShot(fromX: number, fromY: number, m: Monster, dmg: number) {
    const ex = m.x, ey = m.y - 20;
    const shot = this.scene.add.image(fromX, fromY, 'arrow').setDepth(190000).setRotation(Math.atan2(ey - fromY, ex - fromX));
    this.scene.tweens.add({
      targets: shot, x: ex, y: ey, duration: (Math.hypot(ex - fromX, ey - fromY) / 700) * 1000,
      onComplete: () => (shot.destroy(), this.structureHit(m, dmg)),
    });
  }

  private damage(m: Monster, power: number, critChance: number) {
    const ps = state.player!;
    const crit = Math.random() < critChance;
    const dmg = Math.max(1, Math.round((ps.atk * power + Phaser.Math.Between(0, 3) - m.def.def) * (crit ? 1.8 : 1)));
    m.hit(dmg, this.player);
    fx.sparks(this.scene, m.x, m.y - m.sprite.displayHeight / 2, crit ? 0xffd75e : 0xffffff, crit ? 16 : 8, crit ? 220 : 150);
    if (crit) (fx.hitStop(this.scene), this.scene.cameras.main.shake(80, 0.005));
    this.floatText(m.x, m.y - 40, crit ? `${dmg}!` : `${dmg}`, crit ? '#ffd75e' : '#ffffff', crit ? 24 : 18);
    if (crit) countJobAction('crits');
    if (m.hp === 0) this.kill(m);
  }

  /** Mage spell: a fireball flies in the facing direction and burns the first monster in its path. */
  private firebolt() {
    this.shoot('firebolt', FIREBOLT.range, FIREBOLT.speed, FIREBOLT.power, 0.05);
  }

  /** Fires a projectile (firebolt or arrow) at the first monster in the facing direction. */
  private shoot(kind: 'firebolt' | 'arrow', range: number, speed: number, power: number, crit: number) {
    const f = this.player.facing.clone().normalize();
    const sx = this.player.x + f.x * 12, sy = this.player.y - 26;
    let target: Monster | null = null, best = range;
    for (const m of this.monsters) {
      if (m.dead) continue;
      const dx = m.x - this.player.x, dy = m.y - this.player.y;
      const along = dx * f.x + dy * f.y;
      const off = Math.abs(dx * f.y - dy * f.x);
      if (along > 0 && along < best && off < 34) (best = along), (target = m);
    }
    const ex = target ? target.x : sx + f.x * range, ey = target ? target.y - 24 : sy + f.y * range;
    const fire = kind === 'firebolt';
    const shot = this.scene.add.image(sx, sy, kind).setDepth(190000).setRotation(Math.atan2(ey - sy, ex - sx)).setScale(kind === 'arrow' ? 1.6 : 1);
    if (fire) shot.setBlendMode(Phaser.BlendModes.ADD);
    // Trail: fire leaves embers, arrows a faint streak.
    const trail = this.scene.add.particles(0, 0, 'spark', {
      follow: shot, lifespan: fire ? 260 : 140, frequency: fire ? 18 : 30,
      scale: { start: fire ? 1.4 : 0.6, end: 0 }, alpha: { start: 0.8, end: 0 },
      tint: fire ? [0xffe08a, 0xff7a2a] : 0xe8f4ff, blendMode: Phaser.BlendModes.ADD,
    }).setDepth(189999);
    this.scene.tweens.add({
      targets: shot, x: ex, y: ey,
      // At least ~120 ms in the air so even point-blank shots are visible.
      duration: Math.max(120, (Math.hypot(ex - sx, ey - sy) / speed) * 1000),
      onComplete: () => {
        shot.destroy();
        trail.stop();
        this.scene.time.delayedCall(300, () => trail.destroy());
        if (target && !target.dead) this.damage(target, power, crit);
        if (fire) {
          fx.flames(this.scene, ex, ey + 10, 24);
          fx.ring(this.scene, ex, ey + 20, 30, 0xff8a3a, 4);
        } else if (!target) fx.dust(this.scene, ex, ey + 24);
      },
    });
  }

  /** Drinks a potion (health by default). Does nothing when that bar is full or none are left. */
  usePotion(id = 'health_potion') {
    const ps = state.player!;
    const it = ITEMS[id];
    if ((state.inventory.get(id) ?? 0) <= 0) return bus.emit('toast', `No ${it.name}s left`);
    const hp = it.heal?.hp ?? 0, mp = it.heal?.mp ?? 0;
    if ((hp && ps.hp >= ps.maxHp && !mp) || (mp && ps.mp >= ps.maxMp && !hp)) return bus.emit('toast', hp ? 'HP is already full' : 'MP is already full');
    addItem(id, -1);
    const gotHp = Math.min(hp, ps.maxHp - ps.hp), gotMp = Math.min(mp, ps.maxMp - ps.mp);
    ps.hp += gotHp;
    ps.mp += gotMp;
    if (gotHp) this.floatText(this.player.x, this.player.y - 50, `+${gotHp}`, '#7dff8a');
    if (gotMp) this.floatText(this.player.x, this.player.y - 66, `+${gotMp} MP`, '#7fb8ff');
    emitStats();
  }

  private kill(m: Monster) {
    m.dead = true;
    m.hpBar.clear();
    this.scene.tweens.add({
      targets: [m.sprite, m.shadow],
      alpha: 0,
      scaleY: 0.5,
      duration: 300,
      onComplete: () => {
        m.destroy();
        this.monsters.splice(this.monsters.indexOf(m), 1);
      },
    });

    const ps = state.player!;
    ps.gold += m.def.gold;
    this.floatText(m.x, m.y - 60, `+${m.def.exp} EXP`, '#9fe3ff');
    for (const d of [m.def.drop, ...(m.def.extra ?? [])]) {
      if (Math.random() >= d.chance) continue;
      addItem(d.item);
      bus.emit('toast', `Got ${ITEMS[d.item]?.name ?? d.item}`);
    }
    this.gainExp(m.def.exp);
    this.quests.onKill(m.def.id);
    countJobAction('kills');

    const zone = this.zoneOf.get(m);
    this.zoneOf.delete(m);
    if (zone) this.scene.time.delayedCall(RESPAWN_MS, () => this.spawn(zone));
    else bus.emit('raider-down', m);
  }

  gainExp(amount: number) {
    const ps = state.player!;
    ps.exp += Math.round(amount * (ps.raceId === 'human' ? RACE_BONUS.humanExp : 1));
    while (ps.exp >= ps.expToNext) {
      ps.exp -= ps.expToNext;
      ps.level++;
      ps.expToNext = expToNext(ps.level);
      recalcStats(true);
      this.floatText(this.player.x, this.player.y - 80, 'LEVEL UP!', '#ffd75e', 26);
      bus.emit('toast', `Level ${ps.level}!`);
    }
    emitStats();
  }

  private playerDefeated() {
    const ps = state.player!;
    const lost = Math.floor(ps.gold * 0.1);
    ps.gold -= lost;
    ps.hp = ps.maxHp;
    this.player.teleport(this.respawnPoint.x, this.respawnPoint.y);
    this.player.invulnerableUntil = this.scene.time.now + 2000;
    this.scene.cameras.main.flash(400, 120, 0, 0);
    bus.emit('toast', lost ? `You were defeated... lost ${lost} gold` : 'You were defeated...');
    emitStats();
  }

  floatText(x: number, y: number, text: string, color: string, size = 18) {
    const t = this.scene.add
      .text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, color, stroke: '#07080e', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(200000);
    this.scene.tweens.add({ targets: t, y: y - 30, alpha: 0, duration: 800, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }
}
