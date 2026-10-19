import Phaser from 'phaser';
import { setActiveArea, type AreaId, type Door } from '../world/worldData';
import { buildArea, PIT } from '../world/areas';
import { GRAVEMAW } from '../entities/Monster';
import { Companion } from '../entities/Companion';
import { buildMapTexture } from '../world/Minimap';
import { IsoMap } from '../iso/IsoMap';
import { gridToScreen } from '../iso/iso';
import { Player } from '../entities/Player';
import { Npc } from '../entities/Npc';
import { CombatSystem } from '../systems/combat/CombatSystem';
import { QuestTracker } from '../systems/quest/QuestTracker';
import { DialogueSystem } from '../systems/dialogue/DialogueSystem';
import { state, emitStats } from '../core/GameState';
import { bus } from '../core/EventBus';
import { isUnlocked } from '../systems/combat/JobSystem';
import { spriteScale } from '../assets/sprites';
import { LightingSystem } from '../systems/LightingSystem';
import { TownSystem } from '../systems/town/TownSystem';
import { WaveSystem } from '../systems/town/WaveSystem';
import type { PlacedBuilding } from '../core/GameState';
import { saveGame, setSnapshotSource, type SaveData } from '../core/SaveGame';
import type { QuestState } from '../systems/quest/QuestTracker';
import { DPR, view } from '../core/Screen';

const TALK_RANGE = 70;
/** Names shown when you walk into a place, and on the clock while inside. */
const AREA_NAMES: Partial<Record<AreaId, string>> = { cave: 'The Old Cave', tavern: 'The Sleeping Fox', smithy: "Grom's Smithy" };
const AUTOSAVE_MS = 5000;

/** Free-roam field: the hero explores, talks to NPCs and fights monsters. */
export class WorldScene extends Phaser.Scene {
  private map!: IsoMap;
  private player!: Player;
  private npcs: Npc[] = [];
  private combat!: CombatSystem;
  private dialogue!: DialogueSystem;
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'space' | 'e' | 'q' | 'shift' | 'f' | 'r' | 'enter', Phaser.Input.Keyboard.Key>;
  private nearNpc: Npc | null = null;
  private nearBuilding: PlacedBuilding | null = null;
  /** The town and the night raids only exist in the overworld. */
  private town: TownSystem | null = null;
  private zoom = 1;
  private quests!: QuestTracker;
  private waves: WaveSystem | null = null;
  private area: AreaId = 'overworld';
  private doors: Door[] = [];
  /** Doors work once the hero has stepped away from the one they came through. */
  private doorArmed = false;
  private leaving = false;
  /** Hana travels with the hero once she has joined (story flag hana_joined). */
  private ally: Companion | null = null;
  /** Tapped NPC the hero is walking to (talks on arrival). */
  private walkTo: Npc | null = null;
  /** Red ring under the monster an attack would go for. */
  private targetRing!: Phaser.GameObjects.Graphics;
  private nextObjective = 0;
  /** The area's map picture (see Minimap.ts) and its height in tiles. */
  private mapKey = '';
  private mapH = 64;
  private lighting!: LightingSystem;

  constructor() {
    super('World');
  }

  create(data: { save?: SaveData; area?: AreaId; at?: { x: number; y: number }; quests?: QuestState } = {}) {
    state.buildMode = false;
    this.area = data.area ?? data.save?.area ?? 'overworld';
    setActiveArea(this.area);
    const world = buildArea(this.area);
    this.doors = world.doors;
    this.doorArmed = false;
    this.leaving = false;
    this.map = new IsoMap(this, world);
    this.map.render();
    this.mapKey = buildMapTexture(this, world);
    this.mapH = world.h;
    this.lighting = new LightingSystem(this);
    if (world.ambient) this.lighting.setAmbient(world.ambient);
    this.cameras.main.setBackgroundColor(world.bg ?? 0x0d0b14);

    const start = gridToScreen((data.at ?? world.playerStart).x, (data.at ?? world.playerStart).y);
    this.player = new Player(this, start.x, start.y, state.player!.texture);
    this.npcs = world.npcs.map((d) => {
      const p = gridToScreen(d.x, d.y);
      return new Npc(this, p.x, p.y, d);
    });

    const quests = new QuestTracker();
    this.quests = quests;
    this.combat = new CombatSystem(this, this.map, this.player, quests, start);
    quests.setExpHandler((n) => this.combat.gainExp(n));
    this.combat.spawnAll(world.spawns);
    this.dialogue = new DialogueSystem(quests);
    // Hana leaves her spot in the village once she travels with you.
    if (state.storyFlags.has('hana_joined')) {
      this.npcs = this.npcs.filter((n) => (n.def.id === 'villager2' ? (n.destroy(), false) : true));
    }
    this.ally = null;
    const joinAlly = () => {
      if (this.ally) return;
      this.npcs = this.npcs.filter((n) => (n.def.id === 'villager2' ? (n.destroy(), false) : true));
      this.ally = new Companion(this, this.player.x - 24, this.player.y + 10, 'npc_archer', 'Hana');
    };
    if (state.storyFlags.has('hana_joined')) joinAlly();
    bus.on('ally-joined', joinAlly);
    this.events.once('shutdown', () => bus.off('ally-joined', joinAlly));
    if (data.quests) quests.importState(data.quests);
    if (data.save) quests.importState(data.save.quests);
    // Gravemaw waits at the bottom of the cave once Martha has asked you to go there.
    if (this.area === 'cave' && quests.statusOf('main_04_cave') === 'active' && !state.storyFlags.has('gravemaw_down')) {
      const p = gridToScreen(PIT.x, PIT.y);
      this.combat.spawnBoss(GRAVEMAW, p.x, p.y);
    }

    if (this.area === 'overworld') {
      this.town = new TownSystem(this, this.map, this.player, this.combat);
      this.wireTown();
      this.waves = new WaveSystem(this, this.combat, this.town, this.lighting);
    } else {
      this.town = this.waves = null;
      const noBuild = (on: boolean) => on && bus.emit('toast', 'You can only build in town.');
      bus.on('build-mode', noBuild);
      this.events.once('shutdown', () => bus.off('build-mode', noBuild));
    }

    // Continue a saved game (or come through a door): the spot where the hero stood.
    if (data.save) {
      if (this.map.walkable(data.save.pos.x, data.save.pos.y)) this.player.teleport(data.save.pos.x, data.save.pos.y);
    }
    // Autosave every few seconds, after quest changes, and when the tab is hidden or closed.
    setSnapshotSource(() => ({ quests: quests.exportState(), pos: { x: this.player.x, y: this.player.y }, area: this.area }));
    this.time.addEvent({ delay: AUTOSAVE_MS, loop: true, callback: saveGame });
    const saveNow = () => saveGame();
    bus.on('quest-updated', saveNow);
    document.addEventListener('visibilitychange', saveNow);
    window.addEventListener('pagehide', saveNow);
    this.events.once('shutdown', () => {
      bus.off('quest-updated', saveNow);
      document.removeEventListener('visibilitychange', saveNow);
      window.removeEventListener('pagehide', saveNow);
    });

    const cam = this.cameras.main;
    const b = this.map.bounds();
    cam.setBounds(b.x, b.y, b.width, b.height);
    cam.startFollow(this.player.sprite, true, 0.12, 0.12, 0, 20);
    // Bigger screens see the same amount of world, just with bigger pixels.
    this.zoom = Phaser.Math.Clamp(Math.round((view(this).height / 460) * 4) / 4, 1, 2.5);
    // The camera's real zoom also covers the sharp-graphics scale (DPR, see core/Screen.ts).
    cam.setZoom(this.zoom * DPR);
    cam.setRoundPixels(true);
    // Zoom: + / − buttons and pinch (UI scene), mouse wheel here.
    const zoomBy = (f: number) => {
      if (state.buildMode) return;
      this.zoom = Phaser.Math.Clamp(this.zoom * f, 0.75, 3);
      cam.setZoom(this.zoom * DPR);
    };
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => zoomBy(dy > 0 ? 0.9 : 1.1));
    // Tap an NPC: walk over and talk.
    const onTap = (sx: number, sy: number) => {
      const p = cam.getWorldPoint(sx, sy);
      const npc = this.npcs.find((n) => Math.abs(p.x - n.x) < 24 && p.y > n.y - n.sprite.displayHeight - 8 && p.y < n.y + 10);
      if (!npc) return;
      if (npc.distanceTo(this.player) < TALK_RANGE) this.startTalk(npc);
      else this.walkTo = npc;
    };
    bus.on('zoom-by', zoomBy);
    bus.on('world-tap', onTap);
    this.events.once('shutdown', () => (bus.off('zoom-by', zoomBy), bus.off('world-tap', onTap)));
    this.targetRing = this.add.graphics().setDepth(-99990);
    this.walkTo = null;

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('up,down,left,right,w,a,s,d,space,e,q,shift,f,r,enter') as typeof this.keys;

    this.scene.launch('UI', { quests });
    emitStats();
    // Job outfits: the hero's sprite follows the job.
    const onLook = (key: string) => {
      this.player.sprite.setTexture(key, 0);
      this.player.baseScale = spriteScale(key);
    };
    bus.on('appearance-changed', onLook);
    this.events.once('shutdown', () => bus.off('appearance-changed', onLook));
    // Potions used from the BAG menu.
    const onUse = (id: string) => this.combat.usePotion(id);
    bus.on('use-item', onUse);
    this.events.once('shutdown', () => bus.off('use-item', onUse));
    const label = world.doors[0]?.label;
    if (data.area && !data.save) {
      this.cameras.main.fadeIn(300);
      bus.emit('toast', AREA_NAMES[this.area] ?? `Back to ${label}`);
    } else bus.emit('toast', data.save ? `Welcome back, ${state.player!.name}.` : 'Welcome to Oakhaven. Talk to Martha.');
  }

  /** Walking onto a door takes the hero to the other area (quests and everything else come along). */
  private checkDoors() {
    if (this.leaving) return;
    let nearest = Infinity, hit: Door | null = null;
    for (const d of this.doors) {
      const p = gridToScreen(d.x, d.y);
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, p.x, p.y);
      if (dist < nearest) nearest = dist;
      if (dist < 24) hit = d;
    }
    if (!this.doorArmed) {
      this.doorArmed = nearest > 44;
      return;
    }
    if (!hit) return;
    const door = hit;
    this.leaving = true;
    const quests = this.quests.exportState();
    saveGame();
    this.cameras.main.fadeOut(250);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.stop('UI');
      this.scene.restart({ area: door.to, at: door.at, quests });
    });
  }

  update(time: number, delta: number) {
    const c = state.controls;
    if (!state.inDialogue && !state.inMenu && !state.buildMode) {
      const k = this.keys;
      let kx = (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0);
      let ky = (k.down.isDown || k.s.isDown ? 1 : 0) - (k.up.isDown || k.w.isDown ? 1 : 0);
      // Keyboard moves along the iso axes visually: half vertical speed reads as "diagonal".
      if (kx && ky) { kx *= 0.894; ky *= 0.447; }
      let mx = kx || c.moveX, my = ky || c.moveY;
      // Walking to a tapped NPC (any stick or key input takes over again).
      if (mx || my) this.walkTo = null;
      else if (this.walkTo) {
        const dx = this.walkTo.x - this.player.x, dy = this.walkTo.y - this.player.y, d = Math.hypot(dx, dy);
        if (d < TALK_RANGE - 12) {
          const n = this.walkTo;
          this.walkTo = null;
          this.startTalk(n);
        } else (mx = dx / d), (my = dy / d);
      }
      this.player.move(mx, my, state.player!.spd, delta, this.map);

      if (Phaser.Input.Keyboard.JustDown(this.keys.space)) c.attack = true;
      if (Phaser.Input.Keyboard.JustDown(this.keys.e)) c.talk = true;
      if (Phaser.Input.Keyboard.JustDown(this.keys.q)) c.potion = true;
      if (Phaser.Input.Keyboard.JustDown(this.keys.shift)) c.dodge = true;
      if (Phaser.Input.Keyboard.JustDown(this.keys.f)) c.skill = true;
      if (Phaser.Input.Keyboard.JustDown(this.keys.r)) c.rain = true;
      if (this.town?.isPlacing && Phaser.Input.Keyboard.JustDown(this.keys.enter)) bus.emit('build-confirm');
      // AUTO: attack the nearest monster in reach (the attack's own cooldown sets the pace).
      if (state.autoAttack && !this.walkTo && this.combat.nearestTarget(this.combat.attackReach())) c.attack = true;
      if (c.dodge) this.player.roll(mx, my, time);
      if (c.skill) this.combat.useSkill(time);
      if (c.rain) this.combat.rainOfArrows(time);
      if (c.attack) this.combat.playerAttack(time);
      if (c.potion) this.combat.usePotion();
      if (c.talk && this.nearNpc) this.startTalk(this.nearNpc);
      else if (c.talk && this.nearBuilding) bus.emit('open-building', this.nearBuilding);
    } else {
      this.player.move(0, 0, 0, delta, this.map);
    }
    c.attack = c.talk = c.potion = c.dodge = c.skill = c.rain = false;

    if (!state.inMenu) this.combat.update(time, delta);
    this.town?.update(time);
    this.waves?.update(time, delta);
    if (!this.waves) bus.emit('cycle-tick', { raiders: 0, coreHp: 1, coreMax: 1, indoor: (AREA_NAMES[this.area] ?? '').toUpperCase() });
    this.checkDoors();
    this.updateNpcs(time, delta);
    if (this.ally && !state.inMenu) {
      const target = this.ally.update(time, delta, this.player, this.map, this.combat.liveMonsters);
      if (target) this.combat.allyShot(this.ally.x, this.ally.y, target, 8 + state.player!.level * 2);
    }
    this.updateNearbyNpc();
    this.drawTarget(time);
    if (time > this.nextObjective) {
      this.nextObjective = time + 200;
      this.emitObjective();
      this.emitMinimap();
    }
  }

  /** A pulsing red ring under the monster the next attack goes for. */
  private drawTarget(time: number) {
    const g = this.targetRing.clear();
    const m = state.inMenu || state.buildMode ? null : this.combat.nearestTarget();
    if (!m) return;
    const pulse = 1 + Math.sin(time / 120) * 0.08;
    const w = Math.max(28, m.sprite.displayWidth * 0.8) * pulse;
    g.lineStyle(3, 0xff4a3a, 0.9).strokeEllipse(m.x, m.y, w, w * 0.45);
  }

  /** Where everything is, for the mini-map and the big map (UI scene). */
  private emitMinimap() {
    const marks: { x: number; y: number; kind: string; label?: string }[] = [];
    for (const n of this.npcs) {
      const q = this.quests.markerFor(n.def.id);
      marks.push({ x: n.x, y: n.y, kind: q === '!' ? 'quest' : q === '?' ? 'turnin' : n.def.mark === 'shop' ? 'shop' : 'npc', label: n.def.role ? n.def.name : undefined });
    }
    for (const m of this.combat.liveMonsters) if (!m.dead) marks.push({ x: m.x, y: m.y, kind: m.def.boss ? 'boss' : 'monster' });
    for (const d of this.doors) marks.push({ ...gridToScreen(d.x, d.y), kind: 'door', label: d.label });
    if (this.town) marks.push({ ...this.town.corePoint(), kind: 'core', label: 'Ancient Core' });
    if (this.ally) marks.push({ x: this.ally.x, y: this.ally.y, kind: 'ally' });
    const goal = this.objective();
    if (goal) marks.push({ x: goal.x, y: goal.y, kind: 'goal' });
    bus.emit('minimap', {
      key: this.mapKey, h: this.mapH, area: this.area,
      px: this.player.x, py: this.player.y, fx: this.player.facing.x, fy: this.player.facing.y, marks,
    });
  }

  /** Works out the next goal (quest, giver, monsters, the Core at night) and tells the UI where it is. */
  private emitObjective() {
    const goal = this.objective();
    if (!goal) return void bus.emit('objective', null);
    const cam = this.cameras.main, v = cam.worldView;
    const sx = (goal.x - v.x) * cam.zoom, sy = (goal.y - v.y) * cam.zoom;
    const m = 30 * DPR, onScreen = sx > m && sy > m && sx < this.scale.width - m && sy < this.scale.height - m;
    bus.emit('objective', { sx: sx / DPR, sy: sy / DPR, label: goal.label, onScreen });
  }

  private objective(): { x: number; y: number; label: string } | null {
    const at = (id: string) => this.npcs.find((n) => n.def.id === id);
    const exit = this.doors.find((d) => d.to === 'overworld');
    const exitGoal = (label: string) => (exit ? { ...gridToScreen(exit.x, exit.y), label } : null);
    if (this.area === 'overworld' && state.cycle.phase === 'night' && this.town) return { ...this.town.corePoint(), label: 'Defend the Core!' };
    const q = this.quests;
    const active = [...q.active()].sort((a, b) => Number(b.id.startsWith('main')) - Number(a.id.startsWith('main')));
    for (const quest of active) {
      const o = quest.objective;
      if (o.type === 'talk') {
        const n = at(o.target);
        return n ? { x: n.x, y: n.y - 30, label: `Talk to ${n.def.name}` } : exitGoal('Leave');
      }
      if (q.isDone(quest.id)) {
        const n = at(quest.giver);
        return n ? { x: n.x, y: n.y - 30, label: `Report to ${n.def.name}` } : exitGoal('Leave');
      }
      if (o.target === 'gravemaw') {
        const boss = this.combat.liveMonsters.find((m) => m.def.tag === 'gravemaw' && !m.dead);
        if (boss) return { x: boss.x, y: boss.y - 30, label: 'Gravemaw' };
        const cave = this.doors.find((d) => d.to === 'cave');
        if (cave) return { ...gridToScreen(cave.x, cave.y), label: 'Old Cave' };
        continue;
      }
      const want = o.type === 'collect' && o.target === 'wolf_pelt' ? 'wolf' : o.target;
      let best: { x: number; y: number } | null = null, bd = Infinity;
      for (const m of this.combat.liveMonsters) {
        if (m.dead || m.def.id !== want || m.goal) continue;
        const d = m.distanceTo(this.player);
        if (d < bd) (bd = d), (best = m);
      }
      if (best) return { x: best.x, y: best.y - 20, label: o.label.split('(')[0].trim() };
    }
    const offer = this.npcs.find((n) => q.markerFor(n.def.id) === '!');
    if (offer) return { x: offer.x, y: offer.y - 30, label: `New quest: ${offer.def.name}` };
    return null;
  }

  /** NPC life (wandering, names up close) and their markers: ! quest, ? hand in, $ shop, ✦ teacher. */
  private updateNpcs(time: number, delta: number) {
    for (const n of this.npcs) {
      const d = n.distanceTo(this.player);
      n.near = d < TALK_RANGE * 1.4;
      n.update(time, delta, this.map, d);
      const m = n.def.mark;
      const q = this.quests.markerFor(n.def.id);
      if (q) n.setMarker(q);
      else if (m === 'shop') n.setMarker('$');
      else if (m === 'teacher') n.setMarker(!isUnlocked('mage') && state.player!.level >= 3 ? '✦' : '');
      else n.setMarker('');
    }
  }

  private updateNearbyNpc() {
    let best: Npc | null = null, bestD = TALK_RANGE;
    for (const n of this.npcs) {
      const d = n.distanceTo(this.player);
      if (d < bestD) (best = n), (bestD = d);
    }
    // With no one to talk to, TALK opens the nearest building's panel instead.
    const building = best || !this.town ? null : this.town.nearest();
    if (best !== this.nearNpc || building !== this.nearBuilding) {
      this.nearNpc = best;
      this.nearBuilding = building;
      bus.emit('npc-nearby', best?.def.name ?? (building ? 'building' : null));
    }
  }

  /** Build-mode events from the UI scene. */
  private wireTown() {
    const town = this.town!;
    const cam = this.cameras.main;
    const world = (sx: number, sy: number) => cam.getWorldPoint(sx, sy);
    const handlers: [string, (...a: any[]) => void][] = [
      // Build mode (Clash of Clans style): camera over the town, grid on, hero stands still.
      ['build-mode', (on: boolean) => {
        if (on && state.cycle.phase === 'night') return bus.emit('toast', 'No building at night. Defend the Core!');
        state.buildMode = on;
        town.showGrid(on);
        if (on) {
          cam.stopFollow();
          const c = town.corePoint();
          cam.pan(c.x, c.y, 400, 'Sine.easeInOut');
          cam.zoomTo(Math.max(0.8, this.zoom * 0.7) * DPR, 400);
        } else {
          town.cancelPlacing();
          cam.startFollow(this.player.sprite, true, 0.12, 0.12, 0, 20);
          cam.zoomTo(this.zoom * DPR, 300);
        }
        bus.emit('build-mode-changed', state.buildMode);
      }],
      ['build-start', (type: string) => {
        town.startPlacing(type, cam.midPoint);
        if (town.isPlacing) bus.emit('placing', type);
      }],
      ['building-move', (b: PlacedBuilding) => {
        if (!state.buildMode) bus.emit('build-mode', true);
        town.startPlacing(b.type, undefined, b);
        bus.emit('placing', b.type);
      }],
      ['build-confirm', () => town.confirmPlacing() && bus.emit('placing', null)],
      ['build-cancel', () => (town.cancelPlacing(), bus.emit('placing', null))],
      // Drag: moves the building being placed, otherwise pans the view.
      ['build-drag', (sx: number, sy: number, dx: number, dy: number) => {
        if (town.isPlacing) {
          const p = world(sx, sy);
          town.setCursorFromWorld(p.x, p.y);
        } else cam.setScroll(cam.scrollX - dx / cam.zoom, cam.scrollY - dy / cam.zoom);
      }],
      // Tap: drop the building there, or open the building you tapped.
      ['build-tap', (sx: number, sy: number) => {
        const p = world(sx, sy);
        if (town.isPlacing) return town.setCursorFromWorld(p.x, p.y);
        const b = town.buildingAt(p.x, p.y);
        if (b) bus.emit('open-building', b);
      }],
      ['building-upgrade', (b: PlacedBuilding) => town.upgrade(b)],
    ];
    for (const [ev, fn] of handlers) bus.on(ev, fn);
    this.events.once('shutdown', () => handlers.forEach(([ev, fn]) => bus.off(ev, fn)));
  }

  private startTalk(npc: Npc) {
    npc.face(this.player.x);
    this.player.sprite.setFlipX(npc.x < this.player.x);
    // The speech bubble follows the NPC's head on screen.
    const anchor = () => {
      const cam = this.cameras.main;
      return { x: ((npc.x - cam.worldView.x) * cam.zoom) / DPR, y: ((npc.y - npc.sprite.displayHeight - cam.worldView.y) * cam.zoom) / DPR };
    };
    bus.emit('dialogue-open', { ...this.dialogue.talk(npc.def.id, npc.def.name), anchor });
    bus.once('dialogue-closed', () => bus.emit('npc-nearby', this.nearNpc?.def.name ?? null));
  }
}
