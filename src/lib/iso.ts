// Isometric (2:1 diamond) grid math. Grid (x, y) <-> screen pixels.
export const TILE_W = 64;
export const TILE_H = 32;

export function gridToScreen(gx: number, gy: number): { x: number; y: number } {
  return { x: (gx - gy) * (TILE_W / 2), y: (gx + gy) * (TILE_H / 2) };
}

export function screenToGrid(sx: number, sy: number): { x: number; y: number } {
  const x = (sx / (TILE_W / 2) + sy / (TILE_H / 2)) / 2;
  const y = (sy / (TILE_H / 2) - sx / (TILE_W / 2)) / 2;
  return { x: Math.floor(x + 0.5), y: Math.floor(y + 0.5) };
}

/** Painter's-algorithm depth: things further down-screen draw on top. */
export function isoDepth(gx: number, gy: number): number {
  return (gx + gy) * 10;
}
