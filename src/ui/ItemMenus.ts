import Phaser from 'phaser';
import { state, emitStats, addItem } from '../core/GameState';
import { bus } from '../core/EventBus';
import { ITEMS, canEquip, equip, unequip, type Slot } from '../systems/items/Items';
import { panel, text, COLORS } from './theme';
import { spriteScale } from '../assets/sprites';

export type Add = <T extends Phaser.GameObjects.GameObject>(o: T) => T;

/** Shared frame for full-screen item menus: dark backdrop, framed panel, title, close button. */
export abstract class Menu {
  protected root: Phaser.GameObjects.Container;
  private shade: Phaser.GameObjects.Rectangle;

  constructor(protected scene: Phaser.Scene, private onClose: () => void) {
    this.shade = scene.add.rectangle(0, 0, 10, 10, 0x07080e, 0.7).setOrigin(0).setDepth(70).setInteractive();
    this.root = scene.add.container().setDepth(71);
    this.hide();
  }

  get isOpen() {
    return this.root.visible;
  }

  protected show() {
    state.inMenu = true;
    this.shade.setVisible(true);
    this.root.setVisible(true);
    this.draw();
  }

  close() {
    this.hide();
    this.onClose();
  }

  private hide() {
    state.inMenu = false;
    this.shade.setVisible(false);
    this.root.setVisible(false).removeAll(true);
  }

  /** Draws the frame and returns the content box. */
  protected frame(title: string, subtitle: string): { x: number; y: number; w: number; h: number; add: Add; compact: boolean } {
    const s = this.scene, { width, height } = s.scale;
    this.shade.setSize(width, height);
    this.root.removeAll(true);
    const add: Add = (o) => (this.root.add(o), o);
    const w = Math.min(680, width - 24), h = Math.min(420, height - 16);
    const x = (width - w) / 2, y = (height - h) / 2;
    add(panel(s, x, y, w, h, true));
    add(s.add.text(x + 20, y + 14, title, text(20, COLORS.gold)));
    add(s.add.text(x + 20 + title.length * 13 + 16, y + 18, subtitle, text(12, COLORS.dim)));
    const c = add(s.add.text(x + w - 18, y + 12, '✕', text(22)).setOrigin(1, 0));
    c.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.close());
    return { x, y, w, h, add, compact: height < 450 };
  }

  /** A small framed button. */
  protected button(add: Add, x: number, y: number, w: number, label: string, onPress: () => void, enabled = true) {
    const b = add(panel(this.scene, x, y, w, 28));
    add(this.scene.add.text(x + w / 2, y + 14, label, text(12, enabled ? COLORS.text : COLORS.dim)).setOrigin(0.5));
    if (enabled) b.setInteractive({ useHandCursor: true }).on('pointerdown', onPress);
    else b.setAlpha(0.5);
  }

  /** Item icon scaled to fit `size` px. */
  protected icon(add: Add, id: string, x: number, y: number, size: number) {
    const it = ITEMS[id];
    const img = add(this.scene.add.image(x, y, it.icon));
    // Code-drawn icons are half size (sprite scale 2); never show them smaller than that.
    img.setScale(Math.max(spriteScale(it.icon), Math.floor(size / Math.max(img.width, img.height))));
    if (it.tint) img.setTint(it.tint);
  }

  abstract draw(): void;
}

const SLOTS: { slot: Slot; label: string }[] = [
  { slot: 'weapon', label: 'Weapon' },
  { slot: 'armor', label: 'Armor' },
  { slot: 'accessory', label: 'Accessory' },
];

/** BAG: what you wear (left) and everything you carry (right). Equip, unequip, or drink potions. */
export class InventoryMenu extends Menu {
  open() {
    this.show();
  }

  draw() {
    if (!this.isOpen) return;
    const { x, y, w, h, add, compact } = this.frame('BAG', `${state.player!.gold} gold`);
    const s = this.scene, ps = state.player!;
    const leftW = Math.min(230, w * 0.38);
    // Equipped items and stats.
    let ly = y + 50;
    for (const { slot, label } of SLOTS) {
      const id = state.equipment[slot];
      add(s.add.rectangle(x + 14, ly, leftW - 10, 40, 0x141a2c, 0.9).setOrigin(0));
      add(s.add.text(x + 22, ly + 4, label, text(10, COLORS.dim)));
      if (id) {
        this.icon(add, id, x + 36, ly + 24, 22);
        add(s.add.text(x + 52, ly + 17, ITEMS[id].name, text(12)));
        this.button(add, x + leftW - 64, ly + 6, 54, 'OFF', () => (unequip(slot), this.draw()));
      } else add(s.add.text(x + 22, ly + 18, 'empty', text(12, COLORS.dim)));
      ly += 46;
    }
    add(s.add.text(x + 22, ly + 4, [
      `HP ${ps.maxHp}   MP ${ps.maxMp}`,
      `ATK ${ps.atk}   DEF ${ps.def}   SPD ${ps.spd}`,
    ].join('\n'), { ...text(13), lineSpacing: 6 }));

    // Carried items.
    const items = [...state.inventory.entries()].filter(([id, n]) => n > 0 && ITEMS[id]);
    const gx = x + leftW + 14, gw = w - leftW - 28;
    const rowH = compact ? 36 : 42;
    const perCol = Math.max(1, Math.floor((h - 62) / rowH));
    const colW = items.length > perCol ? gw / 2 - 4 : gw;
    if (!items.length) add(s.add.text(gx, y + 56, 'Your bag is empty.', text(13, COLORS.dim)));
    items.forEach(([id, n], i) => {
      const cx = gx + Math.floor(i / perCol) * (colW + 8), cy = y + 50 + (i % perCol) * rowH;
      if (Math.floor(i / perCol) > 1) return;
      const it = ITEMS[id];
      add(s.add.rectangle(cx, cy, colW, rowH - 4, 0x141a2c, 0.9).setOrigin(0));
      this.icon(add, id, cx + 18, cy + (rowH - 4) / 2, 22);
      add(s.add.text(cx + 36, cy + 4, `${it.name}${n > 1 ? `  x${n}` : ''}`, text(12)));
      const info = it.stats ? Object.entries(it.stats).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(' ') : it.desc;
      add(s.add.text(cx + 36, cy + 19, info, { ...text(10, COLORS.dim), wordWrap: { width: colW - 110 } }));
      if (it.type === 'consumable') this.button(add, cx + colW - 66, cy + (rowH - 32) / 2, 60, 'USE', () => (bus.emit('use-item', id), this.draw()));
      else if (it.type !== 'material') {
        const ok = canEquip(id);
        this.button(add, cx + colW - 66, cy + (rowH - 32) / 2, 60, ok ? 'EQUIP' : 'LOCKED', () => (equip(id), this.draw()), ok);
      }
    });
  }
}

export interface ShopDef {
  name: string;
  sells: string[];
}

/** A shop: buy from the shopkeeper's list, or sell what you carry (not what you wear). */
export class ShopMenu extends Menu {
  private shop: ShopDef = { name: '', sells: [] };
  private tab: 'buy' | 'sell' = 'buy';

  open(shop: ShopDef) {
    this.shop = shop;
    this.tab = 'buy';
    this.show();
  }

  draw() {
    if (!this.isOpen) return;
    const { x, y, w, h, add, compact } = this.frame(this.shop.name.toUpperCase(), `${state.player!.gold} gold`);
    const s = this.scene;
    // Tabs.
    (['buy', 'sell'] as const).forEach((t, i) => {
      const tx = x + w - 230 + i * 92;
      const b = add(panel(s, tx, y + 12, 84, 28, this.tab === t));
      add(s.add.text(tx + 42, y + 26, t.toUpperCase(), text(13, this.tab === t ? COLORS.gold : COLORS.text)).setOrigin(0.5));
      b.setInteractive({ useHandCursor: true }).on('pointerdown', () => ((this.tab = t), this.draw()));
    });

    const rows = this.tab === 'buy'
      ? this.shop.sells.map((id) => ({ id, price: ITEMS[id].buy ?? 0, have: state.inventory.get(id) ?? 0 }))
      : [...state.inventory.entries()].filter(([id, n]) => n > 0 && ITEMS[id]).map(([id, n]) => ({ id, price: ITEMS[id].sell, have: n }));
    const rowH = compact ? 38 : 44;
    const perCol = Math.max(1, Math.floor((h - 62) / rowH));
    const colW = rows.length > perCol ? (w - 36) / 2 : w - 28;
    if (!rows.length) add(s.add.text(x + 22, y + 60, 'Nothing to sell.', text(13, COLORS.dim)));
    rows.forEach(({ id, price, have }, i) => {
      if (i >= perCol * 2) return;
      const it = ITEMS[id];
      const cx = x + 14 + Math.floor(i / perCol) * (colW + 8), cy = y + 52 + (i % perCol) * rowH;
      add(s.add.rectangle(cx, cy, colW, rowH - 4, 0x141a2c, 0.9).setOrigin(0));
      this.icon(add, id, cx + 18, cy + (rowH - 4) / 2, 22);
      add(s.add.text(cx + 36, cy + 4, it.name, text(12)));
      add(s.add.text(cx + 36, cy + 20, `${it.desc}  (have ${have})`, { ...text(10, COLORS.dim), wordWrap: { width: colW - 150 } }));
      const label = `${this.tab === 'buy' ? 'BUY' : 'SELL'} ${price}g`;
      const enabled = this.tab === 'buy' ? state.player!.gold >= price : true;
      this.button(add, cx + colW - 96, cy + (rowH - 32) / 2, 90, label, () => (this.tab === 'buy' ? this.buy(id, price) : this.sell(id, price)), enabled);
    });
  }

  private buy(id: string, price: number) {
    const ps = state.player!;
    if (ps.gold < price) return bus.emit('toast', 'Not enough gold');
    ps.gold -= price;
    addItem(id, 1);
    emitStats();
    this.draw();
  }

  private sell(id: string, price: number) {
    if ((state.inventory.get(id) ?? 0) <= 0) return;
    addItem(id, -1);
    state.player!.gold += price;
    emitStats();
    this.draw();
  }
}

/** MENU: resume, or save and quit to the title screen. */
export class PauseMenu extends Menu {
  constructor(scene: Phaser.Scene, onClose: () => void, private onQuit: () => void) {
    super(scene, onClose);
  }

  open() {
    this.show();
  }

  draw() {
    if (!this.isOpen) return;
    const s = this.scene, { width, height } = s.scale;
    const { add } = this.frame('MENU', `Day ${state.cycle.day}`);
    const bw = 260, x = (width - bw) / 2;
    let y = height / 2 - 50;
    const big = (label: string, on: () => void, gold = false) => {
      const b = add(panel(s, x, y, bw, 46, gold));
      add(s.add.text(width / 2, y + 23, label, text(17, gold ? COLORS.gold : COLORS.text)).setOrigin(0.5));
      b.setInteractive({ useHandCursor: true }).on('pointerdown', on);
      y += 58;
    };
    big('RESUME', () => this.close(), true);
    big('SAVE & QUIT TO TITLE', () => this.onQuit());
    add(s.add.text(width / 2, y + 6, 'Your game also saves by itself every few seconds.', text(11, COLORS.dim)).setOrigin(0.5));
  }
}
