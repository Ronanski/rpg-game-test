import Phaser from 'phaser';
import { spriteInfo } from '../assets/sprites';
import { sunShadow } from '../iso/IsoMap';

/**
 * Anything that stands in the iso world: a pixel sprite with a ground shadow,
 * depth-sorted by its feet position (screen y).
 */
export class Actor {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly shadow: Phaser.GameObjects.Image;
  /** Long sun shadow: the sprite's own frame laid on the ground (see IsoMap.sunShadow). */
  readonly longShadow: Phaser.GameObjects.Image;
  baseScale: number;
  x: number;
  y: number;
  protected bob = 0;

  constructor(protected scene: Phaser.Scene, x: number, y: number, texture: string) {
    this.x = x;
    this.y = y;
    const info = spriteInfo(texture);
    this.baseScale = info.scale;
    // Art cut from the sheets already has its own soft shadow baked in (animated monsters don't).
    this.shadow = scene.add.image(x, y, 'shadow').setDepth(-99998).setVisible(!info.imported || !!info.manim);
    this.sprite = scene.add.sprite(x, y, texture, 0).setOrigin(0.5, 1).setScale(info.scale);
    this.longShadow = sunShadow(scene, x, y, texture, 0, info.scale, false);
    this.sync();
  }

  protected sync() {
    this.sprite.setPosition(this.x, this.y + 2 - Math.abs(Math.sin(this.bob)) * 3);
    this.sprite.setDepth(this.y);
    this.shadow.setPosition(this.x, this.y);
    const s = this.sprite, ls = this.longShadow;
    ls.setPosition(this.x, this.y).setVisible(s.visible).setAlpha(0.26 * s.alpha);
    if (ls.texture !== s.texture || ls.frame.name !== s.frame.name) ls.setTexture(s.texture.key, s.frame.name);
    ls.setScale(s.scaleX * (s.flipX ? -1 : 1), -Math.abs(s.scaleY) * 0.5);
  }

  distanceTo(o: { x: number; y: number }) {
    return Phaser.Math.Distance.Between(this.x, this.y, o.x, o.y);
  }

  destroy() {
    this.sprite.destroy();
    this.shadow.destroy();
    this.longShadow.destroy();
  }
}
