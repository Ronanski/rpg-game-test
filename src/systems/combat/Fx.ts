import Phaser from 'phaser';

// Small visual effects for combat and movement. Each one cleans itself up.

const TOP = 190000; // above the world, below floating text

/** A burst of glowing sparks (hits, crits, spells). */
export function sparks(scene: Phaser.Scene, x: number, y: number, tint: number, count = 10, speed = 160) {
  const e = scene.add.particles(x, y, 'spark', {
    speed: { min: speed * 0.4, max: speed },
    angle: { min: 0, max: 360 },
    lifespan: { min: 180, max: 360 },
    scale: { start: 1.8, end: 0 },
    alpha: { start: 1, end: 0 },
    tint,
    blendMode: Phaser.BlendModes.ADD,
    emitting: false,
  }).setDepth(TOP);
  e.explode(count);
  scene.time.delayedCall(450, () => e.destroy());
}

/** Rising flames for fire spells. */
export function flames(scene: Phaser.Scene, x: number, y: number, radius: number) {
  const e = scene.add.particles(x, y, 'spark', {
    x: { min: -radius, max: radius },
    y: { min: -radius / 2, max: radius / 2 },
    speedY: { min: -120, max: -40 },
    lifespan: { min: 250, max: 520 },
    scale: { start: 1.8, end: 0.2 },
    alpha: { start: 0.9, end: 0 },
    tint: [0xffe08a, 0xff9a3a, 0xff5a1a],
    blendMode: Phaser.BlendModes.ADD,
    emitting: false,
  }).setDepth(TOP);
  e.explode(Math.round(radius / 2));
  scene.time.delayedCall(600, () => e.destroy());
}

/** A dust puff at someone's feet. */
export function dust(scene: Phaser.Scene, x: number, y: number, size = 1) {
  const d = scene.add.image(x + Phaser.Math.Between(-4, 4), y, 'dust').setDepth(y - 1).setScale(0.6 * size).setAlpha(0.8);
  scene.tweens.add({ targets: d, y: y - 6, scale: 1.3 * size, alpha: 0, duration: 380, onComplete: () => d.destroy() });
}

/** A sword arc: two bright crescents sweeping in the swing direction. */
export function slash(scene: Phaser.Scene, x: number, y: number, angle: number, size = 1, tint = 0xffffff) {
  const g = scene.add.graphics().setPosition(x, y).setRotation(angle).setDepth(TOP - 1);
  const r = 34 * size;
  // Dark edge first so the arc reads on bright grass, then the bright blade trail on top.
  g.lineStyle(10 * size, 0x1a1420, 0.35).beginPath().arc(0, 0, r, -1.35, 1.35).strokePath();
  g.lineStyle(8 * size, tint, 0.55).beginPath().arc(0, 0, r, -1.3, 1.3).strokePath();
  g.lineStyle(4 * size, 0xffffff, 1).beginPath().arc(0, 0, r, -1.0, 1.0).strokePath();
  g.setScale(0.7, 0.55);
  scene.tweens.add({ targets: g, scaleX: 1.2, scaleY: 0.85, alpha: 0, rotation: angle + 0.6, duration: 260, ease: 'Quad.easeOut', onComplete: () => g.destroy() });
}

/** An expanding ground ring (shockwaves, whirlwinds, novas). */
export function ring(scene: Phaser.Scene, x: number, y: number, r: number, color: number, width = 5) {
  const g = scene.add.graphics().setPosition(x, y).setDepth(TOP - 2).setBlendMode(Phaser.BlendModes.ADD);
  g.lineStyle(width + 4, color, 0.35).strokeEllipse(0, 0, r * 2, r);
  g.lineStyle(width, color, 1).strokeEllipse(0, 0, r * 2, r);
  g.setScale(0.25);
  scene.tweens.add({ targets: g, scale: 1, alpha: 0, duration: 420, ease: 'Cubic.easeOut', onComplete: () => g.destroy() });
}

/** Fading copies of a sprite (fast dashes). */
export function afterimage(scene: Phaser.Scene, s: Phaser.GameObjects.Sprite, tint = 0x9fe3ff) {
  const g = scene.add.image(s.x, s.y, s.texture.key, s.frame.name).setOrigin(s.originX, s.originY)
    .setScale(s.scaleX, s.scaleY).setFlipX(s.flipX).setDepth(s.depth - 1).setTint(tint).setAlpha(0.6)
    .setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
}

/** Tiny freeze on impact so hits feel heavy. */
export function hitStop(scene: Phaser.Scene, ms = 45) {
  scene.tweens.timeScale = 0.05;
  scene.time.delayedCall(ms, () => (scene.tweens.timeScale = 1));
}
