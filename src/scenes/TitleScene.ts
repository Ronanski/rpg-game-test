import Phaser from 'phaser';
import { panel, text, COLORS } from '../ui/theme';
import { applySave, loadSave, type SaveData } from '../core/SaveGame';

/**
 * Main menu shown at launch and after "Quit to title": CONTINUE the saved game (if there is one)
 * or start a NEW GAME (which asks before replacing a save). Keyboard: C / N, Enter = first button.
 */
export class TitleScene extends Phaser.Scene {
  private save: SaveData | null = null;
  private confirmNew = false;
  private root!: Phaser.GameObjects.Container;

  constructor() {
    super('Title');
  }

  create() {
    this.save = loadSave();
    this.confirmNew = false;
    this.root = this.add.container();
    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));
    const kb = this.input.keyboard;
    kb?.on('keydown-C', () => this.continueGame());
    kb?.on('keydown-N', () => this.newGame());
    kb?.on('keydown-ENTER', () => (this.save ? this.continueGame() : this.newGame()));
  }

  private layout() {
    this.root.removeAll(true);
    const { width, height } = this.scale;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => (this.root.add(o), o);
    const compact = height < 420;
    // Backdrop: the hero art over a dark vignette.
    add(this.add.image(width / 2, height + 10, 'b_core').setOrigin(0.5, 1).setScale(compact ? 1.4 : 2).setAlpha(0.18));
    add(this.add.text(width / 2, height * (compact ? 0.12 : 0.16), 'AETHELGARD', text(compact ? 40 : 58, COLORS.gold)).setOrigin(0.5));
    add(this.add.text(width / 2, height * (compact ? 0.12 : 0.16) + (compact ? 34 : 46), 'CHRONOS OF FATE', text(compact ? 16 : 22, COLORS.text)).setOrigin(0.5));

    const bw = Math.min(320, width - 40), bh = compact ? 44 : 54;
    let y = height * (compact ? 0.42 : 0.44);
    const button = (label: string, sub: string, gold: boolean, color: string, on: () => void) => {
      const x = (width - bw) / 2;
      const b = add(panel(this, x, y, bw, bh, gold));
      add(this.add.text(width / 2, y + bh / 2 - (sub ? 8 : 0), label, text(compact ? 18 : 20, color)).setOrigin(0.5));
      if (sub) add(this.add.text(width / 2, y + bh / 2 + 12, sub, text(12, COLORS.dim)).setOrigin(0.5));
      b.setInteractive({ useHandCursor: true }).on('pointerdown', on);
      y += bh + 12;
    };
    if (this.save) {
      const p = this.save.player;
      const day = this.save.cycle?.day ?? 1;
      button('CONTINUE', `${p.name} · Level ${p.level} · Day ${day}`, true, COLORS.gold, () => this.continueGame());
    }
    button(
      this.confirmNew ? 'TAP AGAIN TO START OVER' : 'NEW GAME',
      this.confirmNew ? 'Your saved game will be replaced' : '',
      !this.save, this.confirmNew ? '#ff8a7a' : COLORS.text,
      () => this.newGame(),
    );
    add(this.add.text(width / 2, height - 14, 'Progress is saved on this device.', text(11, COLORS.dim)).setOrigin(0.5, 1));
  }

  private continueGame() {
    if (!this.save) return;
    applySave(this.save);
    const save = this.save;
    this.cameras.main.fadeOut(250);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('World', { save }));
  }

  private newGame() {
    if (this.save && !this.confirmNew) {
      this.confirmNew = true;
      this.layout();
      return;
    }
    this.scene.start('Starter');
  }
}
