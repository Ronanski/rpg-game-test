import Phaser from 'phaser';
import { state, type PlacedBuilding } from '../../core/GameState';
import { bus } from '../../core/EventBus';
import { gridToScreen, screenToTile, TILE_H } from '../../iso/iso';
import { Tile, TOWN, inTown } from '../../world/worldData';
import type { IsoMap } from '../../iso/IsoMap';
import type { Player } from '../../entities/Player';
import type { CombatSystem } from '../combat/CombatSystem';
import { spriteScale } from '../../assets/sprites';
import { LIGHT_DEPTH } from '../LightingSystem';
import { countJobAction } from '../combat/JobSystem';
import { BUILDINGS, timeText, type BuildingDef, type Resource } from './Buildings';
import { canAfford, give, pay } from './Economy';
import { FONT } from '../../ui/theme';
import * as fx from '../combat/Fx';

const GATHER_COOLDOWN = 4000; // ms before the same tree / rock gives more
const COLLECT_RANGE = 70; // walk this close to a generator to collect it
const BUILDER_SPEEDUP = 0.7; // Builders finish 30% faster
const TILE_PX = 40; // tower range: px per tile

interface View {
  b: PlacedBuilding;
  img: Phaser.GameObjects.Image;
  scaffold: Phaser.GameObjects.Image;
  bar: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  stored: Phaser.GameObjects.Image;
  nextShot: number;
}

/**
 * The town: the Ancient Core, buildings the player places, build/upgrade timers (real time,
 * so they keep running across reloads), generators the player collects by walking past,
 * towers and traps that hit monsters, and gathering wood / stone / mana by hitting nodes.
 */
export class TownSystem {
  private views: View[] = [];
  private ghost: Phaser.GameObjects.Image | null = null;
  private placing: BuildingDef | null = null;
  private cursor = { x: 0, y: 0 };
  private cursorSet = false;
  /** Outline of the area you can build in, shown while placing. */
  private zone: Phaser.GameObjects.Graphics;

  constructor(
    private scene: Phaser.Scene,
    private map: IsoMap,
    private player: Player,
    private combat: CombatSystem,
  ) {
    // The Core is always there (level 1, free).
    if (!state.town.buildings.some((b) => b.type === 'ancient_core')) {
      state.town.buildings.push({ id: state.town.nextId++, type: 'ancient_core', level: 1, x: TOWN.coreX, y: TOWN.coreY, status: 'idle', endsAt: 0, lastCollected: Date.now() });
    }
    for (const b of state.town.buildings) this.addView(b);

    const onSwing = (s: { x: number; y: number; fx: number; fy: number; range: number }) => this.gather(s);
    bus.on('player-swing', onSwing);
    scene.events.once('shutdown', () => bus.off('player-swing', onSwing));

    // Build zone: the tiles within TOWN.radius of the Core, outlined on the ground.
    this.zone = scene.add.graphics().setDepth(-99980).setVisible(false);
    const cx = TOWN.coreX + 0.5, cy = TOWN.coreY + 0.5;
    this.zone.fillStyle(0x9fe3ff, 0.12).lineStyle(2, 0x9fe3ff, 0.8);
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const p = gridToScreen(cx + Math.cos(a) * TOWN.radius, cy + Math.sin(a) * TOWN.radius);
      pts.push(new Phaser.Math.Vector2(p.x, p.y));
    }
    this.zone.fillPoints(pts, true).strokePoints(pts, true);

    // The Core glows.
    const c = this.anchor(TOWN.coreX, TOWN.coreY, 2);
    const glow = scene.add.image(c.x, c.y - 40, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(LIGHT_DEPTH).setScale(2.2).setTint(0x9fe3ff);
    scene.tweens.add({ targets: glow, alpha: 0.6, duration: 1400, yoyo: true, repeat: -1 });
  }

  // ---------------------------------------------------------------- views

  /** Screen point at the bottom vertex of a footprint, where building sprites stand. */
  private anchor(x: number, y: number, size: number) {
    const p = size === 2 ? gridToScreen(x + 1.5, y + 1.5) : gridToScreen(x, y);
    return { x: p.x, y: p.y + TILE_H / 2 + (size === 2 ? 4 : -6) };
  }

  private addView(b: PlacedBuilding) {
    const def = BUILDINGS[b.type];
    const a = this.anchor(b.x, b.y, def.size);
    const flat = def.category === 'trap' || b.type === 'farm';
    const key = def.sprites[Math.min(b.level, def.sprites.length) - 1];
    const img = this.scene.add.image(a.x, a.y, key).setOrigin(0.5, 1).setScale(spriteScale(key)).setDepth(flat ? -99990 + a.y / 1000 : a.y);
    const scaffold = this.scene.add.image(a.x, a.y, 'b_scaffold').setOrigin(0.5, 1).setScale(2).setDepth(a.y + 1).setVisible(false);
    const bar = this.scene.add.graphics().setDepth(100000);
    const label = this.scene.add.text(a.x, a.y - img.displayHeight - 22, '', { fontFamily: FONT, fontSize: '11px', color: '#f4ead0', stroke: '#07080e', strokeThickness: 3 }).setOrigin(0.5).setDepth(100001);
    const res = def.levels[0].produces ? Object.keys(def.levels[0].produces)[0] : 'gold';
    const stored = this.scene.add.image(a.x, a.y - img.displayHeight - 8, res === 'gold' ? 'item_coin' : `res_${res}`).setScale(res === 'gold' ? 1 : 2).setDepth(100001).setVisible(false);
    this.scene.tweens.add({ targets: stored, y: stored.y - 4, duration: 600, yoyo: true, repeat: -1 });
    if (def.solid) this.setFootprint(b, def, true);
    this.views.push({ b, img, scaffold, bar, label, stored, nextShot: 0 });
  }

  private setFootprint(b: PlacedBuilding, def: BuildingDef, v: boolean) {
    for (let dy = 0; dy < def.size; dy++) for (let dx = 0; dx < def.size; dx++) this.map.setBlocked(b.x + dx, b.y + dy, v);
  }

  // ---------------------------------------------------------------- update

  update(now: number) {
    const t = Date.now();
    for (const v of this.views) {
      const def = BUILDINGS[v.b.type];
      const busy = v.b.status !== 'idle';
      if (busy && t >= v.b.endsAt) this.finish(v);
      this.drawStatus(v, t);
      if (v.b.status === 'building') continue;
      const lv = def.levels[v.b.level - 1];
      if (lv.produces) this.produce(v, lv, t);
      if (lv.attack) this.attack(v, def, lv.attack, now);
    }
    this.updateGhost();
  }

  private finish(v: View) {
    const def = BUILDINGS[v.b.type];
    const wasNew = v.b.status === 'building';
    if (v.b.status === 'upgrading') v.b.level++;
    v.b.status = 'idle';
    const key = def.sprites[Math.min(v.b.level, def.sprites.length) - 1];
    v.img.setTexture(key).setScale(spriteScale(key));
    if (def.levels[v.b.level - 1].produces && wasNew) v.b.lastCollected = Date.now();
    bus.emit('toast', wasNew ? `${def.name} built!` : `${def.name} upgraded to level ${v.b.level}!`);
    fx.sparks(this.scene, v.img.x, v.img.y - v.img.displayHeight / 2, 0xffe08a, 14, 160);
    if (wasNew) countJobAction('built');
    bus.emit('town-changed');
  }

  private drawStatus(v: View, t: number) {
    const g = v.bar.clear();
    const busy = v.b.status !== 'idle';
    v.scaffold.setVisible(busy);
    v.img.setAlpha(v.b.status === 'building' ? 0.45 : 1);
    if (!busy) return v.label.setText('');
    const def = BUILDINGS[v.b.type];
    const total = (v.b.status === 'building' ? def.levels[0].seconds : def.levels[v.b.level].seconds) * 1000 || 1;
    const left = Math.max(0, v.b.endsAt - t);
    const w = 40, x = v.img.x - w / 2, y = v.img.y - Math.max(v.img.displayHeight, 50) - 12;
    g.fillStyle(0x07080e, 0.8).fillRect(x - 1, y - 1, w + 2, 6);
    g.fillStyle(0xffd75e).fillRect(x, y, w * (1 - left / total), 4);
    v.label.setPosition(v.img.x, y - 8).setText(timeText(left / 1000));
  }

  /** Stored output grows over real time up to the cap; walking past collects it. */
  private produce(v: View, lv: NonNullable<BuildingDef['levels'][number]>, t: number) {
    const [res, rate] = Object.entries(lv.produces!)[0] as [Resource, number];
    const stored = Math.min(lv.cap ?? Infinity, Math.floor((rate * (t - v.b.lastCollected)) / ((lv.per ?? 3600) * 1000)));
    v.stored.setVisible(stored >= 1);
    if (stored >= 1 && Phaser.Math.Distance.Between(this.player.x, this.player.y, v.img.x, v.img.y) < COLLECT_RANGE) {
      give(res, stored);
      v.b.lastCollected = t;
      this.float(v.img.x, v.img.y - v.img.displayHeight, `+${stored} ${res}`, '#ffd75e');
      bus.emit('town-changed');
    }
  }

  private attack(v: View, def: BuildingDef, atk: { dmg: number; range: number; rate: number }, now: number) {
    if (now < v.nextShot) return;
    const range = def.category === 'trap' ? 22 : atk.range * TILE_PX;
    const ax = v.img.x, ay = def.category === 'trap' ? v.img.y - 8 : v.img.y;
    let target = null, best = range;
    for (const m of this.combat.monsters) {
      if (m.dead) continue;
      const d = Phaser.Math.Distance.Between(ax, ay, m.x, m.y);
      if (d < best) (best = d), (target = m);
    }
    if (!target) return;
    v.nextShot = now + 1000 / atk.rate;
    if (def.category === 'trap') {
      this.combat.structureHit(target, atk.dmg);
      this.scene.tweens.add({ targets: v.img, y: v.img.y - 3, duration: 60, yoyo: true });
    } else this.combat.towerShot(ax, ay - v.img.displayHeight * 0.8, target, atk.dmg);
  }

  // ---------------------------------------------------------------- gathering

  private gather(s: { x: number; y: number; fx: number; fy: number; range: number }) {
    const now = this.scene.time.now;
    for (const n of this.map.nodes) {
      const dx = n.x - s.x, dy = n.y - s.y, d = Math.hypot(dx, dy);
      if (d > s.range + 10 || (d > 20 && (dx * s.fx + dy * s.fy) / d < 0)) continue;
      if (now < n.readyAt) continue;
      n.readyAt = now + GATHER_COOLDOWN;
      give(n.res, n.amount);
      const x0 = n.sprite.x;
      this.scene.tweens.add({ targets: n.sprite, x: { from: x0 - 2, to: x0 + 2 }, duration: 50, yoyo: true, repeat: 2, onComplete: () => n.sprite.setX(x0) });
      fx.sparks(this.scene, n.x, n.y - 20, n.res === 'wood' ? 0xc9915a : n.res === 'stone' ? 0xc9c4bc : 0x5ad1ff, 8, 120);
      this.float(n.x, n.y - n.sprite.displayHeight * 0.6, `+${n.amount} ${n.res}`, n.res === 'mana' ? '#9fe3ff' : '#f4ead0');
      return; // one node per swing
    }
  }

  // ---------------------------------------------------------------- building and upgrading

  /** Start placing a new building; the ghost follows the tile in front of the hero (or a tapped tile). */
  startPlacing(type: string) {
    this.cancelPlacing();
    this.placing = BUILDINGS[type];
    this.cursorSet = false;
    const key = this.placing.sprites[0];
    this.ghost = this.scene.add.image(0, 0, key).setOrigin(0.5, 1).setScale(spriteScale(key)).setAlpha(0.6).setDepth(150002);
    this.zone.setVisible(true);
    this.updateGhost();
  }

  cancelPlacing() {
    this.ghost?.destroy();
    this.ghost = null;
    this.zone?.setVisible(false);
    this.placing = null;
  }

  get isPlacing() {
    return !!this.placing;
  }

  /** A tap on the world while placing moves the cursor there (screen point -> tile). */
  setCursorFromWorld(wx: number, wy: number) {
    const t = screenToTile(wx, wy);
    this.cursor = { x: t.x, y: t.y };
    this.cursorSet = true;
  }

  private updateGhost() {
    if (!this.ghost || !this.placing) return;
    if (!this.cursorSet) {
      const f = this.player.facing;
      const t = screenToTile(this.player.x + f.x * 56, this.player.y + f.y * 40);
      this.cursor = { x: t.x - (this.placing.size === 2 ? 1 : 0), y: t.y - (this.placing.size === 2 ? 1 : 0) };
    }
    const a = this.anchor(this.cursor.x, this.cursor.y, this.placing.size);
    this.ghost.setPosition(a.x, a.y).setTint(this.canPlaceAt(this.cursor.x, this.cursor.y, this.placing) ? 0x9fffa0 : 0xff7070);
  }

  canPlaceAt(x: number, y: number, def: BuildingDef): boolean {
    for (let dy = 0; dy < def.size; dy++) {
      for (let dx = 0; dx < def.size; dx++) {
        const tx = x + dx, ty = y + dy;
        if (!inTown(tx, ty) || this.map.isBlocked(tx, ty)) return false;
        const tile = this.map.tileAt(tx, ty);
        if (tile === undefined || tile === Tile.Water || tile === Tile.Bridge || tile === Tile.Path) return false;
        if (this.occupied(tx, ty)) return false;
      }
    }
    // Don't build on top of the hero.
    const pt = screenToTile(this.player.x, this.player.y);
    return !(pt.x >= x && pt.x < x + def.size && pt.y >= y && pt.y < y + def.size);
  }

  private occupied(tx: number, ty: number) {
    return state.town.buildings.some((b) => {
      const s = BUILDINGS[b.type].size;
      return tx >= b.x && tx < b.x + s && ty >= b.y && ty < b.y + s;
    });
  }

  /** Places the building at the cursor if allowed and affordable. Returns true on success. */
  confirmPlacing(): boolean {
    const def = this.placing;
    if (!def) return false;
    if (!this.canPlaceAt(this.cursor.x, this.cursor.y, def)) {
      bus.emit('toast', inTown(this.cursor.x, this.cursor.y) ? 'Can\'t build there' : 'Build closer to the Ancient Core');
      return false;
    }
    if (!pay(def.levels[0].cost)) {
      bus.emit('toast', 'Not enough resources');
      return false;
    }
    const secs = def.levels[0].seconds * (state.player!.jobId === 'builder' ? BUILDER_SPEEDUP : 1);
    const b: PlacedBuilding = {
      id: state.town.nextId++, type: def.id, level: 1, x: this.cursor.x, y: this.cursor.y,
      status: 'building', endsAt: Date.now() + secs * 1000, lastCollected: Date.now(),
    };
    state.town.buildings.push(b);
    this.addView(b);
    fx.dust(this.scene, this.ghost!.x, this.ghost!.y, 2);
    this.cancelPlacing();
    bus.emit('town-changed');
    return true;
  }

  /** The placed building whose footprint is nearest the hero (within reach), for the TALK button. */
  nearest(range = 64): PlacedBuilding | null {
    let best: PlacedBuilding | null = null, bd = range;
    for (const v of this.views) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, v.img.x, v.img.y - 10);
      if (d < bd) (bd = d), (best = v.b);
    }
    return best;
  }

  upgrade(b: PlacedBuilding): boolean {
    const def = BUILDINGS[b.type];
    if (b.status !== 'idle' || b.level >= def.levels.length) return false;
    const next = def.levels[b.level];
    if (!canAfford(next.cost) || !pay(next.cost)) {
      bus.emit('toast', 'Not enough resources');
      return false;
    }
    b.status = 'upgrading';
    b.endsAt = Date.now() + next.seconds * 1000 * (state.player!.jobId === 'builder' ? BUILDER_SPEEDUP : 1);
    bus.emit('town-changed');
    return true;
  }

  private float(x: number, y: number, msg: string, color: string) {
    const t = this.scene.add.text(x, y, msg, { fontFamily: FONT, fontSize: '15px', color, stroke: '#07080e', strokeThickness: 4 }).setOrigin(0.5).setDepth(200000);
    this.scene.tweens.add({ targets: t, y: y - 30, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }
}
