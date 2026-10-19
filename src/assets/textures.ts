import Phaser from 'phaser';

// Small runtime-generated effects. All world art lives in public/assets/art
// (built by tools/art/build.py).

export function createTextures(scene: Phaser.Scene) {
  // Dithered pixel shadow under characters (drawn at 2x like the rest of the art).
  const sh = scene.add.graphics();
  const w = 14, h = 5;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = ((x - w / 2 + 0.5) / (w / 2)) ** 2 + ((y - h / 2 + 0.5) / (h / 2)) ** 2;
      if (d < 0.7 || (d < 1 && (x + y) % 2 === 0)) sh.fillStyle(0x000000, 0.4).fillRect(x, y, 1, 1);
    }
  }
  sh.generateTexture('shadow', w, h);
  sh.destroy();

  // Sword slash arc.
  const s = scene.add.graphics();
  s.lineStyle(4, 0xffffff, 0.9).beginPath().arc(24, 24, 20, -1.2, 1.2).strokePath();
  s.lineStyle(2, 0xfff2a8, 0.8).beginPath().arc(24, 24, 15, -1.0, 1.0).strokePath();
  s.generateTexture('slash', 48, 48);
  s.destroy();
}
