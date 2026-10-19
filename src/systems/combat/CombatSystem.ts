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

  /** Attacks the way the current job does: a melee swing, or a Firebolt for Mages with MP. */
  playerAttack(now: number) {
    const ps = state.player!;
    // Mages cast Firebolt when they hold a staff and have MP; otherwise they bonk with it.
    if (ps.jobId === 'mage' && weaponType() === 'staff' && ps.mp >= FIREBOLT.mp) {
      if (now - this.lastAttack < FIREBOLT.cooldown) return;
      this.lastAttack = now;
      ps.mp -= FIREBOLT.mp;
      emitStats();
      return this.firebolt();
    }
    const style = { ...(STYLES[ps.jobId] ?? STYLES.adventurer) };
    // The weapon in hand changes the swing: daggers are quick, bare hands are weak.
    const wt = weaponType();
    if (wt === 'dagger') style.cooldown *= 0.8;
    if (!wt) style.power *= 0.6;
    if (now - this.lastAttack < style.cooldown) return;
    this.lastAttack = now;
    const f = this.player.facing;
    const fx = this.player.x + f.x * 28, fy = this.player.y - 20 + f.y * 18;
    const slash = this.scene.add.image(fx, fy, 'slash').setDepth(this.player.y + 1).setRotation(Math.atan2(f.y, f.x));
    if (style.power > 1.1) slash.setScale(1.3).setTint(0xffc070);
    this.scene.tweens.add({ targets: slash, alpha: 0, scale: slash.scale * 1.4, duration: 160, onComplete: () => slash.destroy() });

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
        this.ring(p.x, p.y - 20, 95, 0xffc070);
        for (const m of inRadius(95)) this.damage(m, 1.5, crit);
        break;
      }
      case 'rogue': {
        // Dash Strike: dash forward and cut everything on the way.
        const sx = p.x, sy = p.y;
        p.roll(f.x, f.y, now - 10000);
        p.nextRollAt = now + 400;
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
        for (const m of inRadius(110)) this.damage(m, 1.6, 0.05);
        break;
      }
      default: {
        // Power Strike / Hammer Slam: one heavy hit in front.
        this.ring(p.x + f.x * 34, p.y - 20 + f.y * 18, 40, 0xffe08a);
        for (const m of inRadius(85)) {
          const d = Math.max(1, m.distanceTo(p));
          if (((m.x - p.x) * f.x + (m.y - p.y) * f.y) / d > 0.1) this.damage(m, ps.jobId === 'builder' ? 1.7 : 1.9, crit);
        }
      }
    }
    this.floatText(p.x, p.y - 70, sk.name, '#ffe08a', 15);
    return true;
  }

  private ring(x: number, y: number, r: number, color: number) {
    const g = this.scene.add.graphics().setDepth(y + 200);
    g.lineStyle(4, color, 0.9).strokeCircle(0, 0, r).setPosition(x, y).setScale(0.3, 0.15);
    this.scene.tweens.add({ targets: g, scaleX: 1, scaleY: 0.5, alpha: 0, duration: 260, onComplete: () => g.destroy() });
  }

  private damage(m: Monster, power: number, critChance: number) {
    const ps = state.player!;
    const crit = Math.random() < critChance;
    const dmg = Math.max(1, Math.round((ps.atk * power + Phaser.Math.Between(0, 3) - m.def.def) * (crit ? 1.8 : 1)));
    m.hit(dmg, this.player);
    this.floatText(m.x, m.y - 40, crit ? `${dmg}!` : `${dmg}`, crit ? '#ffd75e' : '#ffffff');
    if (crit) countJobAction('crits');
    if (m.hp === 0) this.kill(m);
  }

  /** Mage spell: a fireball flies in the facing direction and burns the first monster in its path. */
  private firebolt() {
    const f = this.player.facing.clone().normalize();
    const sx = this.player.x, sy = this.player.y - 24;
    let target: Monster | null = null, best = FIREBOLT.range;
    for (const m of this.monsters) {
      if (m.dead) continue;
      const dx = m.x - this.player.x, dy = m.y - this.player.y;
      const along = dx * f.x + dy * f.y;
      const off = Math.abs(dx * f.y - dy * f.x);
      if (along > 0 && along < best && off < 34) (best = along), (target = m);
    }
    const ex = target ? target.x : sx + f.x * FIREBOLT.range, ey = target ? target.y - 24 : sy + f.y * FIREBOLT.range;
    const bolt = this.scene.add.image(sx, sy, 'firebolt').setDepth(this.player.y + 2).setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({
      targets: bolt, x: ex, y: ey,
      duration: (Math.hypot(ex - sx, ey - sy) / FIREBOLT.speed) * 1000,
      onComplete: () => {
        bolt.destroy();
        if (target && !target.dead) this.damage(target, FIREBOLT.power, 0.05);
        const burst = this.scene.add.image(ex, ey, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(ey + 100).setScale(0.6);
        this.scene.tweens.add({ targets: burst, scale: 1.2, alpha: 0, duration: 220, onComplete: () => burst.destroy() });
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

    const zone = this.zoneOf.get(m)!;
    this.zoneOf.delete(m);
    this.scene.time.delayedCall(RESPAWN_MS, () => this.spawn(zone));
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
      .text(x, y, text, { fontFamily: 'monospace', fontSize: `${size}px`, fontStyle: 'bold', color, stroke: '#000', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(200000);
    this.scene.tweens.add({ targets: t, y: y - 30, alpha: 0, duration: 800, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }
}
