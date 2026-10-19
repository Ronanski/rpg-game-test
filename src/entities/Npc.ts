import Phaser from 'phaser';
import { Actor } from './Actor';
import { FONT } from '../ui/theme';
import type { NpcDef } from '../world/worldData';

export class Npc extends Actor {
  readonly label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, readonly def: NpcDef) {
    super(scene, x, y, def.texture);
    this.label = scene.add
      .text(x, y - this.sprite.displayHeight - 4, def.name, { fontFamily: FONT, fontSize: '12px', color: '#f4e9c8', stroke: '#000', strokeThickness: 3 })
      .setOrigin(0.5, 1)
      .setDepth(100000);
    // Idle breathing.
    scene.tweens.add({ targets: this.sprite, scaleY: this.baseScale * 1.025, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  face(x: number) {
    this.sprite.setFlipX(x < this.x);
  }
}
