import Phaser from 'phaser';
import { TILE_W, TILE_H } from '../lib/iso';
import { ensureSession } from '../lib/supabase';

/**
 * Generates placeholder iso textures until real pixel art is dropped into public/assets,
 * then signs in and starts the game.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.makeTile('tile_grass', 0x4f8a3c, 0x3d6e2e);
    this.makeBlock('b_wooden_wall', 0x8a5a2b, 18);
    this.makeBlock('b_arrow_tower', 0x8c8c99, 56);
    this.makeBlock('b_lumber_mill', 0xa0703a, 30);
    this.makeBlock('b_spike_trap', 0x5a5a66, 6);
    this.makeBlock('b_town_hall', 0xc9a14a, 44);

    ensureSession()
      .then((uid) => this.registry.set('online', uid !== null))
      .catch((e) => {
        console.warn('Supabase sign-in failed, running offline', e);
        this.registry.set('online', false);
      })
      .finally(() => {
        this.scene.start('Town');
        this.scene.launch('Hud');
      });
  }

  private makeTile(key: string, fill: number, edge: number) {
    const g = this.add.graphics();
    const pts = [
      new Phaser.Math.Vector2(TILE_W / 2, 0),
      new Phaser.Math.Vector2(TILE_W, TILE_H / 2),
      new Phaser.Math.Vector2(TILE_W / 2, TILE_H),
      new Phaser.Math.Vector2(0, TILE_H / 2),
    ];
    g.fillStyle(fill).fillPoints(pts, true);
    g.lineStyle(1, edge).strokePoints(pts, true);
    g.generateTexture(key, TILE_W, TILE_H);
    g.destroy();
  }

  /** An isometric box: top diamond plus left/right faces of the given height. */
  private makeBlock(key: string, color: number, height: number) {
    const g = this.add.graphics();
    const w = TILE_W, h = TILE_H, c = Phaser.Display.Color.ValueToColor(color);
    const top = [w / 2, 0, w, h / 2, w / 2, h, 0, h / 2];
    const left = [0, h / 2, w / 2, h, w / 2, h + height, 0, h / 2 + height];
    const right = [w / 2, h, w, h / 2, w, h / 2 + height, w / 2, h + height];
    const poly = (arr: number[], col: number) => {
      const pts = [];
      for (let i = 0; i < arr.length; i += 2) pts.push(new Phaser.Math.Vector2(arr[i], arr[i + 1]));
      g.fillStyle(col).fillPoints(pts, true);
    };
    poly(left, c.clone().darken(25).color);
    poly(right, c.clone().darken(40).color);
    poly(top, c.color);
    g.generateTexture(key, w, h + height);
    g.destroy();
  }
}
