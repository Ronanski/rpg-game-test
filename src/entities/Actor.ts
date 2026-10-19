import Phaser from 'phaser';

/**
 * Anything that stands in the iso world: a pixel sprite with a ground shadow,
 * depth-sorted by its feet position (screen y).
 */
export class Actor {
  readonly sprite: Phaser.GameObjects.Image;
  readonly shadow: Phaser.GameObjects.Image;
  x: number;
  y: number;
  protected bob = 0;

  constructor(protected scene: Phaser.Scene, x: number, y: number, texture: string, scale = 3) {
    this.x = x;
    this.y = y;
    this.shadow = scene.add.image(x, y, 'shadow').setDepth(-99998).setScale(scale / 3);
    this.sprite = scene.add.image(x, y, texture).setOrigin(0.5, 1).setScale(scale);
    this.sync();
  }

  protected sync() {
    this.sprite.setPosition(this.x, this.y - Math.abs(Math.sin(this.bob)) * 3);
    this.sprite.setDepth(this.y);
    this.shadow.setPosition(this.x, this.y);
  }

  distanceTo(o: { x: number; y: number }) {
    return Phaser.Math.Distance.Between(this.x, this.y, o.x, o.y);
  }

  destroy() {
    this.sprite.destroy();
    this.shadow.destroy();
  }
}
