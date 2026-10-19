// Isometric (2:1 diamond) math. A grid cell (gx, gy) maps to the screen point at the
// CENTER of its diamond. Fractional grid coordinates are allowed (for free movement).
export const TILE_W = 64;
export const TILE_H = 32;

export function gridToScreen(gx: number, gy: number): { x: number; y: number } {
  return { x: (gx - gy) * (TILE_W / 2), y: (gx + gy) * (TILE_H / 2) };
}

export function screenToGrid(x: number, y: number): { x: number; y: number } {
  return {
    x: (x / (TILE_W / 2) + y / (TILE_H / 2)) / 2,
    y: (y / (TILE_H / 2) - x / (TILE_W / 2)) / 2,
  };
}

/** The integer tile containing a screen point. */
export function screenToTile(x: number, y: number): { x: number; y: number } {
  const g = screenToGrid(x, y);
  return { x: Math.round(g.x), y: Math.round(g.y) };
}
