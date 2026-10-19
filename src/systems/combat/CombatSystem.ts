import Phaser from 'phaser';
import { Monster, MONSTERS } from '../../entities/Monster';
import type { Player } from '../../entities/Player';
import type { IsoMap } from '../../iso/IsoMap';
import { gridToScreen } from '../../iso/iso';
import type { SpawnZone } from '../../world/worldData';
import { state, emitStats, addItem } from '../../core/GameState';
import { bus } from '../../core/EventBus';
import { computeStats, expToNext } from './ClassSystem';
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
const MP_REGEN_MS = 1200; // 1 MP per tick
const RACE_BONUS = { humanExp: 1.1, elfMpRegen: 1.2 };
const RESPAWN_MS = 9000;
const POTION_HEAL = 50; // health_potion effect.heal_hp in seed.sql

/** Spawns monsters, resolves attacks both ways, and awards EXP / gold / loot. */
export class CombatSystem {
  readonly monsters: Monster[] = [];
  private zoneOf = new Map<Monster, SpawnZone>();
  private lastAttack = 0;
  private mpTimer = 0;

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
    if (ps.jobId === 'mage' && ps.mp >= FIREBOLT.mp) {
      if (now - this.lastAttack < FIREBOLT.cooldown) return;
      this.lastAttack = now;
      ps.mp -= FIREBOLT.mp;
      emitStats();
      return this.firebolt();
    }
    const style = STYLES[ps.jobId] ?? STYLES.adventurer;
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

  /** Drinks a health potion. Does nothing at full HP or with none left. */
  usePotion() {
    const ps = state.player!;
    const have = state.inventory.get('health_potion') ?? 0;
    if (have <= 0) return bus.emit('toast', 'No health potions left');
    if (ps.hp >= ps.maxHp) return bus.emit('toast', 'HP is already full');
    addItem('health_potion', -1);
    const healed = Math.min(POTION_HEAL, ps.maxHp - ps.hp);
    ps.hp += healed;
    this.floatText(this.player.x, this.player.y - 50, `+${healed}`, '#7dff8a');
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
    if (Math.random() < m.def.drop.chance) {
      addItem(m.def.drop.item);
      bus.emit('toast', `Got ${m.def.drop.item.replace('_', ' ')}`);
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
      const s = computeStats(ps.raceId, ps.jobId, ps.level);
      Object.assign(ps, { maxHp: s.hp, maxMp: s.mp, atk: s.atk, def: s.def, spd: s.spd, hp: s.hp, mp: s.mp });
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
