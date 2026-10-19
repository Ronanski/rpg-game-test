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
import { BUILDINGS, builders, placeCost, timeText, type BuildingDef, type LevelDef, type Resource } from './Buildings';
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
  /** Building being moved in build mode (null when placing a new one). */
  private moving: PlacedBuilding | null = null;
  private builders: { spr: Phaser.GameObjects.Sprite; x: number; y: number; bob: number; nextHit: number }[] = [];
  /** Outline of the area you can build in, shown while placing. */
  private zone: Phaser.GameObjects.Graphics;

  constructor(
    private scene: Phaser.Scene,
    private map: IsoMap,
    private player: Player,
    private combat: CombatSystem,
  ) {
    // The Core is always there (level 1, free).
    // Saves from before the town moved: carry the whole town to the new grounds.
    const old = state.town.buildings.find((b) => b.type === 'ancient_core');
    if (old && (old.x !== TOWN.coreX || old.y !== TOWN.coreY)) {
      const dx = TOWN.coreX - old.x, dy = TOWN.coreY - old.y;
      for (const b of state.town.buildings) (b.x += dx), (b.y += dy);
    }
    if (!state.town.buildings.some((b) => b.type === 'ancient_core')) {
      state.town.buildings.push({ id: state.town.nextId++, type: 'ancient_core', level: 1, x: TOWN.coreX, y: TOWN.coreY, status: 'idle', endsAt: 0, lastCollected: Date.now() });
    }
    // Everyone starts with one Builder's Hut (one builder) next to the Core.
    if (!state.town.buildings.some((b) => b.type === 'builder_hut')) {
      state.town.buildings.push({ id: state.town.nextId++, type: 'builder_hut', level: 1, x: TOWN.coreX - 4, y: TOWN.coreY + 1, status: 'idle', endsAt: 0, lastCollected: Date.now() });
    }
    for (const b of state.town.buildings) this.addView(b);

    const onSwing = (s: { x: number; y: number; fx: number; fy: number; range: number }) => this.gather(s);
    bus.on('player-swing', onSwing);
    scene.events.once('shutdown', () => bus.off('player-swing', onSwing));

    // Build-mode grid: a diamond outline on every buildable tile of the town grounds.
    this.zone = scene.add.graphics().setDepth(-99980).setVisible(false);
    this.zone.lineStyle(1, 0xe8f4ff, 0.35);
    for (let y = TOWN.coreY - 11; y <= TOWN.coreY + 11; y++) {
      for (let x = TOWN.coreX - 11; x <= TOWN.coreX + 11; x++) {
        if (!inTown(x, y)) continue;
        const c = gridToScreen(x, y);
        this.zone.strokePoints([
          new Phaser.Math.Vector2(c.x, c.y - TILE_H / 2), new Phaser.Math.Vector2(c.x + TILE_H, c.y),
          new Phaser.Math.Vector2(c.x, c.y + TILE_H / 2), new Phaser.Math.Vector2(c.x - TILE_H, c.y),
        ], true);
      }
    }

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
    const flat = def.category === 'trap';
    const key = def.sprites[Math.min(b.level, def.sprites.length) - 1];
    const img = this.scene.add.image(a.x, a.y, key).setOrigin(0.5, 1).setScale(spriteScale(key)).setDepth(flat ? -99990 + a.y / 1000 : a.y);
    if (def.tint) img.setTint(def.tint);
    const scaffold = this.scene.add.image(a.x, a.y, 'b_scaffold').setOrigin(0.5, 1).setScale(2).setDepth(a.y + 1).setVisible(false);
    const bar = this.scene.add.graphics().setDepth(100000);
    const label = this.scene.add.text(a.x, a.y - img.displayHeight - 22, '', { fontFamily: FONT, fontStyle: 'bold', resolution: 2, fontSize: '11px', color: '#f4ead0', stroke: '#07080e', strokeThickness: 3 }).setOrigin(0.5).setDepth(100001);
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
    this.updateBuilders(this.scene.game.loop.delta);
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
    // New buildings show their wooden frame going up (or a faded ghost with scaffolding if they have none).
    const def = BUILDINGS[v.b.type];
    const site = v.b.status === 'building' && def.site;
    const want = site || def.sprites[Math.min(v.b.level, def.sprites.length) - 1];
    if (v.img.texture.key !== want) v.img.setTexture(want).setScale(spriteScale(want));
    v.scaffold.setVisible(busy && !site);
    v.img.setAlpha(v.b.status === 'building' && !site ? 0.45 : 1);
    if (!busy) {
      v.label.setText('');
      // Health bar once damaged.
      const max = this.maxHp(v.b), hp = v.b.hp ?? max;
      if (hp < max) {
        const w = v.b.type === 'ancient_core' ? 70 : 36, x = v.img.x - w / 2, y = v.img.y - v.img.displayHeight - 8;
        g.fillStyle(0x07080e, 0.8).fillRect(x - 1, y - 1, w + 2, 7);
        g.fillStyle(v.b.type === 'ancient_core' ? 0x5ad1ff : 0x8fd18a).fillRect(x, y, (w * hp) / max, 5);
      }
      return;
    }
    const total = (v.b.status === 'building' ? def.levels[0].seconds : def.levels[v.b.level].seconds) * 1000 || 1;
    const left = Math.max(0, v.b.endsAt - t);
    const w = 40, x = v.img.x - w / 2, y = v.img.y - Math.max(v.img.displayHeight, 50) - 12;
    g.fillStyle(0x07080e, 0.8).fillRect(x - 1, y - 1, w + 2, 6);
    g.fillStyle(0xffd75e).fillRect(x, y, w * Phaser.Math.Clamp(1 - left / total, 0, 1), 4);
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

  private attack(v: View, def: BuildingDef, atk: NonNullable<LevelDef['attack']>, now: number) {
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
    } else this.combat.towerShot(ax, ay - v.img.displayHeight * 0.8, target, atk.dmg, def.id === 'mage_tower' ? 'frost' : def.id === 'cannon_tower' ? 'cannon' : 'arrow', atk);
  }

  // ---------------------------------------------------------------- damage (night raids)

  maxHp(b: PlacedBuilding) {
    return BUILDINGS[b.type].levels[b.level - 1].hp;
  }

  get core(): PlacedBuilding {
    return state.town.buildings.find((b) => b.type === 'ancient_core')!;
  }

  /** Screen position of the Core (where raiders march to). */
  corePoint() {
    const a = this.anchor(TOWN.coreX, TOWN.coreY, 2);
    return { x: a.x, y: a.y - 10 };
  }

  /** The solid building on a tile, if any (finished or not). */
  buildingOnTile(tx: number, ty: number): PlacedBuilding | null {
    return state.town.buildings.find((b) => {
      const s = BUILDINGS[b.type].size;
      return BUILDINGS[b.type].solid && tx >= b.x && tx < b.x + s && ty >= b.y && ty < b.y + s;
    }) ?? null;
  }

  /** Hurts a building. Regular buildings are destroyed at 0 HP; the Core reports 'core-fallen'. */
  damage(b: PlacedBuilding, dmg: number) {
    const v = this.views.find((w) => w.b === b);
    if (!v) return;
    b.hp = Math.max(0, (b.hp ?? this.maxHp(b)) - dmg);
    v.img.setTint(0xff8080);
    this.scene.time.delayedCall(90, () => v.img.clearTint());
    fx.sparks(this.scene, v.img.x, v.img.y - v.img.displayHeight / 2, 0xffc080, 5, 110);
    if (b.hp > 0) return;
    if (b.type === 'ancient_core') return bus.emit('core-fallen');
    // Destroyed: rubble puff, free the tiles, forget the building.
    fx.dust(this.scene, v.img.x, v.img.y, 2.5);
    fx.sparks(this.scene, v.img.x, v.img.y - 20, 0xc9a46a, 16, 180);
    this.setFootprint(b, BUILDINGS[b.type], false);
    [v.img, v.scaffold, v.bar, v.label, v.stored].forEach((o) => o.destroy());
    this.views.splice(this.views.indexOf(v), 1);
    state.town.buildings.splice(state.town.buildings.indexOf(b), 1);
    bus.emit('toast', `${BUILDINGS[b.type].name} was destroyed!`);
    bus.emit('town-changed');
  }

  /** Morning: everything is repaired. */
  repairAll() {
    for (const b of state.town.buildings) delete b.hp;
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

  // ---------------------------------------------------------------- builders (Clash of Clans style)

  get builderCount() {
    return builders(state.town.buildings).total;
  }

  get freeBuilders() {
    return builders(state.town.buildings).free;
  }

  /** Cost of a building, taking the growing price of extra Builder's Huts into account. */
  costOf(def: BuildingDef) {
    return placeCost(def, state.town.buildings);
  }

  /** Builders walk from their hut to a building under work and hammer away until it is done. */
  private updateBuilders(dtMs: number) {
    const huts = state.town.buildings.filter((b) => b.type === 'builder_hut');
    while (this.builders.length < huts.length) {
      const a = this.anchor(huts[this.builders.length].x, huts[this.builders.length].y, 2);
      const spr = this.scene.add.sprite(a.x + 20, a.y + 4, 'npc_borgan', 0).setOrigin(0.5, 1).setScale(spriteScale('npc_borgan'));
      this.builders.push({ spr, x: a.x + 20, y: a.y + 4, bob: 0, nextHit: 0 });
    }
    const jobs = this.views.filter((v) => v.b.status !== 'idle');
    this.builders.forEach((bd, i) => {
      const job = jobs[i];
      const hut = huts[i];
      const home = hut ? this.anchor(hut.x, hut.y, 2) : { x: bd.x, y: bd.y };
      const tx = job ? job.img.x + 22 : home.x + 20, ty = job ? job.img.y + 2 : home.y + 4;
      const dx = tx - bd.x, dy = ty - bd.y, d = Math.hypot(dx, dy);
      const now = this.scene.time.now;
      if (d > 4) {
        const step = Math.min(d, (90 * dtMs) / 1000);
        bd.x += (dx / d) * step;
        bd.y += (dy / d) * step;
        bd.bob += dtMs / 90;
        bd.spr.setFrame([0, 1, 0, 2][Math.floor(bd.bob / 2) % 4]).setFlipX(dx < 0);
        bd.spr.setPosition(bd.x, bd.y - Math.abs(Math.sin(bd.bob * 0.7)) * 2);
      } else {
        bd.spr.setFrame(0).setPosition(bd.x, bd.y);
        if (job) {
          bd.spr.setFlipX(true);
          if (now > bd.nextHit) {
            // Hammer: a quick hop toward the building and a spark.
            bd.nextHit = now + 550;
            this.scene.tweens.add({ targets: bd.spr, y: bd.y - 4, duration: 90, yoyo: true });
            fx.sparks(this.scene, job.img.x + 10, job.img.y - 12, 0xffe08a, 4, 80);
          }
        }
      }
      bd.spr.setDepth(bd.y);
    });
  }

  // ---------------------------------------------------------------- build mode: placing and moving

  /** Grid shown over the buildable tiles in build mode. */
  showGrid(on: boolean) {
    this.zone.setVisible(on);
  }

  /** Start placing a new building (or moving `moving`); the ghost starts on a free spot near the view. */
  startPlacing(type: string, near?: { x: number; y: number }, moving: PlacedBuilding | null = null) {
    this.cancelPlacing();
    const def = BUILDINGS[type];
    if (!moving) {
      const cost = this.costOf(def);
      if (!cost) return bus.emit('toast', 'You have all the builders (3).');
      if (!canAfford(cost)) return bus.emit('toast', 'Not enough resources');
      if (type !== 'builder_hut' && this.freeBuilders <= 0) return bus.emit('toast', 'All builders are busy. Build a Builder\'s Hut for more.');
    }
    this.placing = def;
    this.moving = moving;
    const key = moving ? (this.views.find((v) => v.b === moving)?.img.texture.key ?? def.sprites[0]) : def.sprites[0];
    this.ghost = this.scene.add.image(0, 0, key).setOrigin(0.5, 1).setScale(spriteScale(key)).setAlpha(0.7).setDepth(150002);
    // Start on the nearest free spot to the middle of the view.
    const c = near ? screenToTile(near.x, near.y) : { x: TOWN.coreX, y: TOWN.coreY };
    let best = moving ? { x: moving.x, y: moving.y } : { x: c.x, y: c.y };
    if (!moving) {
      let bd = Infinity;
      for (let y = TOWN.coreY - 11; y <= TOWN.coreY + 11; y++) for (let x = TOWN.coreX - 11; x <= TOWN.coreX + 11; x++) {
        if (!this.canPlaceAt(x, y, def)) continue;
        const d = Math.hypot(x - c.x, y - c.y);
        if (d < bd) (bd = d), (best = { x, y });
      }
    }
    this.cursor = best;
    if (moving) this.views.find((v) => v.b === moving)?.img.setAlpha(0.25);
    this.updateGhost();
  }

  cancelPlacing() {
    this.ghost?.destroy();
    this.ghost = null;
    if (this.moving) this.views.find((v) => v.b === this.moving)?.img.setAlpha(1);
    this.placing = null;
    this.moving = null;
  }

  get isPlacing() {
    return !!this.placing;
  }

  /** Dragging in build mode moves the ghost: the footprint centres under the finger. */
  setCursorFromWorld(wx: number, wy: number) {
    const t = screenToTile(wx, wy + (this.placing?.size === 2 ? 16 : 0));
    const off = this.placing?.size === 2 ? 1 : 0;
    this.cursor = { x: t.x - off, y: t.y - off };
  }

  /** The building drawn at a world point (for taps in build mode). */
  buildingAt(wx: number, wy: number): PlacedBuilding | null {
    let best: PlacedBuilding | null = null, bd = Infinity;
    for (const v of this.views) {
      const b = v.img.getBounds();
      if (!b.contains(wx, wy)) continue;
      const d = Math.abs(v.img.y - wy);
      if (d < bd) (bd = d), (best = v.b);
    }
    return best;
  }

  private updateGhost() {
    if (!this.ghost || !this.placing) return;
    const a = this.anchor(this.cursor.x, this.cursor.y, this.placing.size);
    this.ghost.setPosition(a.x, a.y).setTint(this.canPlaceAt(this.cursor.x, this.cursor.y, this.placing) ? 0x9fffa0 : 0xff7070);
  }

  canPlaceAt(x: number, y: number, def: BuildingDef): boolean {
    for (let dy = 0; dy < def.size; dy++) {
      for (let dx = 0; dx < def.size; dx++) {
        const tx = x + dx, ty = y + dy;
        if (!inTown(tx, ty)) return false;
        const own = this.moving && tx >= this.moving.x && tx < this.moving.x + def.size && ty >= this.moving.y && ty < this.moving.y + def.size;
        if (!own && (this.map.isBlocked(tx, ty) || this.occupied(tx, ty))) return false;
        const tile = this.map.tileAt(tx, ty);
        if (tile === undefined || tile === Tile.Water || tile === Tile.Bridge || tile === Tile.Path) return false;
      }
    }
    // Don't build on top of the hero.
    const pt = screenToTile(this.player.x, this.player.y);
    return !(pt.x >= x && pt.x < x + def.size && pt.y >= y && pt.y < y + def.size);
  }

  private occupied(tx: number, ty: number) {
    return state.town.buildings.some((b) => {
      if (b === this.moving) return false;
      const s = BUILDINGS[b.type].size;
      return tx >= b.x && tx < b.x + s && ty >= b.y && ty < b.y + s;
    });
  }

  /** Places (or moves) the building at the cursor if allowed. Returns true on success. */
  confirmPlacing(): boolean {
    const def = this.placing;
    if (!def) return false;
    if (!this.canPlaceAt(this.cursor.x, this.cursor.y, def)) {
      bus.emit('toast', inTown(this.cursor.x, this.cursor.y) ? 'Can\'t build there' : 'Build inside the town grounds');
      return false;
    }
    if (this.moving) {
      const b = this.moving, v = this.views.find((w) => w.b === b)!;
      if (def.solid) this.setFootprint(b, def, false);
      b.x = this.cursor.x;
      b.y = this.cursor.y;
      if (def.solid) this.setFootprint(b, def, true);
      const a = this.anchor(b.x, b.y, def.size);
      v.img.setPosition(a.x, a.y).setDepth(def.category === 'trap' || b.type === 'farm' ? -99990 + a.y / 1000 : a.y);
      v.scaffold.setPosition(a.x, a.y).setDepth(a.y + 1);
      v.stored.setPosition(a.x, a.y - v.img.displayHeight - 8);
      fx.dust(this.scene, a.x, a.y, 2);
      this.cancelPlacing();
      bus.emit('town-changed');
      return true;
    }
    const cost = this.costOf(def);
    if (!cost || !pay(cost)) {
      bus.emit('toast', 'Not enough resources');
      return false;
    }
    const hut = def.id === 'builder_hut';
    const secs = def.levels[0].seconds * (state.player!.jobId === 'builder' ? BUILDER_SPEEDUP : 1);
    const b: PlacedBuilding = {
      id: state.town.nextId++, type: def.id, level: 1, x: this.cursor.x, y: this.cursor.y,
      status: hut || secs <= 0 ? 'idle' : 'building', endsAt: Date.now() + secs * 1000, lastCollected: Date.now(),
    };
    state.town.buildings.push(b);
    this.addView(b);
    fx.dust(this.scene, this.ghost!.x, this.ghost!.y, 2);
    this.cancelPlacing();
    if (hut) bus.emit('toast', 'A new builder moved in!');
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
    if (this.freeBuilders <= 0) {
      bus.emit('toast', 'All builders are busy. Build a Builder\'s Hut for more.');
      return false;
    }
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
    const t = this.scene.add.text(x, y, msg, { fontFamily: FONT, fontStyle: 'bold', resolution: 2, fontSize: '15px', color, stroke: '#07080e', strokeThickness: 4 }).setOrigin(0.5).setDepth(200000);
    this.scene.tweens.add({ targets: t, y: y - 30, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }
}
