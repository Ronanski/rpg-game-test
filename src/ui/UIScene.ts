import Phaser from 'phaser';
import { bus } from '../core/EventBus';
import { state, type PlayerStats } from '../core/GameState';
import { VirtualJoystick } from './VirtualJoystick';
import { ActionButton } from './ActionButton';
import { DialogueBox } from './DialogueBox';
import { JobMenu } from './JobMenu';
import { InventoryMenu, ShopMenu, PauseMenu, type ShopDef } from './ItemMenus';
import { saveGame } from '../core/SaveGame';
import { BuildMenu, BuildingPanel, PlacementBar } from './BuildMenus';
import { BigMap, MinimapView, type MapData } from './MinimapView';
import { Tutorial } from './Tutorial';
import type { PlacedBuilding } from '../core/GameState';
import { BUILDINGS } from '../systems/town/Buildings';
import { JOBS } from '../systems/combat/ClassSystem';
import { weaponType } from '../systems/items/Items';
import { ARCHER } from '../systems/combat/CombatSystem';
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
  private pauseMenu!: PauseMenu;
  private menuBtn!: Phaser.GameObjects.Container;
  private zoomBox!: Phaser.GameObjects.Container;
  private autoBtn!: ActionButton;
  private rainBtn!: ActionButton;
  private controlsOn = true;
  private minimap!: MinimapView;
  private bigMap!: BigMap;
  private objArrow!: Phaser.GameObjects.Container;
  private objText!: Phaser.GameObjects.Text;
  private buildMenu!: BuildMenu;
  private buildingPanel!: BuildingPanel;
  private placementBar!: PlacementBar;
  private resTexts: Phaser.GameObjects.Text[] = [];
  private buildBar!: Phaser.GameObjects.Container;
  private buildBarText!: Phaser.GameObjects.Text;
  private buildBarBtns: Phaser.GameObjects.Container[] = [];
  private cycleBox!: Phaser.GameObjects.Container;
  private cyclePanel!: Phaser.GameObjects.NineSlice;
  private cycleText!: Phaser.GameObjects.Text;
  private cycleBar!: Phaser.GameObjects.Graphics;
  private nightBtn!: Phaser.GameObjects.Container;
  private dodgeBtn!: ActionButton;
  private skillBtn!: ActionButton;
  private jobText!: Phaser.GameObjects.Text;
  private bars!: Phaser.GameObjects.Graphics;
  private nameText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private barLabels!: Phaser.GameObjects.Text;
  /** HP / MP / EX labels, one per bar. */
  private barTags: Phaser.GameObjects.Text[] = [];
  private goldText!: Phaser.GameObjects.Text;
  private questPanel!: Phaser.GameObjects.NineSlice;
  private questTitle!: Phaser.GameObjects.Text;
  private questIcon!: Phaser.GameObjects.Image;
  private questText!: Phaser.GameObjects.Text;
  private quests!: QuestTracker;
  private tutorial!: Tutorial;
  private statusBox!: Phaser.GameObjects.Container;
  private questBox!: Phaser.GameObjects.Container;
  /** HUD scale: smaller on short (phone) screens so the world stays visible. */
  private k = 1;

  constructor() {
    super('UI');
  }

  /** Bus listeners added by this scene, removed when it shuts down (quit to title). */
  private listen(ev: string, fn: (...a: any[]) => void) {
    bus.on(ev, fn);
    this.events.once('shutdown', () => bus.off(ev, fn));
  }

  create(data: { quests: QuestTracker }) {
    this.quests = data.quests;
    this.tutorial = new Tutorial(this, this.quests);
    this.input.addPointer(2);

    // Status panel (top-left): portrait, name, level, HP / MP / EXP.
    const x = 10, y = 10;
    const statusPanel = panel(this, x, y, STATUS_W, STATUS_H);
    const portraitPanel = panel(this, x + 10, y + 10, PORTRAIT, PORTRAIT);
    const portrait = this.add.image(x + 10 + PORTRAIT / 2, 0, state.player!.texture);
    const ph = applyPortrait(portrait, state.player!.texture, PORTRAIT - 12);
    portrait.setY(y + 10 + (PORTRAIT - ph) / 2);
    this.listen('appearance-changed', (key: string) => portrait.setY(y + 10 + (PORTRAIT - applyPortrait(portrait, key, PORTRAIT - 12)) / 2));
    this.nameText = this.add.text(x + PORTRAIT + 30, y + 12, '', text(18));
    this.levelText = this.add.text(x + STATUS_W - 16, y + 14, '', text(15, COLORS.gold)).setOrigin(1, 0);
    this.barLabels = this.add.text(x + PORTRAIT + 30, y + 46, '', { ...text(13), lineSpacing: 0 }).setOrigin(0, 0.5);
    this.bars = this.add.graphics();
    this.barTags = [0, 1, 2].map((i) => this.add.text(x + PORTRAIT + 30, y + 46 + i * 20, '', text(13)).setOrigin(0, 0.5));
    const coin = this.add.image(x + 16, y + STATUS_H + 18, 'icon_coin').setScale(2);
    this.goldText = this.add.text(x + 32, y + STATUS_H + 9, '', text(16, COLORS.gold));
    // JOB button under the gold: shows the current job, opens the JOBS menu (J key too).
    const jobPanel = panel(this, x, y + STATUS_H + 32, 170, 32);
    // BAG button next to it (I key too).
    const bagPanel = panel(this, x + 178, y + STATUS_H + 32, 76, 32);
    const bagIcon = this.add.image(x + 196, y + STATUS_H + 48, 'icon_items').setScale(0.55);
    const bagText = this.add.text(x + 210, y + STATUS_H + 48, 'BAG', text(14)).setOrigin(0, 0.5);
    bagPanel.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.openMenu('bag'));
    // BUILD button (B key too).
    const buildPanel = panel(this, x + 262, y + STATUS_H + 32, 90, 32);
    const buildIcon = this.add.image(x + 280, y + STATUS_H + 48, 'icon_crafting').setScale(0.55);
    const buildText = this.add.text(x + 294, y + STATUS_H + 48, 'BUILD', text(14)).setOrigin(0, 0.5);
    buildPanel.setInteractive({ useHandCursor: true }).on('pointerdown', () => bus.emit('build-mode', true));
    // Town resources next to the gold.
    const resIcons = ['res_wood', 'res_stone', 'res_mana'].map((k, i) => this.add.image(x + 96 + i * 70, y + STATUS_H + 18, k).setScale(2));
    this.resTexts = resIcons.map((_, i) => this.add.text(x + 110 + i * 70, y + STATUS_H + 9, '', text(16)));
    this.jobText = this.add.text(x + 12, y + STATUS_H + 48, '', text(14)).setOrigin(0, 0.5);
    jobPanel.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.toggleJobs());
    this.statusBox = this.add.container(0, 0, [statusPanel, portraitPanel, portrait, this.nameText, this.levelText, this.barLabels, ...this.barTags, this.bars, coin, this.goldText, jobPanel, this.jobText, bagPanel, bagIcon, bagText, buildPanel, buildIcon, buildText, ...resIcons, ...this.resTexts]);

    // Quest tracker (top-right).
    this.questPanel = panel(this, 0, 10, 200, 60);
    this.questIcon = this.add.image(0, 0, 'icon_quests').setScale(0.5);
    this.questTitle = this.add.text(0, 0, 'QUESTS', text(15, COLORS.gold));
    this.questText = this.add.text(0, 0, '', { ...text(13), lineSpacing: 4 });
    this.questBox = this.add.container(0, 0, [this.questPanel, this.questIcon, this.questTitle, this.questText]);
    // MENU button (top-right corner; Esc too when nothing else is open).
    const mIcon = this.add.image(-24, 32, 'icon_settings').setScale(46 / 48).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.openPause());
    this.menuBtn = this.add.container(0, 0, [mIcon]);
    // Mini-map (owner's compass ring) with zoom + / − and the MAP button beside it.
    this.minimap = new MinimapView(this, () => this.openBigMap());
    this.bigMap = new BigMap(this, () => this.setControlsVisible(true));
    this.listen('minimap', (d: MapData) => this.minimap.update(d));
    const zImg = (y: number, key: string, f: number) =>
      this.add.image(0, y, key).setScale(0.85).setInteractive({ useHandCursor: true }).on('pointerdown', () => bus.emit('zoom-by', f));
    const mapBtn = this.add.image(0, 92, 'icon_map').setScale(0.75).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.openBigMap());
    this.zoomBox = this.add.container(0, 0, [zImg(0, 'ui_btn_plus', 1.25), zImg(42, 'ui_btn_minus', 0.8), mapBtn]);
    // Arrow at the screen edge pointing to what to do next (quest giver, monsters, the Core at night).
    const g = this.add.graphics();
    g.fillStyle(0xffd75e).fillTriangle(16, 0, -10, -11, -10, 11).lineStyle(2, 0x07080e).strokeTriangle(16, 0, -10, -11, -10, 11);
    this.objText = this.add.text(0, 22, '', text(13, COLORS.gold)).setOrigin(0.5, 0);
    this.objArrow = this.add.container(0, 0, [g, this.objText]).setVisible(false).setDepth(40);
    this.tweens.add({ targets: g, scale: 1.2, duration: 450, yoyo: true, repeat: -1 });
    this.listen('objective', (o: { sx: number; sy: number; label: string; onScreen: boolean } | null) => this.drawObjective(o));

    // Day / night clock (top centre): time to nightfall and START NIGHT, or raiders left and Core HP.
    this.cyclePanel = panel(this, -120, 0, 240, 40);
    this.cycleText = this.add.text(0, 20, '', text(14)).setOrigin(0.5);
    this.cycleBar = this.add.graphics();
    const nbBg = panel(this, -60, 44, 120, 30, true);
    const nbTx = this.add.text(0, 59, 'START NIGHT', text(13, COLORS.gold)).setOrigin(0.5);
    nbBg.setInteractive({ useHandCursor: true }).on('pointerdown', () => bus.emit('start-night'));
    this.nightBtn = this.add.container(0, 0, [nbBg, nbTx]);
    this.cycleBox = this.add.container(0, 10, [this.cyclePanel, this.cycleText, this.cycleBar, this.nightBtn]);
    this.listen('cycle-tick', (c: { raiders: number; coreHp: number; coreMax: number; indoor?: string }) => this.drawCycle(c));

    // Touch controls (bottom). They also show on desktop, where keys work too.
    this.stick = new VirtualJoystick(this);
    this.attackBtn = new ActionButton(this, 'ATTACK', 'icon_sword', 84, () => (state.controls.attack = true));
    this.talkBtn = new ActionButton(this, 'TALK', 'icon_talk', 68, () => (state.controls.talk = true)).setVisible(false);
    this.potionBtn = new ActionButton(this, 'POTION', 'item_health_potion', 64, () => (state.controls.potion = true));
    this.skillBtn = new ActionButton(this, 'SKILL', 'icon_skill', 64, () => (state.controls.skill = true));
    this.dodgeBtn = new ActionButton(this, 'DODGE', 'icon_dodge', 64, () => (state.controls.dodge = true));
    // RAIN: the archer's Rain of Arrows (shown from level 5 with a bow).
    this.rainBtn = new ActionButton(this, 'RAIN', 'item_bow', 56, () => (state.controls.rain = true));
    // AUTO: attack the nearest monster without pressing ATTACK.
    this.autoBtn = new ActionButton(this, 'AUTO', 'pin_star', 56, () => {
      state.autoAttack = !state.autoAttack;
      try {
        localStorage.setItem('aethelgard.auto', state.autoAttack ? '1' : '0');
      } catch {
        // No storage: the choice lasts until the game closes.
      }
      this.autoBtn.setOn(state.autoAttack, state.autoAttack ? 'AUTO ON' : 'AUTO');
    });
    this.autoBtn.setOn(state.autoAttack, state.autoAttack ? 'AUTO ON' : 'AUTO');
    this.potionCount = this.add.text(0, 0, '', text(15, COLORS.gold)).setOrigin(1, 0).setDepth(12);
    this.dialogue = new DialogueBox(this);
    this.jobMenu = new JobMenu(this, () => this.setControlsVisible(true));
    this.bagMenu = new InventoryMenu(this, () => this.setControlsVisible(true));
    this.shopMenu = new ShopMenu(this, () => this.setControlsVisible(true));
    this.pauseMenu = new PauseMenu(this, () => this.setControlsVisible(true), () => this.quitToTitle());
    this.buildMenu = new BuildMenu(this, () => this.showBuildBar());
    this.buildingPanel = new BuildingPanel(this, () => this.setControlsVisible(true));
    this.placementBar = new PlacementBar(this);
    this.listen('open-building', (b: PlacedBuilding) => {
      if (state.inMenu || state.inDialogue) return;
      this.setControlsVisible(false);
      this.buildingPanel.open(b);
    });
    this.listen('placing', (type: string | null) => {
      if (type) {
        this.buildBar.setVisible(false);
        this.placementBar.show(BUILDINGS[type].name);
      } else {
        this.placementBar.hide();
        this.showBuildBar();
      }
    });
    // Build mode bar: builders free, SHOP and DONE.
    const bbText = this.add.text(0, 0, '', { ...text(15), backgroundColor: '#15120ee6', padding: { x: 12, y: 6 } }).setOrigin(0.5, 0);
    const mkBtn = (label: string, color: number, on: () => void) => {
      const r = this.add.rectangle(0, 0, 120, 48, color).setStrokeStyle(3, 0xf4ead0).setInteractive({ useHandCursor: true }).on('pointerdown', on);
      const t = this.add.text(0, 0, label, text(17)).setOrigin(0.5);
      return this.add.container(0, 0, [r, t]);
    };
    const shopBtn = mkBtn('SHOP', 0x2b4f8a, () => (this.buildBar.setVisible(false), this.buildMenu.open()));
    const doneBtn = mkBtn('DONE', 0x2b7a3f, () => bus.emit('build-mode', false));
    this.buildBar = this.add.container(0, 0, [bbText, shopBtn, doneBtn]).setDepth(55).setVisible(false);
    this.buildBarText = bbText;
    this.buildBarBtns = [shopBtn, doneBtn];
    this.listen('build-mode-changed', (on: boolean) => {
      if (on) {
        this.setControlsVisible(false);
        this.showBuildBar();
      } else {
        this.buildBar.setVisible(false);
        this.placementBar.hide();
        this.setControlsVisible(true);
      }
    });
    // In build mode, drag on the world to move the building (or pan); tap to select.
    let down: { x: number; y: number; lx: number; ly: number; drag: boolean } | null = null;
    // Outside build mode, a quick tap on the world (an NPC) is sent to the world scene.
    let tap: { x: number; y: number; t: number } | null = null;
    let pinch = 0;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: unknown[]) => {
      if (state.buildMode && !state.inMenu && over.length === 0) down = { x: p.x, y: p.y, lx: p.x, ly: p.y, drag: false };
      tap = !state.buildMode && !state.inMenu && !state.inDialogue && over.length === 0 ? { x: p.x, y: p.y, t: this.time.now } : null;
      pinch = 0;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      // Two fingers: pinch to zoom.
      const a = this.input.pointer1, b = this.input.pointer2;
      if (a.isDown && b.isDown && !state.inMenu) {
        const d = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
        if (pinch > 0 && Math.abs(d - pinch) > 2) bus.emit('zoom-by', d / pinch);
        pinch = d;
        tap = null;
        return;
      }
      if (tap && Math.hypot(p.x - tap.x, p.y - tap.y) > 12) tap = null;
      if (!down || !p.isDown) return;
      if (!down.drag && Math.hypot(p.x - down.x, p.y - down.y) > 8) down.drag = true;
      if (down.drag) bus.emit('build-drag', p.x, p.y, p.x - down.lx, p.y - down.ly);
      down.lx = p.x;
      down.ly = p.y;
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (down && !down.drag) bus.emit('build-tap', p.x, p.y);
      down = null;
      if (tap && this.time.now - tap.t < 350) bus.emit('world-tap', p.x, p.y);
      tap = null;
      pinch = 0;
    });
    this.listen('resources-changed', () => this.drawResources());
    this.listen('town-changed', () => (this.drawResources(), this.buildingPanel.draw(), this.buildMenu.draw(), this.buildBar.visible && this.showBuildBar()));
    this.listen('open-shop', (shop: ShopDef) => this.openMenu('shop', shop));
    this.listen('equipment-changed', () => this.bagMenu.draw());
    this.listen('inventory-changed', () => (this.bagMenu.draw(), this.shopMenu.draw()));
    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));

    this.listen('player-stats', (s: PlayerStats) => this.drawStatus(s));
    this.listen('quest-updated', () => this.drawQuests());
    this.listen('npc-nearby', (name: string | null) => this.talkBtn.setVisible(!!name && !state.inDialogue));
    this.listen('toast', (msg: string) => this.toast(msg));
    this.listen('dialogue-open', (c: Conversation) => this.openDialogue(c));
    this.listen('inventory-changed', () => this.drawPotions());

    const kb = this.input.keyboard;
    kb?.on('keydown-SPACE', () => this.dialogue.advance());
    kb?.on('keydown-E', () => this.dialogue.advance());
    kb?.on('keydown-J', () => this.toggleJobs());
    kb?.on('keydown-I', () => (this.bagMenu.isOpen ? this.bagMenu.close() : this.openMenu('bag')));
    kb?.on('keydown-B', () => bus.emit('build-mode', !state.buildMode));
    kb?.on('keydown-M', () => (this.bigMap.isOpen ? this.bigMap.close() : this.openBigMap()));
    kb?.on('keydown-ESC', () => {
      if (this.bigMap.isOpen) return this.bigMap.close();
      const open = [this.jobMenu, this.bagMenu, this.shopMenu, this.buildMenu, this.buildingPanel, this.pauseMenu].filter((m) => m.isOpen);
      open.forEach((m) => m.close());
      if (this.placementBar.visible) bus.emit('build-cancel');
      else if (state.buildMode && !open.length) bus.emit('build-mode', false);
      else if (!open.length) this.openPause();
      if (this.placementBar.visible) bus.emit('build-cancel');
    });
    this.listen('jobs-changed', () => this.jobMenu.draw());

    if (state.player) this.drawStatus(state.player);
    this.drawQuests();
    this.drawPotions();
    this.drawResources();
  }

  update() {
    this.dialogue.layout();
    this.tutorial.update(this.scale.width, this.scale.height, this.k);
    const now = this.time.now, cd = state.cooldowns;
    this.skillBtn.setCooldown((cd.skillReady - now) / cd.skillTotal);
    this.rainBtn.setCooldown((cd.rainReady - now) / cd.rainTotal);
    // RAIN only for archers who have learned it.
    const ps = state.player;
    const canRain = !!ps && ps.level >= ARCHER.rain.level && weaponType() === 'bow';
    this.rainBtn.setVisible(this.controlsOn && canRain);
    this.autoBtn.setOn(state.autoAttack, state.autoAttack ? 'AUTO ON' : 'AUTO');
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

  /** Build mode bar: shows how many builders are free; SHOP lists buildings, DONE leaves. */
  private showBuildBar() {
    if (!state.buildMode) return this.setControlsVisible(!state.inMenu);
    const { width, height } = this.scale;
    const huts = state.town.buildings.filter((b) => b.type === 'builder_hut').length;
    const busy = state.town.buildings.filter((b) => b.status !== 'idle').length;
    this.buildBarText.setText(`BUILD MODE · Builders free: ${huts - busy}/${huts}\nDrag to look around · tap a building`)
      .setPosition(12, height - 12).setOrigin(0, 1).setScale(this.k);
    this.buildBarBtns[0].setPosition(width - 210 * this.k, height - 40 * this.k).setScale(this.k);
    this.buildBarBtns[1].setPosition(width - 76 * this.k, height - 40 * this.k).setScale(this.k);
    this.buildBar.setVisible(!this.placementBar.visible);
  }

  private openPause() {
    if (state.inMenu || state.inDialogue) return;
    if (this.placementBar.visible) bus.emit('build-cancel');
    this.setControlsVisible(false);
    this.pauseMenu.open();
  }

  private quitToTitle() {
    saveGame();
    state.inMenu = false;
    state.inDialogue = false;
    this.scene.stop('World');
    this.scene.start('Title');
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
    this.autoBtn.setVisible(on);
    this.controlsOn = on;
    this.potionCount.setVisible(on);
    if (!on) this.talkBtn.setVisible(false);
  }

  private openBigMap() {
    if (state.inMenu || state.inDialogue || state.buildMode || !this.minimap.data) return;
    this.setControlsVisible(false);
    this.bigMap.open(this.minimap.data);
  }

  /** Points the guide arrow at the next goal (hidden when it's already on screen). */
  private drawObjective(o: { sx: number; sy: number; label: string; onScreen: boolean } | null) {
    if (!o || state.inMenu || state.buildMode) return void this.objArrow.setVisible(false);
    const { width, height } = this.scale;
    if (o.onScreen) {
      // Bob just above the goal itself.
      this.objArrow.setVisible(true).setPosition(o.sx, Math.max(60, o.sy - 70));
      (this.objArrow.list[0] as Phaser.GameObjects.Graphics).setRotation(Math.PI / 2);
      // The goal is in view (and has its own name tag): just the arrow over it.
      this.objText.setText('');
      return;
    }
    // Kept inside the clear middle of the screen: below the top HUD, above the buttons, and away
    // from the mini-map and the action buttons on the right.
    const k = this.k;
    const box = { l: 80 * k, r: width - 200 * k, t: 185 * k, b: height - 110 * k };
    const bx = (box.l + box.r) / 2, by = (box.t + box.b) / 2;
    const ang = Math.atan2(o.sy - by, o.sx - bx);
    const t = Math.min((box.r - box.l) / 2 / Math.abs(Math.cos(ang) || 1e-6), (box.b - box.t) / 2 / Math.abs(Math.sin(ang) || 1e-6));
    this.objArrow.setVisible(true).setPosition(bx + Math.cos(ang) * t, by + Math.sin(ang) * t);
    (this.objArrow.list[0] as Phaser.GameObjects.Graphics).setRotation(ang);
    // The label goes on the side facing the middle of the screen.
    this.objText.setText(o.label).setPosition(-Math.cos(ang) * 34, -Math.sin(ang) * 22).setOrigin(Math.cos(ang) > 0.3 ? 1 : Math.cos(ang) < -0.3 ? 0 : 0.5, 0.5);
  }

  private layout() {
    const { width, height } = this.scale;
    // Short phone screens get a slightly smaller HUD, but not so small the text can't be read.
    const k = (this.k = height < 450 ? 0.88 : 1);
    this.statusBox.setScale(k);
    this.cycleBox.setScale(k).setPosition(width / 2, 10);
    this.questBox.setScale(k);
    this.menuBtn.setScale(k).setPosition(width - 10, 0);
    // Right column under the quest panel: mini-map, and + / − / MAP to its left.
    this.minimap.root.setScale(k);
    this.zoomBox.setScale(k);
    for (const b of [this.attackBtn, this.talkBtn, this.potionBtn, this.skillBtn, this.dodgeBtn, this.autoBtn, this.rainBtn]) b.setScale((b.baseScale = k));
    // RAIN above AUTO (clear of the mini-map).
    this.rainBtn.setPosition(width - 252 * k, height - 222 * k);
    // AUTO sits left of SKILL, above TALK.
    this.autoBtn.setPosition(width - 252 * k, height - 140 * k);
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
    this.pauseMenu.draw();
    this.bagMenu.draw();
    this.shopMenu.draw();
    this.drawQuests();
  }

  private drawStatus(s: PlayerStats) {
    const x = 10 + PORTRAIT + 30, y = 10;
    this.nameText.setText(s.name.toUpperCase());
    this.levelText.setText(`LV ${String(s.level).padStart(2, '0')}`);
    this.barLabels.setText('HP').setVisible(false);
    this.barTags.forEach((t, i) => t.setText(['HP', 'MP', 'EX'][i]));
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

  private drawCycle(c: { raiders: number; coreHp: number; coreMax: number; indoor?: string }) {
    const cy = state.cycle;
    const g = this.cycleBar.clear();
    if (c.indoor) {
      // Inside a cave or a building the day doesn't move on (and no night can be called).
      this.cycleText.setText(`${c.indoor} · DAY ${cy.day}`).setColor(COLORS.dim).setY(20);
      this.nightBtn.setVisible(false);
      return;
    }
    if (cy.phase === 'day') {
      const s = Math.max(0, Math.ceil(cy.left / 1000));
      this.cycleText.setText(`☀ DAY ${cy.day}   night in ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`).setColor(COLORS.text).setY(20);
      this.nightBtn.setVisible(!state.inMenu && !state.inDialogue);
      return;
    }
    this.nightBtn.setVisible(false);
    this.cycleText.setText(`☾ NIGHT ${cy.day}   ${c.raiders} raiders left`).setColor('#b8c4ff').setY(14);
    // Core health under the text.
    g.fillStyle(0x07080e).fillRect(-90, 28, 180, 7);
    g.fillStyle(c.coreHp / c.coreMax > 0.3 ? 0x5ad1ff : 0xff6a5a).fillRect(-89, 29, (178 * c.coreHp) / c.coreMax, 5);
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
    // One quest in the tracker (the main story first), so the panel stays small.
    const active = [...this.quests.active()].sort((a, b) => Number(b.id.startsWith('main')) - Number(a.id.startsWith('main')));
    const q = active[0];
    let lines = ['Talk to villagers'];
    if (q) {
      const n = this.quests.progress(q.id), max = q.objective.count;
      const goal = q.objective.type === 'talk' ? q.objective.label : `${q.objective.label.split('(')[0].trim()}: ${n}/${max}`;
      lines = [q.title, n >= max && q.objective.type !== 'talk' ? `${goal} ✓ report back` : goal];
      if (active.length > 1) lines.push(`+${active.length - 1} more`);
    }
    this.questText.setText(lines.join('\n'));
    const w = Math.max(190, this.questText.width + 34), h = this.questText.height + 52;
    const x = this.scale.width / this.k - w - 64; // leave room for the MENU button
    resizePanel(this.questPanel, w, h);
    this.questPanel.setPosition(x, 10);
    this.questIcon.setPosition(x + 24, 33);
    this.questTitle.setPosition(x + 42, 24);
    this.questText.setPosition(x + 18, 48);
    // The mini-map and its buttons sit just under the quest panel (never on top of it).
    const k = this.k, top = (10 + h + 8) * k, width = this.scale.width;
    this.minimap.root.setPosition(width - 10 - 66 * k, top + 66 * k);
    this.zoomBox.setPosition(width - 10 - 154 * k, top + 20 * k);
  }

  private toasts: Phaser.GameObjects.Text[] = [];
  private toast(msg: string) {
    const t = this.add
      .text(this.scale.width / 2, 150 + this.toasts.length * 34, msg, { ...text(16), backgroundColor: '#15120ee6', padding: { x: 14, y: 7 } })
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
