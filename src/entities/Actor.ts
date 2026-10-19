import Phaser from 'phaser';
import { spriteInfo } from '../assets/sprites';

/**
 * Anything that stands in the iso world: a pixel sprite with a ground shadow,
 * depth-sorted by its feet position (screen y).
 */
export class Actor {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly shadow: Phaser.GameObjects.Image;
  readonly baseScale: number;
  x: number;
  y: number;
  protected bob = 0;

  constructor(protected scene: Phaser.Scene, x: number, y: number, texture: string) {
    this.x = x;
    this.y = y;
    const info = spriteInfo(texture);
    this.baseScale = info.scale;
    // Art cut from the sheets already has its own soft shadow baked in.
    this.shadow = scene.add.image(x, y, 'shadow').setDepth(-99998).setVisible(!info.imported);
    this.sprite = scene.add.sprite(x, y, texture, 0).setOrigin(0.5, 1).setScale(info.scale);
    this.sync();
  }

  protected sync() {
    this.sprite.setPosition(this.x, this.y + 2 - Math.abs(Math.sin(this.bob)) * 3);
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
