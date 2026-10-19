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

const ATTACK_COOLDOWN = 380;
const ATTACK_RANGE = 70;
const RESPAWN_MS = 9000;
const POTION_HEAL = 50; // health_potion effect.heal_hp in seed.sql

/** Spawns monsters, resolves attacks both ways, and awards EXP / gold / loot. */
export class CombatSystem {
  readonly monsters: Monster[] = [];
  private zoneOf = new Map<Monster, SpawnZone>();
  private lastAttack = 0;

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
    for (const m of this.monsters) {
      m.update(now, dtMs, this.player, this.map);
      // Contact damage.
      if (!m.dead && m.distanceTo(this.player) < 30 && now > this.player.invulnerableUntil && !state.inDialogue) {
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

  /** Swing in the facing direction; hits every monster in a forward arc. */
  playerAttack(now: number) {
    if (now - this.lastAttack < ATTACK_COOLDOWN) return;
    this.lastAttack = now;
    const f = this.player.facing;
    const fx = this.player.x + f.x * 28, fy = this.player.y - 20 + f.y * 18;
    const slash = this.scene.add.image(fx, fy, 'slash').setDepth(this.player.y + 1).setRotation(Math.atan2(f.y, f.x));
    this.scene.tweens.add({ targets: slash, alpha: 0, scale: 1.4, duration: 160, onComplete: () => slash.destroy() });

    const ps = state.player!;
    for (const m of this.monsters) {
      if (m.dead) continue;
      const dx = m.x - this.player.x, dy = m.y - this.player.y;
      const dist = Math.hypot(dx, dy);
      const inFront = dist < 1 || (dx * f.x + dy * f.y) / dist > 0.2;
      if (dist > ATTACK_RANGE || !(inFront || dist < 30)) continue;
      const crit = Math.random() < 0.1;
      const dmg = Math.max(1, Math.round((ps.atk + Phaser.Math.Between(0, 3) - m.def.def) * (crit ? 1.8 : 1)));
      m.hit(dmg, this.player);
      this.floatText(m.x, m.y - 40, crit ? `${dmg}!` : `${dmg}`, crit ? '#ffd75e' : '#ffffff');
      if (m.hp === 0) this.kill(m);
    }
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

    const zone = this.zoneOf.get(m)!;
    this.zoneOf.delete(m);
    this.scene.time.delayedCall(RESPAWN_MS, () => this.spawn(zone));
  }

  gainExp(amount: number) {
    const ps = state.player!;
    ps.exp += amount;
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
