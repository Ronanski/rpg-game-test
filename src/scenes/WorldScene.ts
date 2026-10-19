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

const TALK_RANGE = 70;

/** Free-roam field: the hero explores, talks to NPCs and fights monsters. */
export class WorldScene extends Phaser.Scene {
  private map!: IsoMap;
  private player!: Player;
  private npcs: Npc[] = [];
  private combat!: CombatSystem;
  private dialogue!: DialogueSystem;
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'space' | 'e' | 'q', Phaser.Input.Keyboard.Key>;
  private nearNpc: Npc | null = null;

  constructor() {
    super('World');
  }

  create() {
    const world = buildWorld();
    this.map = new IsoMap(this, world);
    this.map.render();

    const start = gridToScreen(world.playerStart.x, world.playerStart.y);
    this.player = new Player(this, start.x, start.y, state.player!.texture);
    this.npcs = world.npcs.map((d) => {
      const p = gridToScreen(d.x, d.y);
      return new Npc(this, p.x, p.y, d);
    });

    const quests = new QuestTracker();
    this.combat = new CombatSystem(this, this.map, this.player, quests, start);
    quests.setExpHandler((n) => this.combat.gainExp(n));
    this.combat.spawnAll(world.spawns);
    this.dialogue = new DialogueSystem(quests);

    const cam = this.cameras.main;
    const b = this.map.bounds();
    cam.setBounds(b.x, b.y, b.width, b.height);
    cam.startFollow(this.player.sprite, true, 0.12, 0.12, 0, 20);
    cam.setZoom(this.scale.width < 1000 ? 1.15 : 1.4);
    cam.setRoundPixels(true);

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('up,down,left,right,w,a,s,d,space,e,q') as typeof this.keys;

    this.scene.launch('UI', { quests });
    emitStats();
    bus.emit('toast', 'Explore the village. Talk to Elder Maren.');
  }

  update(time: number, delta: number) {
    const c = state.controls;
    if (!state.inDialogue) {
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
      if (c.attack) this.combat.playerAttack(time);
      if (c.potion) this.combat.usePotion();
      if (c.talk && this.nearNpc) this.startTalk(this.nearNpc);
    } else {
      this.player.move(0, 0, 0, delta, this.map);
    }
    c.attack = c.talk = c.potion = false;

    this.combat.update(time, delta);
    this.updateNearbyNpc();
  }

  private updateNearbyNpc() {
    let best: Npc | null = null, bestD = TALK_RANGE;
    for (const n of this.npcs) {
      const d = n.distanceTo(this.player);
      if (d < bestD) (best = n), (bestD = d);
    }
    if (best !== this.nearNpc) {
      this.nearNpc = best;
      bus.emit('npc-nearby', best?.def.name ?? null);
    }
  }

  private startTalk(npc: Npc) {
    npc.face(this.player.x);
    this.player.sprite.setFlipX(npc.x < this.player.x);
    bus.emit('dialogue-open', this.dialogue.talk(npc.def.id, npc.def.name));
    bus.once('dialogue-closed', () => bus.emit('npc-nearby', this.nearNpc?.def.name ?? null));
  }
}
