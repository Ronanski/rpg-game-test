import Phaser from 'phaser';
import { bus } from '../core/EventBus';
import { state, type PlayerStats } from '../core/GameState';
import { VirtualJoystick } from './VirtualJoystick';
import { ActionButton } from './ActionButton';
import { DialogueBox } from './DialogueBox';
import { JobMenu } from './JobMenu';
import { InventoryMenu, ShopMenu, type ShopDef } from './ItemMenus';
import { BuildMenu, BuildingPanel, PlacementBar } from './BuildMenus';
import type { PlacedBuilding } from '../core/GameState';
import { BUILDINGS } from '../systems/town/Buildings';
import { JOBS } from '../systems/combat/ClassSystem';
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
  private jobMenu!: JobMenu;
  private bagMenu!: InventoryMenu;
  private shopMenu!: ShopMenu;
  private buildMenu!: BuildMenu;
  private buildingPanel!: BuildingPanel;
  private placementBar!: PlacementBar;
  private resTexts: Phaser.GameObjects.Text[] = [];
  private dodgeBtn!: ActionButton;
  private skillBtn!: ActionButton;
  private jobText!: Phaser.GameObjects.Text;
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
    // JOB button under the gold: shows the current job, opens the JOBS menu (J key too).
    const jobPanel = panel(this, x, y + STATUS_H + 32, 170, 32);
    // BAG button next to it (I key too).
    const bagPanel = panel(this, x + 178, y + STATUS_H + 32, 76, 32);
    const bagIcon = this.add.image(x + 196, y + STATUS_H + 48, 'item_bag');
    const bagText = this.add.text(x + 210, y + STATUS_H + 48, 'BAG', text(14)).setOrigin(0, 0.5);
    bagPanel.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.openMenu('bag'));
    // BUILD button (B key too).
    const buildPanel = panel(this, x + 262, y + STATUS_H + 32, 90, 32);
    const buildIcon = this.add.image(x + 280, y + STATUS_H + 48, 'icon_build').setScale(2);
    const buildText = this.add.text(x + 294, y + STATUS_H + 48, 'BUILD', text(14)).setOrigin(0, 0.5);
    buildPanel.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.openMenu('build'));
    // Town resources next to the gold.
    const resIcons = ['res_wood', 'res_stone', 'res_mana'].map((k, i) => this.add.image(x + 96 + i * 70, y + STATUS_H + 18, k).setScale(2));
    this.resTexts = resIcons.map((_, i) => this.add.text(x + 110 + i * 70, y + STATUS_H + 9, '', text(16)));
    this.jobText = this.add.text(x + 12, y + STATUS_H + 48, '', text(14)).setOrigin(0, 0.5);
    jobPanel.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.toggleJobs());
    this.statusBox = this.add.container(0, 0, [statusPanel, portraitPanel, portrait, this.nameText, this.levelText, this.barLabels, this.bars, coin, this.goldText, jobPanel, this.jobText, bagPanel, bagIcon, bagText, buildPanel, buildIcon, buildText, ...resIcons, ...this.resTexts]);

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
    this.potionBtn = new ActionButton(this, 'POTION', 'item_health_potion', 64, () => (state.controls.potion = true));
    this.skillBtn = new ActionButton(this, 'SKILL', 'icon_skill', 64, () => (state.controls.skill = true));
    this.dodgeBtn = new ActionButton(this, 'DODGE', 'icon_dodge', 64, () => (state.controls.dodge = true));
    this.potionCount = this.add.text(0, 0, '', text(15, COLORS.gold)).setOrigin(1, 0).setDepth(12);
    this.dialogue = new DialogueBox(this);
    this.jobMenu = new JobMenu(this, () => this.setControlsVisible(true));
    this.bagMenu = new InventoryMenu(this, () => this.setControlsVisible(true));
    this.shopMenu = new ShopMenu(this, () => this.setControlsVisible(true));
    this.buildMenu = new BuildMenu(this, () => this.setControlsVisible(!this.placementBar.visible));
    this.buildingPanel = new BuildingPanel(this, () => this.setControlsVisible(true));
    this.placementBar = new PlacementBar(this);
    bus.on('open-building', (b: PlacedBuilding) => {
      if (state.inMenu || state.inDialogue) return;
      this.setControlsVisible(false);
      this.buildingPanel.open(b);
    });
    bus.on('placing', (type: string | null) => {
      if (type) {
        this.setControlsVisible(false);
        this.stick.setEnabled(true); // still walk while placing
        this.placementBar.show(BUILDINGS[type].name);
      } else {
        this.placementBar.hide();
        this.setControlsVisible(true);
      }
    });
    // While placing, a tap on the world moves the build cursor there.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: unknown[]) => {
      if (this.placementBar.visible && over.length === 0 && p.x > this.scale.width * 0.45) bus.emit('build-tap', p.x, p.y);
    });
    bus.on('resources-changed', () => this.drawResources());
    bus.on('town-changed', () => (this.drawResources(), this.buildingPanel.draw(), this.buildMenu.draw()));    bus.on('open-shop', (shop: ShopDef) => this.openMenu('shop', shop));
    bus.on('equipment-changed', () => this.bagMenu.draw());
    bus.on('inventory-changed', () => (this.bagMenu.draw(), this.shopMenu.draw()));
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
    kb?.on('keydown-J', () => this.toggleJobs());
    kb?.on('keydown-I', () => (this.bagMenu.isOpen ? this.bagMenu.close() : this.openMenu('bag')));
    kb?.on('keydown-B', () => (this.buildMenu.isOpen ? this.buildMenu.close() : this.openMenu('build')));
    kb?.on('keydown-ESC', () => {
      [this.jobMenu, this.bagMenu, this.shopMenu, this.buildMenu, this.buildingPanel].forEach((m) => m.isOpen && m.close());
      if (this.placementBar.visible) bus.emit('build-cancel');
    });
    bus.on('jobs-changed', () => this.jobMenu.draw());

    if (state.player) this.drawStatus(state.player);
    this.drawQuests();
    this.drawPotions();
    this.drawResources();
  }

  update() {
    this.dialogue.layout();
    const now = this.time.now, cd = state.cooldowns;
    this.skillBtn.setCooldown((cd.skillReady - now) / cd.skillTotal);
    this.dodgeBtn.setCooldown((cd.dodgeReady - now) / cd.dodgeTotal);
    if (!state.inDialogue && !state.inMenu) {
      state.controls.moveX = this.stick.value.x;
      state.controls.moveY = this.stick.value.y;
    }
  }

  private openMenu(which: 'bag' | 'shop' | 'build', shop?: ShopDef) {
    if (state.inMenu || state.inDialogue) return;
    if (this.placementBar.visible) bus.emit('build-cancel');
    this.setControlsVisible(false);
    if (which === 'bag') this.bagMenu.open();
    else if (which === 'build') this.buildMenu.open();
    else this.shopMenu.open(shop!);
  }

  private toggleJobs() {
    if (state.inDialogue) return;
    if (this.jobMenu.isOpen) return this.jobMenu.close();
    if (state.inMenu) return;
    this.setControlsVisible(false);
    this.jobMenu.open();
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
      }, c.anchor),
    );
  }

  /** Touch controls auto-hide during dialogue (and later, base-building mode). */
  private setControlsVisible(on: boolean) {
    this.stick.setEnabled(on);
    this.attackBtn.setVisible(on);
    this.potionBtn.setVisible(on);
    this.skillBtn.setVisible(on);
    this.dodgeBtn.setVisible(on);
    this.potionCount.setVisible(on);
    if (!on) this.talkBtn.setVisible(false);
  }

  private layout() {
    const { width, height } = this.scale;
    const k = (this.k = height < 450 ? 0.72 : 1);
    this.statusBox.setScale(k);
    this.questBox.setScale(k);
    for (const b of [this.attackBtn, this.talkBtn, this.potionBtn, this.skillBtn, this.dodgeBtn]) b.setScale((b.baseScale = k));
    this.potionCount.setScale(k);
    this.attackBtn.setPosition(width - 62 * k, height - 62 * k);
    // Thumb arc around ATTACK: SKILL above-left, DODGE left, POTION above.
    this.skillBtn.setPosition(width - 150 * k, height - 140 * k);
    this.dodgeBtn.setPosition(width - 168 * k, height - 52 * k);
    this.talkBtn.setPosition(width - 252 * k, height - 52 * k);
    this.potionBtn.setPosition(width - 62 * k, height - 164 * k);
    this.potionCount.setPosition(width - 34 * k, height - 194 * k);
    this.stick.resetPosition();
    this.dialogue.layout();
    this.jobMenu.draw();
    this.bagMenu.draw();
    this.shopMenu.draw();
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
    this.jobText.setText(`JOB  ${JOBS[s.jobId].name.toUpperCase()}  ▸`);
  }

  private drawResources() {
    const t = state.town;
    [t.wood, t.stone, t.mana].forEach((n, i) => this.resTexts[i].setText(String(n)));
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
