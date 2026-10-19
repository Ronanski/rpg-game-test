import Phaser from 'phaser';
import { createTextures } from '../assets/textures';
import { loadSprites } from '../assets/sprites';
import { text } from '../ui/theme';
import { ensureSession } from '../services/supabase';
import { state } from '../core/GameState';

/** Loads the art, builds effect textures and signs in (if Supabase is configured), then opens hero selection. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    const { width, height } = this.scale;
    const label = this.add.text(width / 2, height / 2, 'Loading...', text(18)).setOrigin(0.5);
    this.load.on('progress', (v: number) => label.setText(`Loading... ${Math.round(v * 100)}%`));
    loadSprites(this.load);
  }

  async create() {
    createTextures(this);
    this.anims.create({ key: 'torch_burn', frames: this.anims.generateFrameNumbers('torch', {}), frameRate: 8, repeat: -1 });

    try {
      state.online = (await ensureSession()) !== null;
    } catch (e) {
      console.warn('Supabase unavailable, playing offline', e);
      state.online = false;
    }
    this.scene.start('Starter');
  }
}
