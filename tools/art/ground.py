"""Lush, seamless grass ground for the iso map (the owner's HD-2D reference: one soft meadow with no
tile seams, and grass spilling over the edges of paths, plazas and river banks).

- ground_grass: 32 diamond tiles (64x32) cut from one seamless 256x128 painting. Tile (x, y) uses
  frame lattice(x, y), so neighbours line up pixel for pixel and the meadow shows no grid.
- ground_edge: for each of those 32 tiles, 4 overlays (grass reaching in from the SE, NW, SW or NE
  edge) laid on a path / stone / water tile next to grass, with a ragged edge and a soft shadow.
"""
from __future__ import annotations

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

W, H = 256, 128          # texture period on screen: 8 tiles across, 8 rows down
TW, TH = 64, 32          # one iso tile
PALETTE = np.array([
    (40, 92, 38), (52, 112, 44), (66, 132, 50), (82, 150, 58), (102, 168, 66), (128, 188, 82),
], dtype=np.float32)


def _noise(rng, sigma):
    """Seamless (wrap-around) smooth noise in 0..1."""
    n = ndi.gaussian_filter(rng.random((H, W)), sigma, mode='wrap')
    return (n - n.min()) / (n.max() - n.min() + 1e-9)


def _painting(seed=11) -> np.ndarray:
    rng = np.random.default_rng(seed)
    # Big soft patches of light and shade, then finer clumps: banded into the palette (pixel art).
    v = 0.55 * _noise(rng, 14) + 0.3 * _noise(rng, 5) + 0.15 * _noise(rng, 1.2)
    v = (v - v.min()) / (v.max() - v.min())
    idx = np.clip((v * 4.2 + 0.6).astype(int), 0, 4)
    img = PALETTE[idx].copy()
    # Grass blades: short vertical strokes, bright tip, darker root.
    for _ in range(900):
        x, y = rng.integers(0, W), rng.integers(0, H)
        ln = rng.integers(2, 4)
        base = idx[y, x]
        for k in range(ln):
            yy = (y - k) % H
            img[yy, x] = PALETTE[min(5, base + 1 + (k == ln - 1))]
        img[(y + 1) % H, x] = PALETTE[max(0, base - 2)]
    # A few tiny flowers.
    for col in [(250, 248, 236), (255, 222, 96), (255, 182, 214), (182, 214, 255)]:
        for _ in range(14):
            x, y = rng.integers(0, W), rng.integers(0, H)
            img[y, x] = col
            img[(y + 1) % H, x] = PALETTE[0]
    return img.astype(np.uint8)


def _diamond(u, v):
    return np.abs(u) / 32 + np.abs(v) / 16 <= 1


def _lattice():
    """(a, b) screen offsets of the 32 distinct tile positions within one texture period."""
    out = []
    for a in range(8):
        for b in range(a % 2, 8, 2):
            out.append((a, b))
    return out


def ground() -> dict:
    tex = _painting()
    yy, xx = np.mgrid[0:TH, 0:TW]
    u, v = xx + 0.5 - TW / 2, yy + 0.5 - TH / 2
    inside = _diamond(u, v)
    rng = np.random.default_rng(5)
    # Edge distance for each direction: 0 on that edge, 2 at the far corner.
    dists = [1 - (u / 32 + v / 16), 1 + (u / 32 + v / 16), 1 - (-u / 32 + v / 16), 1 + (-u / 32 + v / 16)]
    tiles, edges = [], []
    for a, b in _lattice():
        cx, cy = a * 32, b * 16
        rows = (np.arange(TH) + cy - TH // 2) % H
        cols = (np.arange(TW) + cx - TW // 2) % W
        rgb = tex[np.ix_(rows, cols)]
        alpha = np.where(inside, 255, 0).astype(np.uint8)
        tiles.append(Image.fromarray(np.dstack([rgb, alpha]), 'RGBA'))
        for d in dists:
            # Ragged reach: grass clumps poke 30-60% into the tile, in 4px steps (reads at game zoom).
            jag = ndi.zoom(rng.random((TH // 4 + 1, TW // 4 + 1)), 4, order=0)[:TH, :TW]
            grass = inside & (d < 0.3 + 0.32 * jag)
            # Dark rim just outside the grass: its shadow on the stone or water.
            rim = inside & ~grass & ndi.binary_dilation(grass, iterations=1)
            out = np.zeros((TH, TW, 4), np.uint8)
            out[grass, :3] = rgb[grass]
            out[grass, 3] = 255
            out[rim] = (30, 46, 20, 150)
            edges.append(Image.fromarray(out, 'RGBA'))
    return {'ground_grass': tiles, 'ground_edge': edges}
