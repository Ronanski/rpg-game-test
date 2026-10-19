import Phaser from 'phaser';
import { bus } from '../core/EventBus';
import { state, type PlayerStats } from '../core/GameState';
import { VirtualJoystick } from './VirtualJoystick';
import { ActionButton } from './ActionButton';
import { DialogueBox } from './DialogueBox';
import { panel, resizePanel, text, applyPortrait, COLORS } from './theme';
import type { Conversation } from '../systems/dialogue/DialogueSystem';
import type { QuestTracker } from '../systems/quest/QuestTracker';

const STATUS_W = 300, STATUS_H = 104, PORTRAIT = 84;

/**
 * UI Handler: everything drawn in screen space on top of the world.
 * Status panel, quest tracker, touch controls, dialogue and toasts.
 */
export class UIScene extends Phaser.Scene {
  private stick!: VirtualJoystick;
  private attackBtn!: ActionButton;
  private talkBtn!: ActionButton;
  private potionBtn!: ActionButton;
  private potionCount!: Phaser.GameObjects.Text;
  private dialogue!: DialogueBox;
  private bars!: Phaser.GameObjects.Graphics;
  private nameText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private barLabels!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private questPanel!: Phaser.GameObjects.NineSlice;
  private questTitle!: Phaser.GameObjects.Text;
  private questIcon!: Phaser.GameObjects.Image;
  private questText!: Phaser.GameObjects.Text;
  private quests!: QuestTracker;
  private statusBox!: Phaser.GameObjects.Container;
  private questBox!: Phaser.GameObjects.Container;
  /** HUD scale: smaller on short (phone) screens so the world stays visible. */
  private k = 1;

  constructor() {
    super('UI');
  }

  create(data: { quests: QuestTracker }) {
    this.quests = data.quests;
    this.input.addPointer(2);

    // Status panel (top-left): portrait, name, level, HP / MP / EXP.
    const x = 10, y = 10;
    const statusPanel = panel(this, x, y, STATUS_W, STATUS_H);
    const portraitPanel = panel(this, x + 10, y + 10, PORTRAIT, PORTRAIT);
    const portrait = this.add.image(x + 10 + PORTRAIT / 2, 0, state.player!.texture);
    const ph = applyPortrait(portrait, state.player!.texture, PORTRAIT - 12);
    portrait.setY(y + 10 + (PORTRAIT - ph) / 2);
    this.nameText = this.add.text(x + PORTRAIT + 30, y + 12, '', text(18));
    this.levelText = this.add.text(x + STATUS_W - 16, y + 14, '', text(15, COLORS.gold)).setOrigin(1, 0);
    this.barLabels = this.add.text(x + PORTRAIT + 30, y + 38, '', { ...text(14), lineSpacing: 6 });
    this.bars = this.add.graphics();
    const coin = this.add.image(x + 16, y + STATUS_H + 18, 'icon_coin').setScale(2);
    this.goldText = this.add.text(x + 32, y + STATUS_H + 9, '', text(16, COLORS.gold));
    this.statusBox = this.add.container(0, 0, [statusPanel, portraitPanel, portrait, this.nameText, this.levelText, this.barLabels, this.bars, coin, this.goldText]);

    // Quest tracker (top-right).
    this.questPanel = panel(this, 0, 10, 200, 60);
    this.questIcon = this.add.image(0, 0, 'icon_scroll').setScale(2);
    this.questTitle = this.add.text(0, 0, 'QUESTS', text(15, COLORS.gold));
    this.questText = this.add.text(0, 0, '', { ...text(13), lineSpacing: 4 });
    this.questBox = this.add.container(0, 0, [this.questPanel, this.questIcon, this.questTitle, this.questText]);

    // Touch controls (bottom). They also show on desktop, where keys work too.
    this.stick = new VirtualJoystick(this);
    this.attackBtn = new ActionButton(this, 'ATTACK', 'icon_sword', 84, () => (state.controls.attack = true));
    this.talkBtn = new ActionButton(this, 'TALK', 'icon_talk', 68, () => (state.controls.talk = true)).setVisible(false);
    this.potionBtn = new ActionButton(this, 'POTION', 'icon_potion', 64, () => (state.controls.potion = true));
    this.potionCount = this.add.text(0, 0, '', text(15, COLORS.gold)).setOrigin(1, 0).setDepth(12);
    this.dialogue = new DialogueBox(this);

    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));

    bus.on('player-stats', (s: PlayerStats) => this.drawStatus(s));
    bus.on('quest-updated', () => this.drawQuests());
    bus.on('npc-nearby', (name: string | null) => this.talkBtn.setVisible(!!name && !state.inDialogue));
    bus.on('toast', (msg: string) => this.toast(msg));
    bus.on('dialogue-open', (c: Conversation) => this.openDialogue(c));
    bus.on('inventory-changed', () => this.drawPotions());

    const kb = this.input.keyboard;
    kb?.on('keydown-SPACE', () => this.dialogue.advance());
    kb?.on('keydown-E', () => this.dialogue.advance());

    if (state.player) this.drawStatus(state.player);
    this.drawQuests();
    this.drawPotions();
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
      }, c.portrait),
    );
  }

  /** Touch controls auto-hide during dialogue (and later, base-building mode). */
  private setControlsVisible(on: boolean) {
    this.stick.setEnabled(on);
    this.attackBtn.setVisible(on);
    this.potionBtn.setVisible(on);
    this.potionCount.setVisible(on);
    if (!on) this.talkBtn.setVisible(false);
  }

  private layout() {
    const { width, height } = this.scale;
    const k = (this.k = height < 450 ? 0.72 : 1);
    this.statusBox.setScale(k);
    this.questBox.setScale(k);
    for (const b of [this.attackBtn, this.talkBtn, this.potionBtn]) b.setScale((b.baseScale = k));
    this.potionCount.setScale(k);
    this.attackBtn.setPosition(width - 62 * k, height - 62 * k);
    this.talkBtn.setPosition(width - 160 * k, height - 52 * k);
    this.potionBtn.setPosition(width - 62 * k, height - 164 * k);
    this.potionCount.setPosition(width - 34 * k, height - 194 * k);
    this.stick.resetPosition();
    this.dialogue.layout();
    this.drawQuests();
  }

  private drawStatus(s: PlayerStats) {
    const x = 10 + PORTRAIT + 30, y = 10;
    this.nameText.setText(s.name.toUpperCase());
    this.levelText.setText(`LV ${String(s.level).padStart(2, '0')}`);
    this.barLabels.setText(['HP', 'MP', 'EX'].join('\n'));
    const g = this.bars.clear();
    const bar = (by: number, cur: number, max: number, color: number) => {
      const bx = x + 30, bw = STATUS_W - (bx - 10) - 16, bh = 10;
      g.fillStyle(0x07080e).fillRect(bx - 2, by - 2, bw + 4, bh + 4);
      g.fillStyle(0x2a2f45).fillRect(bx, by, bw, bh);
      const fw = Math.round((bw * Math.max(0, cur)) / max);
      g.fillStyle(color).fillRect(bx, by, fw, bh);
      g.fillStyle(0xffffff, 0.35).fillRect(bx, by, fw, 2);
      g.fillStyle(0x000000, 0.25).fillRect(bx, by + bh - 2, fw, 2);
    };
    bar(y + 41, s.hp, s.maxHp, COLORS.hp);
    bar(y + 61, s.mp, s.maxMp, COLORS.mp);
    bar(y + 81, s.exp, s.expToNext, COLORS.exp);
    this.goldText.setText(`${s.gold}`);
  }

  private drawPotions() {
    this.potionCount.setText(`x${state.inventory.get('health_potion') ?? 0}`);
  }

  private drawQuests() {
    if (!this.quests) return;
    const active = this.quests.active();
    const lines = active.length === 0
      ? ['Talk to villagers']
      : active.map((q) => {
        const n = this.quests.progress(q.id), max = q.objective.count;
        return `${q.title}\n  ${q.objective.label}: ${n}/${max}${n >= max ? '  ✓ return' : ''}`;
      });
    this.questText.setText(lines.join('\n'));
    const w = Math.max(190, this.questText.width + 34), h = this.questText.height + 52;
    const x = this.scale.width / this.k - w - 10;
    resizePanel(this.questPanel, w, h);
    this.questPanel.setPosition(x, 10);
    this.questIcon.setPosition(x + 24, 33);
    this.questTitle.setPosition(x + 42, 24);
    this.questText.setPosition(x + 18, 48);
  }

  private toasts: Phaser.GameObjects.Text[] = [];
  private toast(msg: string) {
    const t = this.add
      .text(this.scale.width / 2, 150 + this.toasts.length * 34, msg, { ...text(16), backgroundColor: '#1a2034e6', padding: { x: 14, y: 7 } })
      .setOrigin(0.5)
      .setDepth(60);
    this.toasts.push(t);
    this.tweens.add({
      targets: t,
      alpha: 0,
      delay: 1700,
      duration: 400,
      onComplete: () => {
        this.toasts.splice(this.toasts.indexOf(t), 1);
        t.destroy();
        this.toasts.forEach((o, i) => this.tweens.add({ targets: o, y: 150 + i * 34, duration: 150 }));
      },
    });
  }
}
