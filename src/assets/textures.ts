import Phaser from 'phaser';

// Small effect textures drawn at runtime. All other art is loaded from public/assets/sprites
// (see src/assets/sprites.ts and tools/art/build.py).

export function createTextures(scene: Phaser.Scene) {
  // Soft shadow under characters and objects.
  const sh = scene.add.graphics();
  for (let i = 0; i < 4; i++) sh.fillStyle(0x000000, 0.1).fillEllipse(16, 6, 32 - i * 6, 12 - i * 2);
  sh.generateTexture('shadow', 32, 12);
  sh.destroy();

  // Sword slash arc.
  const s = scene.add.graphics();
  s.lineStyle(4, 0xffffff, 0.9).beginPath().arc(24, 24, 20, -1.2, 1.2).strokePath();
  s.lineStyle(2, 0xfff2a8, 0.8).beginPath().arc(24, 24, 15, -1.0, 1.0).strokePath();
  s.generateTexture('slash', 48, 48);
  s.destroy();

  // Firebolt: a hot core inside a soft orange flame.
  const fb = scene.add.graphics();
  for (let r = 12; r > 0; r -= 2) fb.fillStyle(r > 6 ? 0xff6a1a : 0xffe08a, r > 6 ? 0.25 : 0.9).fillCircle(12, 12, r);
  fb.generateTexture('firebolt', 24, 24);
  fb.destroy();

  // Warm light pool for torches and windows (drawn additively).
  const g = scene.add.graphics();
  for (let r = 64; r > 0; r -= 4) g.fillStyle(0xffa040, 0.025).fillCircle(64, 64, r);
  g.generateTexture('glow', 128, 128);
  g.destroy();
}
