"""Shared palette, noise and drawing helpers for the procedural pixel-art pipeline.

All art is authored at "art pixel" resolution and displayed at 2x in the game
(1 art px = 2 world px). The palette was sampled from the reference images.
"""
import numpy as np

def hexc(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.uint8)

# Iso tile size in art pixels (world tiles are 64x32 = 2x this).
TW, TH = 32, 16

PAL = {k: [hexc(c) for c in v] for k, v in {
    # dark -> light
    'grass':   ['#1c3a2a', '#2f5a33', '#467d3a', '#5e9a44', '#7fb64f', '#a4cc62', '#cfdc7c'],
    'dirt':    ['#4a3524', '#76563a', '#9a7449', '#b88f5a', '#d2ab72', '#e6c690'],
    'water':   ['#0f2638', '#17344b', '#1f4d68', '#286a88', '#3589aa', '#58afc8', '#a6dde0', '#eaf8f4'],
    'leaf':    ['#06191a', '#0e3a2c', '#1a5233', '#2a6b38', '#3f8a40', '#62a94d', '#94c95f'],
    'bark':    ['#1e1210', '#3b2419', '#5a3825', '#7a4f32', '#9a6a44'],
    'stone':   ['#1d2128', '#3a404b', '#565d6b', '#757d8c', '#9aa2b0', '#c3c9d2'],
    'moss':    ['#2f5a33', '#467d3a', '#6a9a48'],
    'wood':    ['#2a1a12', '#4e3020', '#6e4429', '#8e5c35', '#ad7744'],
    'plaster': ['#7a6a55', '#a8967a', '#cdbb98', '#e6d6b2'],
    'roof':    ['#3e1714', '#6a2a20', '#8f3b2a', '#b24e33', '#cf6a45'],
    'flower':  ['#f2d65a', '#f4f1e8', '#e07a9a', '#a77bdc', '#ef9440'],
}.items()}

OUTLINE = hexc('#0b0d14')
BG = hexc('#0d0b14')

# 4x4 Bayer matrix for ordered dithering, normalized to [0,1).
BAYER4 = (np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) + 0.5) / 16


def value_noise(x, y, seed, scale=1.0):
    """Smooth 2D value noise in [0,1] at float coords (numpy arrays)."""
    rng = np.random.default_rng(seed)
    size = 512
    lat = rng.random((size, size))
    x = x * scale; y = y * scale
    x0 = np.floor(x).astype(int); y0 = np.floor(y).astype(int)
    fx = x - x0; fy = y - y0
    sx = fx * fx * (3 - 2 * fx); sy = fy * fy * (3 - 2 * fy)
    x0 %= size; y0 %= size; x1 = (x0 + 1) % size; y1 = (y0 + 1) % size
    a = lat[y0, x0]; b = lat[y0, x1]; c = lat[y1, x0]; d = lat[y1, x1]
    return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy


def fbm(x, y, seed, scale=1.0, octaves=4):
    total = np.zeros_like(x, dtype=float); amp = 1.0; norm = 0.0
    for o in range(octaves):
        total += amp * value_noise(x, y, seed + o * 101, scale * (2 ** o))
        norm += amp; amp *= 0.5
    return total / norm


def dither_level(v, x, y, levels, strength=1.0):
    """Quantize v in [0,1] to an int level with ordered dithering.
    strength < 1 keeps dithering to narrow bands at tone boundaries (cleaner, less noisy)."""
    t = BAYER4[y % 4, x % 4]
    return np.clip(np.floor(v * levels + (t - 0.5) * strength), 0, levels - 1).astype(int)


def shade(pal, idx):
    """Pick palette colors by integer index array."""
    arr = np.array(pal)
    return arr[np.clip(idx, 0, len(pal) - 1)]


def outline_alpha(rgba, color=OUTLINE):
    """Add a 1px outline around opaque pixels of an RGBA uint8 array (in place on a padded copy)."""
    a = rgba[..., 3] > 0
    pad = np.pad(a, 1)
    nb = pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:]
    edge = nb & ~a
    out = rgba.copy()
    out[edge, :3] = color
    out[edge, 3] = 255
    return out
