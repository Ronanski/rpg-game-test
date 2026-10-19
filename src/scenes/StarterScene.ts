import Phaser from 'phaser';
import { state, resetJobs, resetEquipment, newTown, newCycle } from '../core/GameState';
import { recalcStats } from '../systems/items/Items';
import { computeStats, expToNext, RACES } from '../systems/combat/ClassSystem';
import { RACES_INFO, START_JOB, type Gender, type RaceDef } from '../systems/combat/Origins';
import { panel, text, COLORS } from '../ui/theme';
import { spriteInfo } from '../assets/sprites';
import { deleteSave } from '../core/SaveGame';

type Step = 'race' | 'gender' | 'name';
const STEPS: Step[] = ['race', 'gender', 'name'];
const GENDERS: Gender[] = ['male', 'female'];
type Add = <T extends Phaser.GameObjects.GameObject>(o: T) => T;

/**
 * Character creation: race, then gender, then a name. Everyone starts as a classless Adventurer.
 * Tap to choose; keyboard: arrows, Enter (next), Esc (back). Starting replaces any saved game
 * (the title screen already asked).
 */
export class StarterScene extends Phaser.Scene {
  private step: Step = 'race';
  private race = 0;
  private gender = 0;
  private nameIndex = 0;
  private root!: Phaser.GameObjects.Container;
  private starting = false;

  constructor() {
    super('Starter');
  }

  create() {
    this.starting = false;
    this.step = 'race';
    this.root = this.add.container();
    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));

    const kb = this.input.keyboard;
    kb?.on('keydown-LEFT', () => this.move(-1));
    kb?.on('keydown-RIGHT', () => this.move(1));
    kb?.on('keydown-A', () => this.move(-1));
    kb?.on('keydown-D', () => this.move(1));
    kb?.on('keydown-ENTER', () => this.next());
    kb?.on('keydown-SPACE', () => this.next());
    kb?.on('keydown-ESC', () => this.back());
    kb?.on('keydown-BACKSPACE', () => this.back());
  }

  private get raceDef(): RaceDef {
    return RACES_INFO[this.race];
  }

  /** Races that have art for both genders (the rest show as "coming soon"). */
  private get playable(): number[] {
    return RACES_INFO.flatMap((r, i) => (r.sprite.male && r.sprite.female ? [i] : []));
  }

  private get name(): string {
    const list = this.raceDef.names[GENDERS[this.gender]];
    return list[this.nameIndex % list.length];
  }

  private move(d: number) {
    if (this.step === 'race') {
      const ids = this.playable;
      this.race = ids[(ids.indexOf(this.race) + d + ids.length) % ids.length];
    } else if (this.step === 'gender') {
      this.gender = (this.gender + d + 2) % 2;
    } else {
      const n = this.raceDef.names[GENDERS[this.gender]].length;
      this.nameIndex = (this.nameIndex + d + n) % n;
    }
    this.layout();
  }

  private next() {
    if (this.step === 'name') return this.start();
    this.step = STEPS[STEPS.indexOf(this.step) + 1];
    if (this.step === 'name') this.nameIndex = 0;
    this.layout();
  }

  private back() {
    const i = STEPS.indexOf(this.step);
    if (i === 0) return this.scene.start('Title');
    this.step = STEPS[i - 1];
    this.layout();
  }

  private layout() {
    this.root.removeAll(true);
    const { width, height } = this.scale;
    const add: Add = (o) => (this.root.add(o), o);
    const compact = height < 420;

    add(this.add.text(width / 2, compact ? 6 : 14, 'AETHELGARD: CHRONOS OF FATE', text(compact ? 20 : 30, COLORS.gold)).setOrigin(0.5, 0));
    const stepTitle = { race: 'Step 1 of 3: Choose your race', gender: 'Step 2 of 3: Choose your gender', name: 'Step 3 of 3: Your name' }[this.step];
    add(this.add.text(width / 2, compact ? 30 : 52, stepTitle, text(compact ? 13 : 16, COLORS.dim)).setOrigin(0.5, 0));

    const top = compact ? 50 : 84;
    const bh = compact ? 40 : 48;
    const areaH = Math.min(320, height - top - bh - (compact ? 22 : 40));
    if (this.step === 'race') this.raceCards(top, areaH, add);
    else if (this.step === 'gender') this.genderCards(top, areaH, add);
    else this.nameCard(top, areaH, add);

    // Bottom buttons: BACK (to the title on step 1) | NEXT / START.
    const btnY = top + areaH + (compact ? 12 : 20) + bh / 2;
    const buttons: { label: string; color: string; gold: boolean; on: () => void }[] = [
      { label: 'BACK', color: COLORS.text, gold: false, on: () => this.back() },
      { label: this.step === 'name' ? 'START' : 'NEXT', color: COLORS.text, gold: true, on: () => this.next() },
    ];
    const bw = Math.min(250, (width - 40) / buttons.length - 12);
    const total = buttons.length * bw + (buttons.length - 1) * 16;
    buttons.forEach((b, i) => {
      const bx = (width - total) / 2 + i * (bw + 16);
      const p = add(panel(this, bx, btnY - bh / 2, bw, bh, b.gold));
      add(this.add.text(bx + bw / 2, btnY, b.label, text(15, b.color)).setOrigin(0.5));
      p.setInteractive({ useHandCursor: true }).on('pointerdown', b.on);
    });
  }

  /** Draws a sprite as big as fits in `fit` px tall, keeping square pixels. Returns its bottom y. */
  private figure(key: string, cx: number, y: number, fit: number, add: Add) {
    const info = spriteInfo(key);
    // info.scale is the sprite's base size (2 for half-size art); grow in whole steps of it.
    const scale = Math.max(1, Math.floor(fit / (info.h * info.scale))) * info.scale;
    add(this.add.image(cx, y + info.h * scale, key, 0).setOrigin(0.5, 1).setScale(scale));
    return y + info.h * scale;
  }

  private raceCards(top: number, areaH: number, add: Add) {
    const { width } = this.scale;
    const n = RACES_INFO.length, gap = 12;
    const w = Math.min(200, (width - 32 - gap * (n - 1)) / n);
    const left = (width - (w * n + gap * (n - 1))) / 2;
    RACES_INFO.forEach((r, i) => {
      const x = left + i * (w + gap);
      const open = !!(r.sprite.male && r.sprite.female);
      const on = i === this.race;
      const bg = add(panel(this, x, top, w, areaH, on));
      bg.setAlpha(open ? (on ? 1 : 0.85) : 0.45);
      if (open) bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => (on ? this.next() : ((this.race = i), this.layout())));
      const cx = x + w / 2;
      let y = top + 12;
      if (open) y = this.figure(r.sprite.male!, cx, y, Math.min(116, areaH * 0.42), add) + 8;
      else {
        add(this.add.text(cx, y + 24, '?', text(40, COLORS.dim)).setOrigin(0.5, 0));
        y += 90;
      }
      add(this.add.text(cx, y, r.name, text(18, on ? COLORS.gold : COLORS.text)).setOrigin(0.5, 0));
      y += 24;
      add(this.add.text(cx, y, open ? r.passive : 'Coming soon', text(12, open ? '#8fd18a' : COLORS.dim)).setOrigin(0.5, 0));
      y += 18;
      const b = RACES[r.id];
      if (open && top + areaH - y > 40) {
        add(this.add.text(cx, y, `HP ${b.hp}  MP ${b.mp}\nATK ${b.atk} DEF ${b.def} SPD ${b.spd}`, { ...text(11), align: 'center', lineSpacing: 2 }).setOrigin(0.5, 0));
        y += 34;
      }
      if (open && top + areaH - y > 30) {
        add(this.add.text(cx, y, r.blurb, { ...text(11, COLORS.dim), align: 'center', wordWrap: { width: w - 16 } }).setOrigin(0.5, 0));
      }
    });
  }

  private genderCards(top: number, areaH: number, add: Add) {
    const { width } = this.scale;
    const w = Math.min(220, (width - 60) / 2), gap = 24;
    const left = (width - (w * 2 + gap)) / 2;
    GENDERS.forEach((g, i) => {
      const x = left + i * (w + gap);
      const on = i === this.gender;
      const bg = add(panel(this, x, top, w, areaH, on));
      if (!on) bg.setAlpha(0.85);
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => (on ? this.next() : ((this.gender = i), this.layout())));
      const y = this.figure(this.raceDef.sprite[g]!, x + w / 2, top + 14, Math.min(130, areaH - 60), add);
      add(this.add.text(x + w / 2, y + 10, g === 'male' ? 'Male' : 'Female', text(20, on ? COLORS.gold : COLORS.text)).setOrigin(0.5, 0));
    });
  }

  private nameCard(top: number, areaH: number, add: Add) {
    const { width } = this.scale;
    const w = Math.min(560, width - 40), x = (width - w) / 2;
    add(panel(this, x, top, w, areaH, true));
    const r = this.raceDef, g = GENDERS[this.gender];
    this.figure(r.sprite[g]!, x + Math.min(100, w * 0.2), top + 14, Math.min(140, areaH - 28), add);

    const tx = x + Math.min(210, w * 0.4), midY = top + areaH * 0.28;
    // The name, with arrows to pick another suggestion.
    const arrow = (label: string, ax: number, d: number) => {
      const a = add(this.add.text(ax, midY, label, text(26, COLORS.gold)).setOrigin(0.5));
      a.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.move(d));
    };
    const right = x + w - 28;
    arrow('◀', tx, -1);
    arrow('▶', right, 1);
    add(this.add.text((tx + right) / 2, midY, this.name, text(30)).setOrigin(0.5));
    add(this.add.text((tx + right) / 2, midY + 28, 'tap the arrows for another name', text(11, COLORS.dim)).setOrigin(0.5));

    const st = computeStats(r.id, START_JOB, 1);
    add(this.add.text(tx - 14, midY + 50, [
      `${r.name} ${g === 'male' ? 'Male' : 'Female'}  ·  Adventurer`,
      `Passive: ${r.passive}`,
      `HP ${st.hp}  MP ${st.mp}  ATK ${st.atk}  DEF ${st.def}  SPD ${st.spd}`,
      'Jobs are earned as you play.',
    ].join('\n'), { ...text(13), lineSpacing: 6 }));
  }

  private start() {
    if (this.starting) return;
    deleteSave();
    this.starting = true;
    const r = this.raceDef, g = GENDERS[this.gender];
    const st = computeStats(r.id, START_JOB, 1);
    state.player = {
      name: this.name, gender: g, raceId: r.id, jobId: START_JOB, texture: r.sprite[g]!,
      level: 1, exp: 0, expToNext: expToNext(1),
      hp: st.hp, maxHp: st.hp, mp: st.mp, maxMp: st.mp, atk: st.atk, def: st.def, spd: st.spd, gold: 0,
    };
    state.inventory.clear();
    state.inventory.set('health_potion', 3);
    state.storyFlags.clear();
    resetJobs();
    resetEquipment();
    state.town = newTown();
    state.cycle = newCycle();
    // Start with the weapon the character's art is holding.
    state.equipment.weapon = r.weapon[g] ?? 'rusty_sword';
    recalcStats(true);
    this.cameras.main.fadeOut(250);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('World'));
  }
}
