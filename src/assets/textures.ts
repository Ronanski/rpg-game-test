import Phaser from 'phaser';
import { TILE_W, TILE_H } from '../iso/iso';

// Procedural placeholder pixel art. Replace by loading real sprite sheets in BootScene;
// keep the same texture keys and nothing else has to change.

type Palette = Record<string, number>;

/** Draws a sprite from rows of palette characters ('.' = transparent). */
function pixelSprite(scene: Phaser.Scene, key: string, rows: string[], pal: Palette) {
  const g = scene.add.graphics();
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      g.fillStyle(pal[ch]).fillRect(x, y, 1, 1);
    });
  });
  g.generateTexture(key, rows[0].length, rows.length);
  g.destroy();
}

function diamond(g: Phaser.GameObjects.Graphics, cx: number, cy: number, w: number, h: number) {
  g.fillPoints(
    [
      new Phaser.Math.Vector2(cx, cy - h / 2),
      new Phaser.Math.Vector2(cx + w / 2, cy),
      new Phaser.Math.Vector2(cx, cy + h / 2),
      new Phaser.Math.Vector2(cx - w / 2, cy),
    ],
    true,
  );
}

/** Ground tile with random speckles for texture. */
function groundTile(scene: Phaser.Scene, key: string, base: number, speckles: number[], density: number, seed: number) {
  const rnd = new Phaser.Math.RandomDataGenerator([String(seed)]);
  const g = scene.add.graphics();
  g.fillStyle(base);
  diamond(g, TILE_W / 2, TILE_H / 2, TILE_W, TILE_H);
  for (let i = 0; i < density; i++) {
    const x = rnd.between(4, TILE_W - 4);
    const y = rnd.between(2, TILE_H - 2);
    // keep inside the diamond
    if (Math.abs(x - TILE_W / 2) / (TILE_W / 2) + Math.abs(y - TILE_H / 2) / (TILE_H / 2) > 0.9) continue;
    g.fillStyle(rnd.pick(speckles)).fillRect(x, y, 2, 1);
  }
  g.generateTexture(key, TILE_W, TILE_H);
  g.destroy();
}

export function createTextures(scene: Phaser.Scene) {
  groundTile(scene, 'tile_grass', 0x4c8a3f, [0x5fa04e, 0x3f7535, 0x6bb35a], 70, 1);
  groundTile(scene, 'tile_grass2', 0x47823b, [0x5fa04e, 0x3a6c31, 0x7cc06a], 60, 2);
  groundTile(scene, 'tile_flowers', 0x4c8a3f, [0xe8d35a, 0xd9667a, 0xf4f1e8, 0x5fa04e], 50, 3);
  groundTile(scene, 'tile_path', 0xb08a5a, [0x9a774c, 0xc29d6c, 0x8c6a42], 60, 4);
  groundTile(scene, 'tile_stone', 0x8d8a85, [0x75726d, 0xa3a09a, 0x6a6762], 80, 5);
  groundTile(scene, 'tile_water', 0x2f6fb0, [0x4a8fd0, 0x7fb8ea, 0x285f99], 40, 6);
  groundTile(scene, 'tile_bridge', 0x8a5a2b, [0x6e4520, 0xa06c38], 50, 7);

  // Soft shadow under characters and objects.
  const sh = scene.add.graphics();
  sh.fillStyle(0x000000, 0.35).fillEllipse(16, 6, 32, 12);
  sh.generateTexture('shadow', 32, 12);
  sh.destroy();

  // Tree: trunk + layered canopy.
  const t = scene.add.graphics();
  t.fillStyle(0x5a3a1e).fillRect(28, 60, 8, 24);
  t.fillStyle(0x2f5e2a).fillCircle(32, 44, 24);
  t.fillStyle(0x3d7a34).fillCircle(26, 36, 18);
  t.fillStyle(0x4f9442).fillCircle(36, 30, 14);
  t.fillStyle(0x6bb35a).fillCircle(30, 24, 7);
  t.generateTexture('tree', 64, 84);
  t.destroy();

  // House: 2x2 tile iso box with a pitched roof.
  const h = scene.add.graphics();
  const W = TILE_W * 2, H = TILE_H * 2, wall = 40;
  const cx = W / 2, top = 40;
  const pts = (a: number[]) => a.reduce<Phaser.Math.Vector2[]>((acc, v, i) => (i % 2 ? acc : [...acc, new Phaser.Math.Vector2(v, a[i + 1])]), []);
  h.fillStyle(0xd8c7a0).fillPoints(pts([0, top + H / 2, cx, top + H, cx, top + H + wall, 0, top + H / 2 + wall]), true);
  h.fillStyle(0xb9a57c).fillPoints(pts([cx, top + H, W, top + H / 2, W, top + H / 2 + wall, cx, top + H + wall]), true);
  h.fillStyle(0x6e4520).fillRect(cx - 34, top + H - 4, 12, 26); // door
  h.fillStyle(0x9fc9e8).fillRect(cx + 22, top + H - 6, 10, 10); // window
  h.fillStyle(0x6e4520).fillRect(cx + 26, top + H - 6, 2, 10);
  h.fillStyle(0xa8432f).fillPoints(pts([0, top + H / 2, cx, 0, cx, top, 0, top + H / 2 + 0]), true);
  h.fillStyle(0xc4553c).fillPoints(pts([cx, 0, W, top + H / 2 - 8, cx, top + H, 0, top + H / 2]), true);
  h.fillStyle(0x8c3524).fillPoints(pts([cx, top + H, W, top + H / 2 - 8, W, top + H / 2, cx, top + H + 8]), true);
  h.generateTexture('house', W, top + H + wall);
  h.destroy();

  // Characters (12x16 px, drawn at 3x).
  const human = [
    '....HHHH....',
    '...HHHHHH...',
    '...HSSSSH...',
    '...SESSES...',
    '....SSSS....',
    '...CCCCCC...',
    '..SCCBBCCS..',
    '..SCCCCCCS..',
    '...CCCCCC...',
    '...CCBBCC...',
    '...LL..LL...',
    '...LL..LL...',
    '...FF..FF...',
  ];
  const base = { S: 0xf1c27d, E: 0x1a1a1a, B: 0x4a2c17, L: 0x5b4a3a, F: 0x3a2412 };
  pixelSprite(scene, 'hero', human, { ...base, H: 0x7a4426, C: 0x3f7d3a });
  // Starter heroes: Lyra (elf mage, pointed ears), Rook (beastkin rogue, wolf ears).
  pixelSprite(scene, 'hero_lyra', [
    '....HHHH....',
    '...HHHHHH...',
    '..SHSSSSHS..',
    '...SESSES...',
    '....SSSS....',
    '...CCCCCC...',
    '..SCCBBCCS..',
    '..SCCCCCCS..',
    '..CCCCCCCC..',
    '..CCCCCCCC..',
    '...CC..CC...',
    '...LL..LL...',
    '...FF..FF...',
  ], { ...base, H: 0xf2dc8a, C: 0x2f6f8f, B: 0xc9a14a, L: 0x2a4f66 });
  pixelSprite(scene, 'hero_rook', [
    '...H....H...',
    '...HH..HH...',
    '...HHHHHH...',
    '...SESSES...',
    '....SSSS....',
    '...CCCCCC...',
    '..SCCBBCCS..',
    '..SCCCCCCS..',
    '...CCCCCC...',
    '...CCBBCC...',
    '...LL..LL...',
    '...LL..LL...',
    '...FF..FF...',
  ], { ...base, S: 0xc98e5a, H: 0x3a3a44, C: 0x4a4458, L: 0x2e2a36 });
  pixelSprite(scene, 'npc_elder', human, { ...base, H: 0xe8e8e8, C: 0x6a4c93 });
  pixelSprite(scene, 'npc_smith', human, { ...base, H: 0x2a2a2a, C: 0x8a5a2b, L: 0x444444 });
  pixelSprite(scene, 'npc_stranger', [
    '....DDDD....',
    '...DDDDDD...',
    '..DDDDDDDD..',
    '..DDRDDRDD..',
    '...DDDDDD...',
    '..DDDDDDDD..',
    '..DDDDDDDD..',
    '..DDDDDDDD..',
    '..DDDDDDDD..',
    '...DDDDDD...',
    '...DD..DD...',
    '...FF..FF...',
  ], { D: 0x2b2238, R: 0xff3b3b, F: 0x1a1420 });

  pixelSprite(scene, 'slime', [
    '....AAAA....',
    '..AAAAAAAA..',
    '.AAWAAAAAAA.',
    'AAAWAAAAAAAA',
    'AAAAEAAEAAAA',
    'AAAAAAAAAAAA',
    '.AAAAAAAAAA.',
    '..DDDDDDDD..',
  ], { A: 0x6fcf5a, W: 0xd8f5cf, E: 0x1a1a1a, D: 0x3f8f34 });

  pixelSprite(scene, 'wolf', [
    '..............GG',
    '.............GGGG',
    'T...........GGEGN',
    'TT..GGGGGGGGGGGG.',
    '.TGGGGGGGGGGGGG..',
    '..GGGLGGGGGGGG...',
    '..GGLLLLLLLGGG...',
    '..GG.GG...GG.GG..',
    '..GG.GG...GG.GG..',
    '..DD.DD...DD.DD..',
  ].map((r) => r.padEnd(17, '.')), { G: 0x7d7d8a, L: 0xb5b5c0, E: 0xffd23b, N: 0x1a1a1a, T: 0x6a6a76, D: 0x3a3a44 });

  // Sword slash arc.
  const s = scene.add.graphics();
  s.lineStyle(4, 0xffffff, 0.9).beginPath().arc(24, 24, 20, -1.2, 1.2).strokePath();
  s.lineStyle(2, 0xfff2a8, 0.8).beginPath().arc(24, 24, 15, -1.0, 1.0).strokePath();
  s.generateTexture('slash', 48, 48);
  s.destroy();
}
