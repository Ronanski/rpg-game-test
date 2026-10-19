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

  // Small soft dot for sparks and fire particles (tinted per effect).
  const sp = scene.add.graphics();
  sp.fillStyle(0xffffff, 0.35).fillCircle(5, 5, 5);
  sp.fillStyle(0xffffff, 1).fillCircle(5, 5, 2.5);
  sp.generateTexture('spark', 10, 10);
  sp.destroy();

  // Dust puff kicked up by footsteps and rolls.
  const du = scene.add.graphics();
  du.fillStyle(0xd8c8a8, 0.5).fillEllipse(8, 5, 16, 10);
  du.fillStyle(0xeee0c4, 0.5).fillEllipse(7, 4, 9, 6);
  du.generateTexture('dust', 16, 10);
  du.destroy();

  // Arrow (points right; rotated to its flight direction).
  const ar = scene.add.graphics();
  ar.fillStyle(0x8a5a2b).fillRect(2, 3, 18, 2);
  ar.fillStyle(0xd8dce6).fillTriangle(20, 0, 26, 4, 20, 8);
  ar.fillStyle(0xf4f1e8).fillTriangle(0, 1, 5, 4, 0, 7);
  ar.generateTexture('arrow', 26, 8);
  ar.destroy();

  // Firebolt: a hot core inside a soft orange flame.
  const fb = scene.add.graphics();
  for (let r = 12; r > 0; r -= 2) fb.fillStyle(r > 6 ? 0xff6a1a : 0xffe08a, r > 6 ? 0.25 : 0.9).fillCircle(12, 12, r);
  fb.generateTexture('firebolt', 24, 24);
  fb.destroy();

  // Warm light pool for torches and lamps (drawn additively): a smooth radial falloff.
  const glow = scene.textures.createCanvas('glow', 128, 128)!;
  const ctx = glow.getContext();
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255, 190, 110, 0.75)');
  grad.addColorStop(0.35, 'rgba(255, 150, 60, 0.35)');
  grad.addColorStop(1, 'rgba(255, 120, 40, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  glow.refresh();
}
