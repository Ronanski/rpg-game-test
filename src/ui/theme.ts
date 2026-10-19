import Phaser from 'phaser';
import { spriteInfo } from '../assets/sprites';

/** Pixel font (Pixelify Sans, SIL OFL), loaded in main.ts before the game starts. */
export const FONT = '"Pixelify Sans", monospace';

export const COLORS = {
  text: '#f4ead0',
  dim: '#a9a3c0',
  gold: '#ffd75e',
  hp: 0xd93a3a,
  mp: 0x3a72d9,
  exp: 0xd9b43d,
};

export const text = (size: number, color = COLORS.text): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: FONT,
  fontSize: `${size}px`,
  color,
  stroke: '#07080e',
  strokeThickness: Math.max(2, Math.round(size / 6)),
});

/**
 * Framed pixel panel (9-slice). The frame art is 2x pixel scale, so the slice is drawn at
 * half size and scaled up to keep every pixel square.
 */
export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, gold = false) {
  const key = gold ? 'ui_panel_gold' : 'ui_panel';
  return scene.add.nineslice(x, y, key, undefined, Math.round(w / 2), Math.round(h / 2), 6, 6, 6, 6).setOrigin(0).setScale(2);
}

/** Resizes a panel made with panel(). */
export function resizePanel(p: Phaser.GameObjects.NineSlice, w: number, h: number) {
  p.setSize(Math.round(w / 2), Math.round(h / 2));
}

/**
 * Points `img` at the speaker's portrait: a dedicated portrait_<key> sprite if one exists,
 * otherwise the head and shoulders of their sprite. Scales it to fit a box of `size` px.
 * Returns the displayed height so callers can center it.
 */
export function applyPortrait(img: Phaser.GameObjects.Image, key: string, size: number): number {
  const p = img.scene.textures.exists(`portrait_${key}`) ? `portrait_${key}` : key;
  const info = spriteInfo(p);
  const fw = info.frameWidth ?? info.w;
  const cropH = p.startsWith('portrait_') ? info.h : Math.round(info.h * 0.5);
  const s = Math.max(1, Math.floor(size / Math.max(fw, cropH)));
  img.setTexture(p, 0).setCrop(0, 0, fw, cropH).setScale(s).setOrigin(0.5, 0);
  return cropH * s;
}
