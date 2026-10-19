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
