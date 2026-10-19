import Phaser from 'phaser';
import { api } from '../services/api';
import { state } from '../core/GameState';
import { computeStats, expToNext, JOBS } from '../systems/combat/ClassSystem';
import { STARTERS, type StarterDef } from '../systems/combat/Starters';
import { panel, text, COLORS } from '../ui/theme';
import { spriteInfo } from '../assets/sprites';

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
    add(this.add.text(width / 2, compact ? 6 : 14, 'AETHELGARD: CHRONOS OF FATE', text(compact ? 20 : 30, COLORS.gold)).setOrigin(0.5, 0));
    add(this.add.text(width / 2, compact ? 30 : 52, 'Choose your hero', text(compact ? 13 : 16, COLORS.dim)).setOrigin(0.5, 0));

    const gap = 16;
    const cardW = Math.min(240, (width - 40 - gap * 2) / 3);
    const top = compact ? 50 : 84;
    const cardH = Math.min(300, height - top - (compact ? 64 : 90));
    const left = (width - (cardW * 3 + gap * 2)) / 2;
    STARTERS.forEach((s, i) => this.card(s, i, left + i * (cardW + gap), top, cardW, cardH, add));

    const btnY = top + cardH + (compact ? 30 : 44);
    const bw = 240, bh = compact ? 40 : 48;
    const btn = add(panel(this, width / 2 - bw / 2, btnY - bh / 2, bw, bh, true));
    add(this.add.text(width / 2, btnY, `START AS ${STARTERS[this.selected].name.toUpperCase()}`, text(18)).setOrigin(0.5));
    btn.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.confirm());
  }

  private card(
    s: StarterDef, i: number, x: number, y: number, w: number, h: number,
    add: <T extends Phaser.GameObjects.GameObject>(o: T) => T,
  ) {
    const on = i === this.selected;
    const bg = add(panel(this, x, y, w, h, on));
    if (!on) bg.setAlpha(0.85);
    bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => (on ? this.confirm() : this.select(i)));

    const small = w < 190 || h < 330;
    const cx = x + w / 2;
    let cy = y + 14;
    // Hero sprite, as big as fits while keeping square pixels.
    const info = spriteInfo(s.texture);
    const fit = small ? 96 : 130;
    const scale = Math.max(1, Math.floor(fit / info.h)) * info.scale;
    add(this.add.image(cx, cy + info.h * scale, s.texture, 0).setOrigin(0.5, 1).setScale(scale));
    cy += info.h * scale + 8;

    const race = s.raceId[0].toUpperCase() + s.raceId.slice(1);
    add(this.add.text(cx, cy, s.name, text(small ? 18 : 22, on ? COLORS.gold : COLORS.text)).setOrigin(0.5, 0));
    cy += small ? 22 : 28;
    add(this.add.text(cx, cy, `${race} ${JOBS[s.jobId].name}`, text(13, COLORS.dim)).setOrigin(0.5, 0));
    cy += 17;
    add(this.add.text(cx, cy, s.faction, text(13, '#' + s.factionColor.toString(16).padStart(6, '0'))).setOrigin(0.5, 0));
    cy += 21;

    const st = computeStats(s.raceId, s.jobId, 1);
    add(this.add.text(cx, cy, `HP ${st.hp}  MP ${st.mp}\nATK ${st.atk}  DEF ${st.def}  SPD ${st.spd}`, { ...text(12), align: 'center', lineSpacing: 2 }).setOrigin(0.5, 0));
    cy += 36;

    if (y + h - cy > 30) {
      add(this.add.text(cx, cy, s.backstory, { ...text(12, COLORS.dim), align: 'center', wordWrap: { width: w - 24 } }).setOrigin(0.5, 0));
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
