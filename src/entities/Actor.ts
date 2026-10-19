import Phaser from 'phaser';
import { ART_SCALE, anchorOf } from '../assets/art';

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

  constructor(protected scene: Phaser.Scene, x: number, y: number, texture: string) {
    this.x = x;
    this.y = y;
    this.shadow = scene.add.image(x, y, 'shadow').setDepth(-99998).setScale(ART_SCALE);
    const a = anchorOf(texture);
    this.sprite = scene.add.image(x, y, texture).setOrigin(a.x, a.y).setScale(ART_SCALE);
    this.sync();
  }

  protected setTexture(key: string) {
    if (this.sprite.texture.key !== key) this.sprite.setTexture(key);
  }

  protected sync() {
    this.sprite.setPosition(Math.round(this.x), Math.round(this.y - Math.abs(Math.sin(this.bob)) * 2));
    this.sprite.setDepth(this.y);
    this.shadow.setPosition(Math.round(this.x), Math.round(this.y));
  }

  distanceTo(o: { x: number; y: number }) {
    return Phaser.Math.Distance.Between(this.x, this.y, o.x, o.y);
  }

  destroy() {
    this.sprite.destroy();
    this.shadow.destroy();
  }
}
