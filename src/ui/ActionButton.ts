import Phaser from 'phaser';

/** Round touch button with an icon label; fires `onPress` on pointer down. */
export class ActionButton extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, label: string, radius: number, color: number, onPress: () => void) {
    super(scene);
    const circle = scene.add.circle(0, 0, radius, color, 0.75).setStrokeStyle(3, 0xf4e9c8, 0.8);
    const text = scene.add
      .text(0, 0, label, { fontFamily: 'monospace', fontSize: `${Math.round(radius * 0.42)}px`, fontStyle: 'bold', color: '#f4e9c8' })
      .setOrigin(0.5);
    this.add([circle, text]);
    this.setSize(radius * 2, radius * 2).setDepth(10);
    circle.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      onPress();
      this.setScale(0.9);
      scene.time.delayedCall(90, () => this.setScale(1));
    });
    scene.add.existing(this);
  }
}
