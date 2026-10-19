import Phaser from 'phaser';
import { text } from './theme';

/** Framed square touch button with an icon and a label; fires `onPress` on pointer down. */
export class ActionButton extends Phaser.GameObjects.Container {
  private frame: Phaser.GameObjects.NineSlice;
  /** Layout scale (smaller on short screens); the press animation is relative to it. */
  baseScale = 1;

  constructor(scene: Phaser.Scene, label: string, icon: string, size: number, onPress: () => void) {
    super(scene);
    // The frame art is drawn at 2x, so slice it at half size and scale up.
    this.frame = scene.add.nineslice(0, 0, 'ui_button', undefined, Math.round(size / 2), Math.round(size / 2), 5, 5, 5, 5).setScale(2);
    const img = scene.add.image(0, -size * 0.1, icon).setScale(Math.max(2, Math.round(size / 28)));
    const t = scene.add.text(0, size * 0.28, label, text(Math.round(size * 0.2))).setOrigin(0.5);
    this.add([this.frame, img, t]);
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
}
