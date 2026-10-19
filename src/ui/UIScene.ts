import Phaser from 'phaser';
import { bus } from '../core/EventBus';
import { state, type PlayerStats } from '../core/GameState';
import { VirtualJoystick } from './VirtualJoystick';
import { ActionButton } from './ActionButton';
import { DialogueBox } from './DialogueBox';
import type { Conversation } from '../systems/dialogue/DialogueSystem';
import type { QuestTracker } from '../systems/quest/QuestTracker';

const FONT = { fontFamily: 'monospace', color: '#f4e9c8' };

/**
 * UI Handler: everything drawn in screen space on top of the world.
 * Status panel, quest tracker, touch controls, dialogue and toasts.
 */
export class UIScene extends Phaser.Scene {
  private stick!: VirtualJoystick;
  private attackBtn!: ActionButton;
  private talkBtn!: ActionButton;
  private dialogue!: DialogueBox;
  private status!: Phaser.GameObjects.Graphics;
  private statusText!: Phaser.GameObjects.Text;
  private portrait!: Phaser.GameObjects.Image;
  private questText!: Phaser.GameObjects.Text;
  private quests!: QuestTracker;

  constructor() {
    super('UI');
  }

  create(data: { quests: QuestTracker }) {
    this.quests = data.quests;
    this.input.addPointer(2);

    this.status = this.add.graphics();
    this.portrait = this.add.image(0, 0, 'hero').setScale(3.2);
    this.statusText = this.add.text(0, 0, '', { ...FONT, fontSize: '14px', lineSpacing: 6 });
    this.questText = this.add.text(0, 0, '', { ...FONT, fontSize: '13px', backgroundColor: '#15122acc', padding: { x: 10, y: 8 }, lineSpacing: 4 }).setOrigin(1, 0);

    this.stick = new VirtualJoystick(this);
    this.attackBtn = new ActionButton(this, 'ATK', 46, 0x8a2b2b, () => (state.controls.attack = true));
    this.talkBtn = new ActionButton(this, 'TALK', 34, 0x2b4f8a, () => (state.controls.talk = true)).setVisible(false);
    this.dialogue = new DialogueBox(this);

    this.layout();
    this.scale.on('resize', () => this.layout());

    bus.on('player-stats', (s: PlayerStats) => this.drawStatus(s));
    bus.on('quest-updated', () => this.drawQuests());
    bus.on('npc-nearby', (name: string | null) => this.talkBtn.setVisible(!!name && !state.inDialogue));
    bus.on('toast', (msg: string) => this.toast(msg));
    bus.on('dialogue-open', (c: Conversation) => this.openDialogue(c));

    const kb = this.input.keyboard;
    kb?.on('keydown-SPACE', () => this.dialogue.advance());
    kb?.on('keydown-E', () => this.dialogue.advance());

    if (state.player) this.drawStatus(state.player);
    this.drawQuests();
  }

  update() {
    if (!state.inDialogue) {
      state.controls.moveX = this.stick.value.x;
      state.controls.moveY = this.stick.value.y;
    }
  }

  private openDialogue(c: Conversation) {
    state.inDialogue = true;
    this.setControlsVisible(false);
    // Defer one frame so the tap that opened the dialogue doesn't also advance it.
    this.time.delayedCall(0, () =>
      this.dialogue.open(c.lines, () => {
        state.inDialogue = false;
        this.setControlsVisible(true);
        c.onEnd?.();
        bus.emit('dialogue-closed');
      }),
    );
  }

  /** Touch controls auto-hide during dialogue (and later, base-building mode). */
  private setControlsVisible(on: boolean) {
    this.stick.setEnabled(on);
    this.attackBtn.setVisible(on);
    if (!on) this.talkBtn.setVisible(false);
  }

  private layout() {
    const { width, height } = this.scale;
    this.attackBtn.setPosition(width - 80, height - 90);
    this.talkBtn.setPosition(width - 175, height - 60);
    this.questText.setPosition(width - 12, 12);
    this.stick.resetPosition();
    this.dialogue.layout();
  }

  private drawStatus(s: PlayerStats) {
    const x = 12, y = 12, w = 250, h = 92;
    const g = this.status.clear();
    g.fillStyle(0x15122a, 0.9).fillRoundedRect(x, y, w, h, 8).lineStyle(2, 0xc9a14a).strokeRoundedRect(x, y, w, h, 8);
    g.fillStyle(0x2a2440).fillRect(x + 8, y + 8, 64, 76).lineStyle(2, 0x6a5a8a).strokeRect(x + 8, y + 8, 64, 76);
    this.portrait.setPosition(x + 40, y + 46);

    const bar = (by: number, cur: number, max: number, color: number) => {
      g.fillStyle(0x000000, 0.6).fillRect(x + 108, by, 130, 10);
      g.fillStyle(color).fillRect(x + 108, by, (130 * cur) / max, 10);
    };
    bar(y + 34, s.hp, s.maxHp, 0xd94a3d);
    bar(y + 54, s.mp, s.maxMp, 0x3d7ad9);
    bar(y + 74, s.exp, s.expToNext, 0xd9b43d);
    this.statusText.setPosition(x + 80, y + 8).setText(
      [`${s.name.toUpperCase()}  LV ${String(s.level).padStart(2, '0')}`, 'HP', 'MP', 'EX'].join('\n'),
    );
    this.statusText.setLineSpacing(5.5);
    this.drawGold(s.gold);
  }

  private goldText?: Phaser.GameObjects.Text;
  private drawGold(gold: number) {
    this.goldText ??= this.add.text(16, 110, '', { ...FONT, fontSize: '14px', color: '#ffd75e', stroke: '#000', strokeThickness: 3 });
    this.goldText.setText(`● ${gold} gold`);
  }

  private drawQuests() {
    const active = this.quests.active();
    if (active.length === 0) {
      this.questText.setText('QUESTS\nTalk to villagers (TALK / E)');
      return;
    }
    const lines = active.map((q) => {
      const n = this.quests.progress(q.id), max = q.objective.count;
      return `${q.title}\n  ${q.objective.label}: ${n}/${max}${n >= max ? '  ✓ return' : ''}`;
    });
    this.questText.setText(['QUESTS', ...lines].join('\n'));
  }

  private toasts: Phaser.GameObjects.Text[] = [];
  private toast(msg: string) {
    const t = this.add
      .text(this.scale.width / 2, 70 + this.toasts.length * 32, msg, { ...FONT, fontSize: '15px', backgroundColor: '#15122add', padding: { x: 12, y: 6 } })
      .setOrigin(0.5)
      .setDepth(60);
    this.toasts.push(t);
    this.tweens.add({
      targets: t,
      alpha: 0,
      delay: 1600,
      duration: 400,
      onComplete: () => {
        this.toasts.splice(this.toasts.indexOf(t), 1);
        t.destroy();
        this.toasts.forEach((o, i) => this.tweens.add({ targets: o, y: 70 + i * 32, duration: 150 }));
      },
    });
  }
}
