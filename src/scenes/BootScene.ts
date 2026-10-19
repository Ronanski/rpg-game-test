import Phaser from 'phaser';
import { createTextures } from '../assets/textures';
import { ensureSession } from '../services/supabase';
import { state } from '../core/GameState';

/** Builds textures and signs in (if Supabase is configured), then opens hero selection. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  async create() {
    createTextures(this);

    try {
      state.online = (await ensureSession()) !== null;
    } catch (e) {
      console.warn('Supabase unavailable, playing offline', e);
      state.online = false;
    }
    this.scene.start('Starter');
  }
}
