import Phaser from 'phaser';
import { state } from '../../core/GameState';
import { bus } from '../../core/EventBus';
import { gridToScreen, screenToTile } from '../../iso/iso';
import type { CombatSystem } from '../combat/CombatSystem';
import type { Monster, MonsterDef } from '../../entities/Monster';
import type { TownSystem } from './TownSystem';
import { AMBIENT, type LightingSystem } from '../LightingSystem';
import { give } from './Economy';

// Day / night cycle and night raids on the Ancient Core.
// Days last DAY_MS of game time (it pauses in menus and while the game is closed). At nightfall a
// wave of monsters walks in from the wilds toward the Core: towers shoot them, walls block them
// (raiders break walls they're stuck on), and they hit the Core when they reach it. Clear the wave
// to win gold and wood and bring the morning; if the Core falls, the raiders loot the town.

const DAY_MS = 150_000;
const DUSK_MS = 25_000; // last part of the day, getting darker (warning)
const CORE_REACH = 46;
/** Share of gold, wood and stone the raiders take when the Core falls. */
const LOOT = 0.15;
/** A night never lasts longer than this: the raiders still out there flee at dawn. */
const NIGHT_MAX_MS = 150_000; // px from the Core's centre where raiders can hit it
// Grid tiles at the wild edges around the town grounds (east of the river, which raiders can't cross).
const SPAWNS = [[61, 42], [62, 51], [61, 61], [52, 62], [44, 62]];

type Id = MonsterDef['id'];

/** Which monsters come on a given night (stronger mixes on later nights). */
function waveFor(day: number): { ids: Id[]; boost: number } {
  const pool: Id[] = day < 2 ? ['slime', 'slime_red'] : day < 3 ? ['slime_red', 'wolf', 'goblin', 'bat'] : day < 5 ? ['wolf', 'goblin', 'skeleton', 'zombie'] : ['goblin', 'skeleton', 'orc', 'zombie', 'spider'];
  // Night 1 is a gentle start; from about night 5 the hero alone can't hold every side.
  const count = 3 + day * 3;
  const ids = Array.from({ length: count }, (_, i) => pool[i % pool.length]);
  if (day >= 4) ids.push('orc');
  if (day >= 7) ids.push('orc', 'skeleton');
  return { ids, boost: 1 + Math.max(0, day - 2) * 0.15 };
}

/** Raiders come in groups of a few at once, from different sides. */
function spawnTime(i: number, day: number) {
  const group = Math.floor(i / 3);
  return 800 + group * Math.max(1600, 3200 - day * 150) + (i % 3) * 120;
}

/** Each night a different boss leads the raid; after the Dragon the list repeats, stronger. */
const BOSSES: { id: Id; title: string }[] = [
  { id: 'wolf', title: 'Alpha Wolf' },
  { id: 'goblin', title: 'Goblin Chief' },
  { id: 'slime_king', title: 'King Slime' },
  { id: 'skeleton', title: 'Skeleton Knight' },
  { id: 'orc', title: 'Orc Warlord' },
  { id: 'dragon', title: 'Ancient Dragon' },
];

/** Tonight's boss and how much tougher than a normal one it is (grows every night). */
export function bossFor(day: number) {
  const b = BOSSES[(day - 1) % BOSSES.length];
  const round = Math.floor((day - 1) / BOSSES.length); // how many times the list came around
  return { ...b, hp: 1.8 + day * 0.25 + round * 1.0, atk: 1.0 + day * 0.03 + round * 0.2 };
}

export class WaveSystem {
  private raiders: Monster[] = [];
  private toSpawn: { id: Id; at: number; boost: number; boss?: ReturnType<typeof bossFor> }[] = [];

  constructor(
    private scene: Phaser.Scene,
    private combat: CombatSystem,
    private town: TownSystem,
    private lighting: LightingSystem,
  ) {
    const down = (m: Monster) => this.onRaiderDown(m);
    const fallen = () => this.coreFallen();
    const start = () => this.startNight();
    bus.on('raider-down', down);
    bus.on('core-fallen', fallen);
    bus.on('start-night', start);
    scene.events.once('shutdown', () => (bus.off('raider-down', down), bus.off('core-fallen', fallen), bus.off('start-night', start)));
    this.applyLight();
  }

  get raidersLeft() {
    return this.raiders.length + this.toSpawn.length;
  }

  update(now: number, dtMs: number) {
    const c = state.cycle;
    if (state.inMenu || state.inDialogue) return; // the clock stops in menus
    if (c.phase === 'day') {
      c.left -= dtMs;
      if (c.left <= 0) this.startNight();
    } else {
      this.spawnDue(now);
      this.raid(now);
      c.left += dtMs; // time spent in the night so far
      if (c.left >= NIGHT_MAX_MS && state.cycle.phase === 'night') this.retreat();
    }
    this.applyLight();
    const core = this.town.core;
    bus.emit('cycle-tick', { raiders: this.raidersLeft, coreHp: core.hp ?? this.town.maxHp(core), coreMax: this.town.maxHp(core) });
  }

  // ---------------------------------------------------------------- phases

  /** Nightfall (or the player called the wave early). */
  startNight() {
    const c = state.cycle;
    if (c.phase === 'night') return;
    c.phase = 'night';
    c.left = 0;
    const { ids, boost } = waveFor(c.day);
    const t = this.scene.time.now;
    this.toSpawn = ids.map((id, i) => ({ id, at: t + spawnTime(i, c.day), boost }));
    // The boss walks in behind its pack.
    const boss = bossFor(c.day);
    this.toSpawn.push({ id: boss.id, at: t + spawnTime(ids.length, c.day) + 1500, boost, boss });
    bus.emit('toast', `Night ${c.day}: the ${boss.title} leads the monsters to the Ancient Core!`);
    this.scene.cameras.main.flash(500, 40, 20, 80);
  }

  /** The night ran out: the raiders still around run off, and morning comes. */
  private retreat() {
    this.toSpawn = [];
    for (const m of this.raiders) {
      m.dead = true;
      m.hpBar.clear();
      this.scene.tweens.add({ targets: [m.sprite, m.shadow], alpha: 0, duration: 500, onComplete: () => this.combat.remove(m) });
    }
    this.raiders = [];
    bus.emit('toast', 'Dawn breaks. The last raiders flee.');
    this.dawn(true);
  }

  private dawn(won: boolean) {
    const c = state.cycle;
    if (won) {
      const gold = 30 * c.day, wood = 20 * c.day, stone = 10 * c.day;
      give('gold', gold);
      give('wood', wood);
      give('stone', stone);
      bus.emit('toast', `Night ${c.day} survived! +${gold} gold, +${wood} wood, +${stone} stone`);
    }
    // A lost night is played again the next evening (not a harder one), so a fall can be won back.
    if (won) c.day++;
    else bus.emit('toast', `The Core fell. Night ${c.day} will come again: build up and try once more.`);
    c.phase = 'day';
    c.left = DAY_MS;
    this.town.repairAll();
    bus.emit('town-changed');
    this.scene.cameras.main.flash(600, 255, 240, 200);
  }

  // ---------------------------------------------------------------- raid

  private spawnDue(now: number) {
    const goal = this.town.corePoint();
    while (this.toSpawn.length && this.toSpawn[0].at <= now) {
      const s = this.toSpawn.shift()!;
      const [gx, gy] = SPAWNS[Phaser.Math.Between(0, SPAWNS.length - 1)];
      let p = gridToScreen(gx + Phaser.Math.FloatBetween(-0.4, 0.4), gy + Phaser.Math.FloatBetween(-0.4, 0.4));
      // Nudge off trees and rocks.
      for (let k = 0; k < 12 && !this.combat.walkable(p.x, p.y); k++) p = gridToScreen(gx + Phaser.Math.Between(-2, 2), gy + Phaser.Math.Between(0, 3));
      const m = this.combat.spawnRaider(s.id, p.x, p.y, { x: goal.x + Phaser.Math.Between(-20, 20), y: goal.y + Phaser.Math.Between(-8, 8) }, s.boost, s.boss);
      if (s.boss) {
        bus.emit('toast', `The ${s.boss.title} has appeared!`);
        this.scene.cameras.main.shake(300, 0.006);
      }
      this.raiders.push(m);
    }
    if (!this.toSpawn.length && !this.raiders.length && state.cycle.phase === 'night') this.dawn(true);
  }

  /** Raiders hit the Core when they reach it, and break walls they are stuck against. */
  private raid(now: number) {
    const core = this.town.corePoint();
    for (const m of this.raiders) {
      if (m.dead || now < m.nextStrike) continue;
      if (Phaser.Math.Distance.Between(m.x, m.y, core.x, core.y) < CORE_REACH) {
        m.nextStrike = now + 1000;
        this.strike(m, core.x, core.y);
        this.town.damage(this.town.core, m.def.atk);
        continue;
      }
      if (m.stuck) {
        // The tile just ahead of the raider.
        const t = screenToTile(m.x + m.heading.x * 20, m.y + m.heading.y * 14);
        const b = this.town.buildingOnTile(t.x, t.y);
        if (b && b.type !== 'ancient_core') {
          m.nextStrike = now + 1000;
          this.strike(m, m.x + m.heading.x * 20, m.y + m.heading.y * 14);
          this.town.damage(b, m.def.atk);
        }
      }
    }
  }

  /** A little lunge toward what the raider hits. */
  private strike(m: Monster, x: number, y: number) {
    m.strikeAnim();
    const dx = Math.sign(x - m.x) * 5;
    this.scene.tweens.add({ targets: m.sprite, x: m.sprite.x + dx, duration: 70, yoyo: true });
  }

  private onRaiderDown(m: Monster) {
    const i = this.raiders.indexOf(m);
    if (i >= 0) this.raiders.splice(i, 1);
  }

  private coreFallen() {
    if (state.cycle.phase !== 'night') return;
    // The raiders loot some of the town's stores and slip away into the dark.
    const t = state.town, ps = state.player!;
    const lost = { gold: Math.floor(ps.gold * LOOT), wood: Math.floor(t.wood * LOOT), stone: Math.floor(t.stone * LOOT) };
    give('gold', -lost.gold);
    give('wood', -lost.wood);
    give('stone', -lost.stone);
    for (const m of this.raiders) {
      m.dead = true;
      m.hpBar.clear();
      this.scene.tweens.add({ targets: [m.sprite, m.shadow], alpha: 0, duration: 500, onComplete: () => {
        m.destroy();
        const k = this.combat.monsters.indexOf(m);
        if (k >= 0) this.combat.monsters.splice(k, 1);
      } });
    }
    this.raiders = [];
    this.toSpawn = [];
    bus.emit('toast', `The Ancient Core fell! Raiders stole ${lost.gold} gold, ${lost.wood} wood, ${lost.stone} stone.`);
    this.scene.cameras.main.shake(400, 0.01);
    this.dawn(false);
  }

  // ---------------------------------------------------------------- light

  /** Day is clear; the last part of the day fades to dusk; night is dark (torches glow). */
  private applyLight() {
    const c = state.cycle;
    let k = 0;
    if (c.phase === 'night') k = 1;
    else if (c.left < DUSK_MS) k = 0.6 * (1 - c.left / DUSK_MS);
    const from = k < 0.6 ? AMBIENT.day : AMBIENT.dusk, to = k < 0.6 ? AMBIENT.dusk : AMBIENT.night;
    const t = k < 0.6 ? k / 0.6 : (k - 0.6) / 0.4;
    const col = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(from.color), Phaser.Display.Color.ValueToColor(to.color), 100, Math.round(t * 100),
    );
    this.lighting.setAmbient({ color: Phaser.Display.Color.GetColor(col.r, col.g, col.b), alpha: from.alpha + (to.alpha - from.alpha) * t });
  }
}

export const CYCLE = { DAY_MS };
