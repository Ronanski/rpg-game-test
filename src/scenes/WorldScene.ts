import Phaser from 'phaser';
import { buildWorld } from '../world/worldData';
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

const TALK_RANGE = 70;
const AUTOSAVE_MS = 5000;

/** Free-roam field: the hero explores, talks to NPCs and fights monsters. */
export class WorldScene extends Phaser.Scene {
  private map!: IsoMap;
  private player!: Player;
  private npcs: Npc[] = [];
  private combat!: CombatSystem;
  private dialogue!: DialogueSystem;
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'space' | 'e' | 'q' | 'shift' | 'f' | 'enter', Phaser.Input.Keyboard.Key>;
  private nearNpc: Npc | null = null;
  private nearBuilding: PlacedBuilding | null = null;
  private town!: TownSystem;
  private zoom = 1;
  private quests!: QuestTracker;
  private waves!: WaveSystem;
  private lighting!: LightingSystem;

  constructor() {
    super('World');
  }

  create(data: { save?: SaveData } = {}) {
    state.buildMode = false;
    const world = buildWorld();
    this.map = new IsoMap(this, world);
    this.map.render();
    this.lighting = new LightingSystem(this);

    const start = gridToScreen(world.playerStart.x, world.playerStart.y);
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

    this.town = new TownSystem(this, this.map, this.player, this.combat);
    this.wireTown();
    this.waves = new WaveSystem(this, this.combat, this.town, this.lighting);

    // Continue a saved game: quests and the spot where the hero stood.
    if (data.save) {
      quests.importState(data.save.quests);
      if (this.map.walkable(data.save.pos.x, data.save.pos.y)) this.player.teleport(data.save.pos.x, data.save.pos.y);
    }
    // Autosave every few seconds, after quest changes, and when the tab is hidden or closed.
    setSnapshotSource(() => ({ quests: quests.exportState(), pos: { x: this.player.x, y: this.player.y } }));
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
    this.zoom = Phaser.Math.Clamp(Math.round((this.scale.height / 460) * 4) / 4, 1, 2.5);
    cam.setZoom(this.zoom);
    cam.setRoundPixels(true);

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('up,down,left,right,w,a,s,d,space,e,q,shift,f,enter') as typeof this.keys;

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
    bus.emit('toast', data.save ? `Welcome back, ${state.player!.name}.` : 'Welcome to Oakhaven. Talk to Martha.');
  }

  update(time: number, delta: number) {
    const c = state.controls;
    if (!state.inDialogue && !state.inMenu && !state.buildMode) {
      const k = this.keys;
      let kx = (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0);
      let ky = (k.down.isDown || k.s.isDown ? 1 : 0) - (k.up.isDown || k.w.isDown ? 1 : 0);
      // Keyboard moves along the iso axes visually: half vertical speed reads as "diagonal".
      if (kx && ky) { kx *= 0.894; ky *= 0.447; }
      const mx = kx || c.moveX, my = ky || c.moveY;
      this.player.move(mx, my, state.player!.spd, delta, this.map);

      if (Phaser.Input.Keyboard.JustDown(this.keys.space)) c.attack = true;
      if (Phaser.Input.Keyboard.JustDown(this.keys.e)) c.talk = true;
      if (Phaser.Input.Keyboard.JustDown(this.keys.q)) c.potion = true;
      if (Phaser.Input.Keyboard.JustDown(this.keys.shift)) c.dodge = true;
      if (Phaser.Input.Keyboard.JustDown(this.keys.f)) c.skill = true;
      if (this.town.isPlacing && Phaser.Input.Keyboard.JustDown(this.keys.enter)) bus.emit('build-confirm');
      if (c.dodge) this.player.roll(mx, my, time);
      if (c.skill) this.combat.useSkill(time);
      if (c.attack) this.combat.playerAttack(time);
      if (c.potion) this.combat.usePotion();
      if (c.talk && this.nearNpc) this.startTalk(this.nearNpc);
      else if (c.talk && this.nearBuilding) bus.emit('open-building', this.nearBuilding);
    } else {
      this.player.move(0, 0, 0, delta, this.map);
    }
    c.attack = c.talk = c.potion = c.dodge = c.skill = false;

    if (!state.inMenu) this.combat.update(time, delta);
    this.town.update(time);
    this.waves.update(time, delta);
    this.updateNpcs(time, delta);
    this.updateNearbyNpc();
  }

  /** NPC life (wandering, names up close) and their markers: ! quest, ? hand in, $ shop, ✦ teacher. */
  private updateNpcs(time: number, delta: number) {
    for (const n of this.npcs) {
      const d = n.distanceTo(this.player);
      n.near = d < TALK_RANGE * 1.4;
      n.update(time, delta, this.map, d);
      const m = n.def.mark;
      if (m === 'shop') n.setMarker('$');
      else if (m === 'teacher') n.setMarker(!isUnlocked('mage') && state.player!.level >= 3 ? '✦' : '');
      else if (m === 'quest' && n.def.quest) {
        const st = this.quests.statusOf(n.def.quest);
        n.setMarker(st === 'available' ? '!' : st === 'active' && this.quests.isDone(n.def.quest) ? '?' : '');
      }
    }
  }

  private updateNearbyNpc() {
    let best: Npc | null = null, bestD = TALK_RANGE;
    for (const n of this.npcs) {
      const d = n.distanceTo(this.player);
      if (d < bestD) (best = n), (bestD = d);
    }
    // With no one to talk to, TALK opens the nearest building's panel instead.
    const building = best ? null : this.town.nearest();
    if (best !== this.nearNpc || building !== this.nearBuilding) {
      this.nearNpc = best;
      this.nearBuilding = building;
      bus.emit('npc-nearby', best?.def.name ?? (building ? 'building' : null));
    }
  }

  /** Build-mode events from the UI scene. */
  private wireTown() {
    const cam = this.cameras.main;
    const world = (sx: number, sy: number) => cam.getWorldPoint(sx, sy);
    const handlers: [string, (...a: any[]) => void][] = [
      // Build mode (Clash of Clans style): camera over the town, grid on, hero stands still.
      ['build-mode', (on: boolean) => {
        if (on && state.cycle.phase === 'night') return bus.emit('toast', 'No building at night. Defend the Core!');
        state.buildMode = on;
        this.town.showGrid(on);
        if (on) {
          cam.stopFollow();
          const c = this.town.corePoint();
          cam.pan(c.x, c.y, 400, 'Sine.easeInOut');
          cam.zoomTo(Math.max(0.8, this.zoom * 0.7), 400);
        } else {
          this.town.cancelPlacing();
          cam.startFollow(this.player.sprite, true, 0.12, 0.12, 0, 20);
          cam.zoomTo(this.zoom, 300);
        }
        bus.emit('build-mode-changed', state.buildMode);
      }],
      ['build-start', (type: string) => {
        this.town.startPlacing(type, cam.midPoint);
        if (this.town.isPlacing) bus.emit('placing', type);
      }],
      ['building-move', (b: PlacedBuilding) => {
        if (!state.buildMode) bus.emit('build-mode', true);
        this.town.startPlacing(b.type, undefined, b);
        bus.emit('placing', b.type);
      }],
      ['build-confirm', () => this.town.confirmPlacing() && bus.emit('placing', null)],
      ['build-cancel', () => (this.town.cancelPlacing(), bus.emit('placing', null))],
      // Drag: moves the building being placed, otherwise pans the view.
      ['build-drag', (sx: number, sy: number, dx: number, dy: number) => {
        if (this.town.isPlacing) {
          const p = world(sx, sy);
          this.town.setCursorFromWorld(p.x, p.y);
        } else cam.setScroll(cam.scrollX - dx / cam.zoom, cam.scrollY - dy / cam.zoom);
      }],
      // Tap: drop the building there, or open the building you tapped.
      ['build-tap', (sx: number, sy: number) => {
        const p = world(sx, sy);
        if (this.town.isPlacing) return this.town.setCursorFromWorld(p.x, p.y);
        const b = this.town.buildingAt(p.x, p.y);
        if (b) bus.emit('open-building', b);
      }],
      ['building-upgrade', (b: PlacedBuilding) => this.town.upgrade(b)],
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
      return { x: (npc.x - cam.worldView.x) * cam.zoom, y: (npc.y - npc.sprite.displayHeight - cam.worldView.y) * cam.zoom };
    };
    bus.emit('dialogue-open', { ...this.dialogue.talk(npc.def.id, npc.def.name), anchor });
    bus.once('dialogue-closed', () => bus.emit('npc-nearby', this.nearNpc?.def.name ?? null));
  }
}
