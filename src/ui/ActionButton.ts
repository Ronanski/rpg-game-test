import Phaser from 'phaser';
import { text } from './theme';
import { spriteScale } from '../assets/sprites';

/** Framed square touch button with an icon and a label; fires `onPress` on pointer down. */
export class ActionButton extends Phaser.GameObjects.Container {
  private frame: Phaser.GameObjects.NineSlice;
  /** Layout scale (smaller on short screens); the press animation is relative to it. */
  baseScale = 1;
  private shade: Phaser.GameObjects.Rectangle;
  private size: number;
  private labelText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, label: string, icon: string, size: number, onPress: () => void) {
    super(scene);
    this.size = size;
    // The frame art is drawn at 2x, so slice it at half size and scale up.
    this.frame = scene.add.nineslice(0, 0, 'ui_button', undefined, Math.round(size / 2), Math.round(size / 2), 5, 5, 5, 5).setScale(2);
    // Every icon fills the same box (46% of the button), whatever its source size: the owner's
    // painted icons are scaled smoothly; small code-drawn pixel icons by whole steps (crisp pixels).
    const img = scene.add.image(0, -size * 0.1, icon);
    const box = size * 0.46, fit = box / Math.max(img.width, img.height, 1);
    img.setScale(spriteScale(icon) > 1 ? Math.max(1, Math.round(fit)) : fit);
    const t = (this.labelText = scene.add.text(0, size * 0.28, label, text(Math.round(size * 0.2))).setOrigin(0.5));
    // Cooldown shade: covers the button from the top while a move recharges (see setCooldown).
    this.shade = scene.add.rectangle(0, size / 2, size - 8, 0, 0x07080e, 0.6).setOrigin(0.5, 1);
    this.add([this.frame, img, t, this.shade]);
    this.setSize(size, size).setDepth(10);
    this.frame.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      onPress();
      this.frame.setTexture('ui_button_down');
      this.setScale(this.baseScale * 0.93);
      scene.time.delayedCall(110, () => {
        this.frame.setTexture('ui_button');
        this.setScale(this.baseScale);
      });
    });
    scene.add.existing(this);
  }

  /** Toggle look: a gold label when on. */
  setOn(on: boolean, label: string) {
    this.labelText.setText(label).setColor(on ? '#8fd18a' : '#f4ead0');
    this.frame.setTint(on ? 0xc8ffc0 : 0xffffff);
  }

  /** 0 = ready, 1 = just used. */
  setCooldown(frac: number) {
    this.shade.height = (this.size - 8) * Phaser.Math.Clamp(frac, 0, 1);
  }
}
