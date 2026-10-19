import Phaser from 'phaser';
import { state, type PlacedBuilding } from '../core/GameState';
import { bus } from '../core/EventBus';
import { BUILDINGS, builders, costText, placeCost, timeText, type Resource } from '../systems/town/Buildings';
import { canAfford } from '../systems/town/Economy';
import { Menu } from './ItemMenus';
import { text, COLORS } from './theme';
import { spriteScale } from '../assets/sprites';

/** BUILD: every building you can place, with cost and build time. Choosing one starts placement. */
export class BuildMenu extends Menu {
  open() {
    this.show();
  }

  draw() {
    if (!this.isOpen) return;
    const t = state.town;
    const crew = builders(t.buildings);
    const { x, y, w, h, add, compact } = this.frame('SHOP', `Builders free ${crew.free}/${crew.total} · ${state.player!.gold} gold · ${t.wood} wood · ${t.stone} stone · ${t.mana} mana`);
    const s = this.scene;
    const list = Object.values(BUILDINGS).filter((d) => !d.unique);
    const rowH = compact ? 38 : 44;
    const perCol = Math.max(1, Math.floor((h - 70) / rowH));
    const colW = list.length > perCol ? (w - 36) / 2 : w - 28;
    list.forEach((d, i) => {
      const cx = x + 14 + Math.floor(i / perCol) * (colW + 8), cy = y + 50 + (i % perCol) * rowH;
      const lv = d.levels[0];
      const cost = placeCost(d, t.buildings);
      const hut = d.id === 'builder_hut';
      const ok = !!cost && canAfford(cost) && (hut || crew.free > 0);
      const info = !cost ? 'Max builders reached' : `${costText(cost)} · ${hut ? 'instant' : timeText(lv.seconds)}`;
      add(s.add.rectangle(cx, cy, colW, rowH - 4, 0x141a2c, 0.9).setOrigin(0));
      const img = add(s.add.image(cx + 20, cy + rowH - 8, d.sprites[0]).setOrigin(0.5, 1));
      img.setScale(Math.min(spriteScale(d.sprites[0]), (rowH - 8) / img.height, 34 / img.width));
      add(s.add.text(cx + 42, cy + 3, d.name, text(12)));
      add(s.add.text(cx + 42, cy + 19, info, text(10, cost && canAfford(cost) ? '#8fd18a' : '#ff8a7a')));
      this.button(add, cx + colW - 70, cy + (rowH - 32) / 2, 64, !hut && crew.free <= 0 ? 'BUSY' : 'BUILD', () => {
        this.close();
        bus.emit('build-start', d.id);
      }, ok);
    });
    add(s.add.text(x + 20, y + h - 20, 'Each builder works on one building at a time. Hit trees, rocks and crystals for wood, stone and mana.', text(11, COLORS.dim)));
  }
}

/** Info and upgrade for one placed building (opened with TALK next to it). */
export class BuildingPanel extends Menu {
  private b: PlacedBuilding | null = null;

  open(b: PlacedBuilding) {
    this.b = b;
    this.show();
  }

  draw() {
    if (!this.isOpen || !this.b) return;
    const b = this.b, def = BUILDINGS[b.type];
    const lv = def.levels[b.level - 1], next = def.levels[b.level];
    const { x, y, w, add } = this.frame(def.name.toUpperCase(), `Level ${b.level} of ${def.levels.length}`);
    const s = this.scene;
    const key = def.sprites[Math.min(b.level, def.sprites.length) - 1];
    const img = add(s.add.image(x + 80, y + 170, key).setOrigin(0.5, 1));
    img.setScale(Math.min(2, 110 / img.height, 130 / img.width));
    const lines = [def.desc, `HP ${lv.hp}`];
    if (lv.attack) lines.push(`Damage ${lv.attack.dmg} · ${lv.attack.rate} hits/s${lv.attack.range ? ` · range ${lv.attack.range}` : ''}`);
    if (lv.produces) {
      const [r, n] = Object.entries(lv.produces)[0] as [Resource, number];
      lines.push(`Makes ${n} ${r} per hour (holds up to ${lv.cap}). Walk past it to collect.`);
    }
    if (b.status !== 'idle') lines.push(`${b.status === 'building' ? 'Building' : 'Upgrading'}: ${timeText(Math.max(0, b.endsAt - Date.now()) / 1000)} left`);
    if (next) lines.push('', `Next level: ${costText(next.cost)} · ${timeText(next.seconds)}`);
    else lines.push('', 'Max level.');
    add(s.add.text(x + 170, y + 56, lines.join('\n'), { ...text(13), lineSpacing: 6, wordWrap: { width: w - 200 } }));
    if (next) {
      const ok = b.status === 'idle' && canAfford(next.cost);
      this.button(add, x + 170, y + 210, 140, b.status !== 'idle' ? 'BUSY' : 'UPGRADE', () => {
        bus.emit('building-upgrade', b);
        this.draw();
      }, ok);
    }
    if (def.id !== 'ancient_core') {
      this.button(add, x + 320, y + 210, 100, 'MOVE', () => {
        this.close();
        bus.emit('building-move', b);
      }, b.status === 'idle');
    }
  }
}

/** Bottom bar shown while placing a building: hint plus PLACE / CANCEL. */
export class PlacementBar {
  private root: Phaser.GameObjects.Container;

  constructor(private scene: Phaser.Scene) {
    this.root = scene.add.container().setDepth(60).setVisible(false);
  }

  show(name: string) {
    this.root.removeAll(true).setVisible(true);
    const s = this.scene, { width, height } = s.scale;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => (this.root.add(o), o);
    add(s.add.text(width / 2, height - 96, `Placing ${name}: walk or tap the ground. Green = OK.`, { ...text(14), backgroundColor: '#1a2034e6', padding: { x: 10, y: 6 } }).setOrigin(0.5));
    const mk = (label: string, bx: number, color: number, ev: string) => {
      const r = add(s.add.rectangle(bx, height - 44, 120, 44, color).setStrokeStyle(3, 0xf4ead0));
      add(s.add.text(bx, height - 44, label, text(16)).setOrigin(0.5));
      r.setInteractive({ useHandCursor: true }).on('pointerdown', () => bus.emit(ev));
    };
    mk('PLACE', width / 2 + 70, 0x2b7a3f, 'build-confirm');
    mk('CANCEL', width / 2 - 70, 0x8a2b2b, 'build-cancel');
  }

  hide() {
    this.root.removeAll(true).setVisible(false);
  }

  get visible() {
    return this.root.visible;
  }
}
