import Phaser from 'phaser';
import { spriteInfo } from '../assets/sprites';

/** The device's own UI font (Roboto on Android, San Francisco on iPhone, Segoe UI on Windows). */
export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", Arial, sans-serif';

export const COLORS = {
  text: '#f4ead0',
  dim: '#c9b98f',
  gold: '#ffd75e',
  hp: 0xd93a3a,
  mp: 0x3a72d9,
  exp: 0xd9b43d,
};

/**
 * The only text sizes in the game (px). Every caller's size snaps to the nearest step, so the
 * same kind of text is always the same size: small (labels, hints), body, heading, title, logo.
 */
export const SIZES = { small: 14, body: 16, heading: 20, title: 26, logo: 44 };

function snap(size: number) {
  if (size <= 14) return SIZES.small;
  if (size <= 17) return SIZES.body;
  if (size <= 22) return SIZES.heading;
  if (size <= 32) return SIZES.title;
  return SIZES.logo;
}

export const text = (size: number, color = COLORS.text): Phaser.Types.GameObjects.Text.TextStyle => {
  const px = snap(size);
  return { fontFamily: FONT, fontStyle: 'bold', fontSize: `${px}px`, color, stroke: '#07080e', strokeThickness: px >= 26 ? 5 : 3, resolution: 2 };
};

/** Titles and menu headers: same font, gold by default. */
export const title = (size: number, color = COLORS.gold): Phaser.Types.GameObjects.Text.TextStyle => text(size, color);

/** Labels over people and things in the world (names, damage numbers): small or body size. */
export const worldText = (size: 'small' | 'body', color: string): Phaser.Types.GameObjects.Text.TextStyle => ({
  ...text(SIZES[size], color),
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
  const isPortrait = p.startsWith('portrait_');
  // From a full-body sprite, take a square around the head so wide props (hammers, bows) don't shrink it.
  const cropH = isPortrait ? info.h : Math.round(info.h * 0.5);
  const cropW = isPortrait ? fw : Math.min(fw, Math.round(cropH * 1.2));
  const cropX = Math.round((fw - cropW) / 2);
  const s = Math.max(1, Math.floor(size / Math.max(cropW, cropH)));
  img.setTexture(p, 0).setCrop(cropX, 0, cropW, cropH).setScale(s).setOrigin(0.5, 0);
  return cropH * s;
}
