import Phaser from 'phaser';
import { api } from '../services/api';
import { state } from '../core/GameState';
import { computeStats, expToNext, JOBS } from '../systems/combat/ClassSystem';
import { STARTERS, type StarterDef } from '../systems/combat/Starters';

const FONT = { fontFamily: 'monospace', color: '#f4e9c8' };

/** Pick the starting hero (race, faction, origin). Tap a card, then START. Keyboard: arrows + Enter. */
export class StarterScene extends Phaser.Scene {
  private selected = 0;
  private root!: Phaser.GameObjects.Container;
  private starting = false;

  constructor() {
    super('Starter');
  }

  create() {
    this.starting = false;
    this.root = this.add.container();
    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));

    const kb = this.input.keyboard;
    kb?.on('keydown-LEFT', () => this.select((this.selected + STARTERS.length - 1) % STARTERS.length));
    kb?.on('keydown-RIGHT', () => this.select((this.selected + 1) % STARTERS.length));
    kb?.on('keydown-A', () => this.select((this.selected + STARTERS.length - 1) % STARTERS.length));
    kb?.on('keydown-D', () => this.select((this.selected + 1) % STARTERS.length));
    kb?.on('keydown-ENTER', () => this.confirm());
    kb?.on('keydown-SPACE', () => this.confirm());
  }

  private select(i: number) {
    this.selected = i;
    this.layout();
  }

  private layout() {
    this.root.removeAll(true);
    const { width, height } = this.scale;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => (this.root.add(o), o);

    const compact = height < 420;
    add(this.add.text(width / 2, compact ? 14 : 28, 'CHOOSE YOUR HERO', { ...FONT, fontSize: compact ? '20px' : '26px', fontStyle: 'bold', color: '#ffd75e' }).setOrigin(0.5, 0));

    const gap = 16;
    const cardW = Math.min(240, (width - 40 - gap * 2) / 3);
    const top = compact ? 48 : 76;
    const cardH = Math.min(260, height - top - (compact ? 64 : 90));
    const left = (width - (cardW * 3 + gap * 2)) / 2;
    STARTERS.forEach((s, i) => this.card(s, i, left + i * (cardW + gap), top, cardW, cardH, add));

    const btnY = top + cardH + (compact ? 30 : 44);
    const btn = add(this.add.rectangle(width / 2, btnY, 200, compact ? 38 : 46, 0x8a2b2b).setStrokeStyle(3, 0xc9a14a));
    add(this.add.text(width / 2, btnY, `START AS ${STARTERS[this.selected].name.toUpperCase()}`, { ...FONT, fontSize: '16px', fontStyle: 'bold' }).setOrigin(0.5));
    btn.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.confirm());
  }

  private card(
    s: StarterDef, i: number, x: number, y: number, w: number, h: number,
    add: <T extends Phaser.GameObjects.GameObject>(o: T) => T,
  ) {
    const on = i === this.selected;
    const bg = add(this.add.rectangle(x, y, w, h, on ? 0x241e40 : 0x15122a, 0.95).setOrigin(0).setStrokeStyle(on ? 3 : 2, on ? 0xffd75e : 0x6a5a8a));
    bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => (on ? this.confirm() : this.select(i)));

    const small = w < 190 || h < 260;
    const spriteScale = small ? 3 : 4;
    const cx = x + w / 2;
    let cy = y + 10;
    add(this.add.image(cx, cy + 6 + 16 * spriteScale, 'shadow').setScale(spriteScale / 3));
    add(this.add.image(cx, cy + 6 + 16 * spriteScale, s.texture).setOrigin(0.5, 1).setScale(spriteScale));
    cy += 16 * spriteScale + 14;

    const race = s.raceId[0].toUpperCase() + s.raceId.slice(1);
    add(this.add.text(cx, cy, s.name, { ...FONT, fontSize: small ? '16px' : '19px', fontStyle: 'bold' }).setOrigin(0.5, 0));
    cy += small ? 20 : 24;
    add(this.add.text(cx, cy, `${race} ${JOBS[s.jobId].name}`, { ...FONT, fontSize: '12px', color: '#c9bfa0' }).setOrigin(0.5, 0));
    cy += 16;
    add(this.add.text(cx, cy, s.faction, { ...FONT, fontSize: '12px', color: '#' + s.factionColor.toString(16).padStart(6, '0') }).setOrigin(0.5, 0));
    cy += 20;

    const st = computeStats(s.raceId, s.jobId, 1);
    add(this.add.text(cx, cy, `HP ${st.hp}  MP ${st.mp}\nATK ${st.atk}  DEF ${st.def}  SPD ${st.spd}`, { ...FONT, fontSize: '11px', align: 'center', lineSpacing: 2 }).setOrigin(0.5, 0));
    cy += 34;

    if (y + h - cy > 28) {
      add(this.add.text(cx, cy, s.backstory, { ...FONT, fontSize: '11px', color: '#c9bfa0', align: 'center', wordWrap: { width: w - 20 } })
        .setOrigin(0.5, 0)
        .setFontStyle('italic'));
    }
  }

  private async confirm() {
    if (this.starting) return;
    this.starting = true;
    const s = STARTERS[this.selected];
    const st = computeStats(s.raceId, s.jobId, 1);
    state.player = {
      name: s.name, starterId: s.id, raceId: s.raceId, jobId: s.jobId, texture: s.texture,
      level: 1, exp: 0, expToNext: expToNext(1),
      hp: st.hp, maxHp: st.hp, mp: st.mp, maxMp: st.mp, atk: st.atk, def: st.def, spd: st.spd, gold: 0,
    };
    state.inventory.clear();
    state.inventory.set('health_potion', 3);
    if (state.online) await api.chooseStarter(s.id).catch((e) => console.warn('chooseStarter', e));
    this.cameras.main.fadeOut(250);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('World'));
  }
}
