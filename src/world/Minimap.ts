import Phaser from 'phaser';
import { Tile, type WorldData } from './worldData';

/** Pixels per half tile on the map picture (a tile is a 2S x S diamond, like the iso world). */
export const MAP_S = 3;

const COLORS: Partial<Record<Tile, string>> = {
  [Tile.Grass]: '#5a8f3c', [Tile.Grass2]: '#53863a', [Tile.Flowers]: '#679a45', [Tile.Path]: '#b9935f',
  [Tile.Stone]: '#8c8478', [Tile.Water]: '#3f7fc6', [Tile.Bridge]: '#8a5a2b',
};

/** A world point (iso screen px) on the map picture of an area `h` tiles tall. */
export function toMap(x: number, y: number, h: number) {
  return { x: (x * MAP_S) / 32 + h * MAP_S, y: (y * MAP_S) / 32 };
}

/**
 * Draws the whole area once as a small picture: ground colours, trees darker, buildings brown.
 * The UI scene crops the mini-map (and the big map) out of it.
 */
export function buildMapTexture(scene: Phaser.Scene, world: WorldData): string {
  const key = `mapbase_${world.id}`;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const w = (world.w + world.h) * MAP_S, h = ((world.w + world.h) * MAP_S) / 2 + MAP_S;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const diamond = (gx: number, gy: number, color: string) => {
    const cx = (gx - gy) * MAP_S + world.h * MAP_S, cy = (gx + gy) * (MAP_S / 2);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - MAP_S / 2);
    ctx.lineTo(cx + MAP_S, cy);
    ctx.lineTo(cx, cy + MAP_S / 2);
    ctx.lineTo(cx - MAP_S, cy);
    ctx.closePath();
    ctx.fill();
  };
  for (let y = 0; y < world.h; y++) for (let x = 0; x < world.w; x++) {
    const c = COLORS[world.tiles[y][x]];
    if (c) diamond(x, y, c);
  }
  for (const p of world.props) {
    if (p.kind === 'tree') diamond(p.x, p.y, '#2c5528');
    else if (p.kind === 'building') for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) diamond(p.x + dx, p.y + dy, '#7a4a2a');
    else if (world.blocked[p.y]?.[p.x]) diamond(p.x, p.y, world.id === 'overworld' ? '#6f6a5c' : '#4a4038');
  }
  scene.textures.addCanvas(key, canvas);
  return key;
}
