import Phaser from 'phaser';

// Ambient light: a color laid over the whole world (multiply), with light sources (torches, lamps,
// fires) drawn on top so they glow through. M5's day/night cycle will animate `setAmbient`.

const OVERLAY_DEPTH = 150000;
export const LIGHT_DEPTH = OVERLAY_DEPTH + 1;

export const AMBIENT = {
  day: { color: 0xffffff, alpha: 0 },
  dusk: { color: 0x6a5c9c, alpha: 0.42 },
  night: { color: 0x2a2f6a, alpha: 0.6 },
};

export class LightingSystem {
  private overlay: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene) {
    // Oversized and fixed to the camera, so it still covers the screen when zoomed.
    const { width, height } = scene.scale;
    this.overlay = scene.add
      .rectangle(-width, -height, width * 3, height * 3, 0x000000, 0)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(OVERLAY_DEPTH)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
  }

  setAmbient(a: { color: number; alpha: number }) {
    this.overlay.setFillStyle(a.color, a.alpha);
  }
}
