import Phaser from 'phaser';
import manifest from './spriteManifest.json';

// Sprites are built by tools/art/build.py into public/assets/sprites (see that script).
// Code-drawn art is half size (scale 2); art cut from the owner's sheets is full size (scale 1).

export interface SpriteInfo {
  key: string;
  w: number;
  h: number;
  scale: number;
  frameWidth?: number;
  imported?: boolean;
  /** Frame-by-frame hero: 0 idle, 1-5 walk, 6 wind-up, 7 strike, 8 hurt. */
  anim?: boolean;
  /** Frame-by-frame monster: 0-1 idle, 2 wind-up, 3 strike, 4 hurt, 5-6 dying. */
  manim?: boolean;
  /** Frame-by-frame townsperson: 0 idle, 1-3 walk, 4 talking. */
  nanim?: boolean;
}

const byKey = new Map<string, SpriteInfo>((manifest as SpriteInfo[]).map((s) => [s.key, s]));

export function spriteInfo(key: string): SpriteInfo {
  const s = byKey.get(key);
  if (!s) throw new Error(`Unknown sprite: ${key}`);
  return s;
}

/** World scale to draw a sprite at. */
export function spriteScale(key: string): number {
  return byKey.get(key)?.scale ?? 1;
}

export function isAnimated(key: string): boolean {
  return !!byKey.get(key)?.anim;
}

export function isNpcAnim(key: string): boolean {
  return !!byKey.get(key)?.nanim;
}

export function isMonsterAnim(key: string): boolean {
  return !!byKey.get(key)?.manim;
}

export function frameCount(key: string): number {
  const s = byKey.get(key);
  return s?.frameWidth ? s.w / s.frameWidth : 1;
}

export function loadSprites(load: Phaser.Loader.LoaderPlugin) {
  const base = `${import.meta.env.BASE_URL}assets/sprites/`;
  for (const s of byKey.values()) {
    if (s.frameWidth) load.spritesheet(s.key, `${base}${s.key}.png`, { frameWidth: s.frameWidth, frameHeight: s.h });
    else load.image(s.key, `${base}${s.key}.png`);
  }
}
