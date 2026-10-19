import Phaser from 'phaser';
import manifest from './manifest.json';

/** Art is authored at half resolution and drawn at 2x (1 art px = 2 world px). */
export const ART_SCALE = 2;

type Entry = { w: number; h: number; ax: number; ay: number };
const entries = manifest as Record<string, Entry>;

export function preloadArt(scene: Phaser.Scene) {
  for (const key of Object.keys(entries)) scene.load.image(key, `assets/art/${key}.png`);
}

/** Origin that puts a sprite's ground anchor at its world position. */
export function anchorOf(key: string): { x: number; y: number } {
  const e = entries[key];
  return e ? { x: (e.ax + 0.5) / e.w, y: (e.ay + 1) / e.h } : { x: 0.5, y: 1 };
}

/** Creates an art sprite at its anchor, scaled to world size. */
export function artImage(scene: Phaser.Scene, x: number, y: number, key: string) {
  const a = anchorOf(key);
  return scene.add.image(x, y, key).setOrigin(a.x, a.y).setScale(ART_SCALE);
}
