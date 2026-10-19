import Phaser from 'phaser';
import { createTextures } from '../assets/textures';
import { preloadArt } from '../assets/art';
import { ensureSession } from '../services/supabase';
import { api } from '../services/api';
import { state } from '../core/GameState';
import { computeStats, expToNext } from '../systems/combat/ClassSystem';

/** Builds textures, signs in (if Supabase is configured) and creates the starting hero. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    preloadArt(this);
  }

  async create() {
    createTextures(this);

    const s = computeStats('human', 'warrior', 1);
    state.player = {
      name: 'Kael', jobId: 'warrior', level: 1, exp: 0, expToNext: expToNext(1),
      hp: s.hp, maxHp: s.hp, mp: s.mp, maxMp: s.mp, atk: s.atk, def: s.def, spd: s.spd, gold: 0,
    };
    state.inventory.set('health_potion', 3);

    try {
      state.online = (await ensureSession()) !== null;
      // Starter selection screen comes later; default to Kael for now.
      if (state.online) await api.chooseStarter('kael').catch(() => {});
    } catch (e) {
      console.warn('Supabase unavailable, playing offline', e);
      state.online = false;
    }
    this.scene.start('World');
  }
}
