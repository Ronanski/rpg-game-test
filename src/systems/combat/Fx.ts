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

/**
 * A sword arc in the swing direction, from the owner's effects art: cool blue for normal swings,
 * the flame blade for warm-tinted (heavy) ones.
 */
export function slash(scene: Phaser.Scene, x: number, y: number, angle: number, size = 1, tint = 0xffffff) {
  const warm = (tint >> 16) - (tint & 0xff) > 40;
  // Drawn normally: the art's soft colours wash out to white with additive blending.
  const img = scene.add.image(x, y, warm ? 'fx_slash_fire' : 'fx_slash').setDepth(TOP - 1).setRotation(angle).setScale(0.8 * size);
  // Pointing left, mirror it so the arc still curves the same way on screen.
  if (Math.cos(angle) < 0) img.setFlipY(true);
  scene.tweens.add({ targets: img, scale: 1.35 * size, alpha: 0, rotation: angle + (Math.cos(angle) < 0 ? -0.5 : 0.5), duration: 260, ease: 'Quad.easeOut', onComplete: () => img.destroy() });
}

/** An effect picture that pops up and fades (hit stars, fire bursts, healing rings). */
function pop(scene: Phaser.Scene, key: string, x: number, y: number, from: number, to: number, ms: number, rise = 0, spin = 0) {
  const img = scene.add.image(x, y, key).setDepth(TOP).setScale(from).setRotation(spin ? Math.random() * spin : 0);
  scene.tweens.add({ targets: img, scale: to, alpha: 0, y: y - rise, duration: ms, ease: 'Cubic.easeOut', onComplete: () => img.destroy() });
}

/** The impact star where a hit lands. */
export function impact(scene: Phaser.Scene, x: number, y: number, size = 1) {
  pop(scene, 'fx_hit', x, y, 0.35 * size, 0.95 * size, 200, 0, Math.PI);
}

/** A fire explosion (firebolt hits, Flame Nova). */
export function burst(scene: Phaser.Scene, x: number, y: number, size = 1) {
  pop(scene, 'fx_burst', x, y, 0.5 * size, 1.4 * size, 420, 10);
}

/** A heavy blast (Power Strike, Hammer Slam). */
export function blast(scene: Phaser.Scene, x: number, y: number, size = 1) {
  pop(scene, 'fx_explode', x, y, 0.5 * size, 1.6 * size, 380, 0, Math.PI);
}

/** A green healing ring that rises around someone (potions, resting). */
export function heal(scene: Phaser.Scene, x: number, y: number) {
  pop(scene, 'fx_heal', x, y - 20, 0.8, 1.5, 700, 24);
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
