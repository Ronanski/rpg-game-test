"""Cuts sprites out of the owner's AI-generated sheets in art/raw/ and fits them to game size.

Each sheet has objects on a plain white background. For every object listed in SPECS this:
  1. crops its box, and removes the white background (and big white gaps, e.g. inside a bow),
  2. turns the grey ground shadow into a soft transparent shadow,
  3. resizes to the in-game size and reduces it to a small palette, so it stays crisp pixel art.
Ground tiles instead sample the top face of the iso block into a 64x32 diamond.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

RAW = Path(__file__).resolve().parents[2] / 'art' / 'raw'

# key: (sheet, (x0, y0, x1, y1), target height in world px)
SPRITES = {
    'hero_front': ('sheet_b.jpg', (1603, 1149, 1913, 1546), 58),
    'hero_back': ('sheet_b.jpg', (1306, 1555, 1616, 1960), 58),
    'hero_lyra': ('sheet_a.jpg', (1304, 1154, 1482, 1463), 58),
    'hero_rook': ('sheet_a.jpg', (1034, 835, 1266, 1119), 56),
    'npc_elder': ('sheet_a.jpg', (1539, 785, 1726, 1113), 60),
    'npc_smith': ('sheet_a.jpg', (1514, 1180, 1712, 1463), 56),
    'npc_villager': ('sheet_a.jpg', (1309, 813, 1506, 1118), 56),
    'npc_villager2': ('sheet_a.jpg', (1748, 820, 1912, 1108), 54),
    'npc_guard': ('sheet_a.jpg', (1744, 1190, 1942, 1463), 56),
    'npc_wizard': ('sheet_a.jpg', (1059, 1160, 1247, 1468), 58),
    'wolf': ('sheet_a.jpg', (1223, 465, 1482, 678), 40),
    'goblin': ('sheet_a.jpg', (1498, 460, 1696, 683), 46),
    'skeleton': ('sheet_a.jpg', (1714, 430, 1926, 693), 54),
    'house_thatch': ('sheet_a.jpg', (39, 685, 572, 1143), 118),
    'house_small': ('sheet_a.jpg', (939, 20, 1316, 383), 96),
    'tavern': ('sheet_b.jpg', (1142, 9, 1975, 772), 150),
    'fountain': ('sheet_b.jpg', (1157, 712, 1609, 1147), 62),
    'chest': ('sheet_b.jpg', (1650, 806, 1945, 1093), 30),
    'crystal': ('sheet_c.png', (384, 566, 556, 723), 32),
    'gate': ('sheet_c.png', (1305, 534, 1522, 719), 38),
    'barrel': ('sheet_c.png', (206, 796, 318, 943), 28),
    'crate': ('sheet_c.png', (333, 815, 454, 948), 26),
    'barrels': ('sheet_c.png', (465, 765, 635, 958), 40),
    'signpost': ('sheet_c.png', (656, 771, 772, 950), 40),
    'campfire': ('sheet_c.png', (1385, 777, 1526, 970), 34),
    'cave': ('sheet_c.png', (1100, 702, 1379, 999), 104),
}
# Animated: list of boxes become frames of one sheet (same canvas size).
ANIMS = {
    'slime': ('sheet_b.jpg', [(37, 1311, 299, 1517), (357, 1272, 611, 1517), (678, 1279, 939, 1517)], 30),
    # Nature and village props (sheet_c). Variants are frames; the game picks one per spot.
    'tree': ('sheet_c.png', [(27, 25, 355, 399), (359, 15, 684, 399), (692, 12, 1011, 416)], 112),
    'pine': ('sheet_c.png', [(1023, 29, 1275, 415), (1282, 37, 1524, 426)], 120),
    'bush': ('sheet_c.png', [(26, 408, 186, 545), (198, 406, 377, 550), (387, 404, 567, 552)], 32),
    'flowers': ('sheet_c.png', [(583, 431, 711, 537), (723, 435, 831, 541), (846, 437, 972, 539), (985, 411, 1123, 538)], 24),
    'rock': ('sheet_c.png', [(17, 573, 178, 710), (190, 566, 372, 726)], 30),
    'mushroom': ('sheet_c.png', [(569, 582, 689, 710), (704, 582, 847, 712)], 24),
    'fence': ('sheet_c.png', [(867, 557, 1082, 714), (1085, 557, 1307, 714)], 32),
    # The two torches differ slightly, so alternating them makes the flame flicker.
    'torch': ('sheet_c.png', [(15, 739, 105, 961), (115, 730, 195, 960)], 50),
}
TILES = {
    'tile_grass_deco': ('sheet_b.jpg', (27, 22, 713, 424)),
    'tile_stone': ('sheet_b.jpg', (28, 428, 713, 814)),
    'tile_path': ('sheet_b.jpg', (28, 826, 713, 1220)),
}
PORTRAITS = {
    # Head-and-shoulders crop for the HUD / dialogue portraits: (sheet, box)
    'portrait_hero': ('sheet_b.jpg', (1306, 1149, 1530, 1330)),
}

_cache: dict[str, np.ndarray] = {}


def sheet(name: str) -> np.ndarray:
    if name not in _cache:
        _cache[name] = np.asarray(Image.open(RAW / name).convert('RGB')).astype(np.float32)
    return _cache[name]


def cut(name: str, box, pad: int = 6) -> tuple[np.ndarray, np.ndarray]:
    """Returns (rgb, alpha 0..1) with the white background removed."""
    a = sheet(name)
    x0, y0, x1, y1 = box
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(a.shape[1], x1 + pad), min(a.shape[0], y1 + pad)
    rgb = a[y0:y1, x0:x1]
    white = rgb.min(axis=2) > 228
    lab, _ = ndi.label(white)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge))
    # Enclosed white gaps (between legs, inside a bow) are background too; small ones are highlights.
    sizes = ndi.sum(white, lab, index=np.arange(lab.max() + 1))
    bg |= white & (sizes[lab] > 250)
    # Drop the anti-aliased white fringe around the sprite.
    fringe = ndi.binary_dilation(bg, iterations=2) & (rgb.min(axis=2) > 200)
    alpha = (~(bg | fringe)).astype(np.float32)
    # Keep only the main object (neighbouring sprites can poke into the box).
    lab2, n2 = ndi.label(ndi.binary_dilation(alpha > 0, iterations=3))
    if n2 > 1:
        sizes2 = ndi.sum(alpha > 0, lab2, index=np.arange(1, n2 + 1))
        alpha[lab2 != 1 + int(np.argmax(sizes2))] = 0

    # Ground shadow: light, low-saturation grey in the lower part -> translucent dark.
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    lum = rgb.mean(axis=2)
    rows = np.arange(rgb.shape[0])[:, None] / rgb.shape[0]
    shadow = (alpha > 0) & (sat < 22) & (lum > 150) & (lum < 228) & (rows > 0.72)
    shadow = ndi.binary_opening(shadow, iterations=2)
    alpha[shadow] = 0.35
    rgb = rgb.copy()
    rgb[shadow] = (20, 16, 30)
    return rgb, alpha


def shrink(rgb: np.ndarray, alpha: np.ndarray, height: int, colors: int = 40) -> Image.Image:
    """Area-resize to the target height, then snap to a small palette and hard alpha."""
    ys, xs = np.nonzero(alpha)
    rgb, alpha = rgb[ys.min():ys.max() + 1, xs.min():xs.max() + 1], alpha[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h = height
    w = max(1, round(rgb.shape[1] * h / rgb.shape[0]))
    pre = np.dstack([rgb * alpha[..., None], alpha * 255]).astype(np.uint8)
    small = np.asarray(Image.fromarray(pre, 'RGBA').resize((w, h), Image.BOX)).astype(np.float32)
    a = small[..., 3] / 255
    col = np.where(a[..., None] > 0, small[..., :3] / np.maximum(a[..., None], 1e-3), 0)
    col = np.clip(col, 0, 255).astype(np.uint8)
    q = Image.fromarray(col, 'RGB').quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    out_a = np.where(a > 0.55, 255, np.where((a > 0.2) & (a < 0.45), 90, 0)).astype(np.uint8)
    # Pixels that were only shadow keep the soft shadow alpha.
    return Image.fromarray(np.dstack([np.asarray(q), out_a]), 'RGBA')


def sprite(name, box, height) -> Image.Image:
    return shrink(*cut(name, box), height)


def tile(name, box, w: int = 64, h: int = 32) -> Image.Image:
    """Samples the top diamond of an iso block (inset past its outline) into a w x h tile."""
    rgb, alpha = cut(name, box, pad=0)
    ys, xs = np.nonzero(alpha > 0.5)
    left_x, right_x, top_y = xs.min(), xs.max(), ys.min()
    left_y = ys[xs == left_x].min()
    right_y = ys[xs == right_x].min()
    top_x = int(np.median(xs[ys == top_y]))
    L, R, T = np.array([left_x, left_y], float), np.array([right_x, right_y], float), np.array([top_x, top_y], float)
    B = L + R - T
    C = (L + R + T + B) / 4
    inset = 0.9
    L, R, T, B = [C + (p - C) * inset for p in (L, R, T, B)]
    # Area-average the source down first so sampling is not noisy.
    scale = (R[0] - L[0]) / w
    src = Image.fromarray(rgb.astype(np.uint8)).resize((max(1, round(rgb.shape[1] / scale)), max(1, round(rgb.shape[0] / scale))), Image.BOX)
    s = np.asarray(src)
    out = np.zeros((h, w, 4), np.uint8)
    for y in range(h):
        half = (y + 1) * (w // h) if y < h // 2 else (h - y) * (w // h)
        for x in range(w // 2 - half, w // 2 + half):
            sx, sy = (x + 0.5 - w / 2) / (w / 2), (y + 0.5 - h / 2) / (h / 2)
            u, v = (sx + sy) / 2 + 0.5, (sy - sx) / 2 + 0.5  # u: toward R, v: toward L (from T)
            p = T + (R - T) * u + (L - T) * v
            px, py = int(p[0] / scale), int(p[1] / scale)
            out[y, x, :3] = s[min(py, s.shape[0] - 1), min(px, s.shape[1] - 1)]
            out[y, x, 3] = 255
    q = Image.fromarray(out[..., :3]).quantize(colors=24, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    return Image.fromarray(np.dstack([np.asarray(q), out[..., 3]]), 'RGBA')


def frames_same_canvas(frames: list[Image.Image]) -> list[Image.Image]:
    w = max(f.width for f in frames)
    h = max(f.height for f in frames)
    out = []
    for f in frames:
        c = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        c.paste(f, ((w - f.width) // 2, h - f.height))
        out.append(c)
    return out


def all_sprites() -> dict:
    out: dict = {}
    for key, (name, box, height) in SPRITES.items():
        out[key] = sprite(name, box, height)
    out['hero'] = frames_same_canvas([out.pop('hero_front'), out.pop('hero_back')])
    for key, (name, boxes, height) in ANIMS.items():
        frames = [sprite(name, b, height) for b in boxes]
        out[key] = frames_same_canvas(frames)
    for key, (name, box) in TILES.items():
        t = tile(name, box)
        # Mirrored copies break up the repeat (a mirrored diamond is still a diamond).
        out[key] = [t, t.transpose(Image.FLIP_LEFT_RIGHT), t.transpose(Image.ROTATE_180), t.transpose(Image.FLIP_TOP_BOTTOM)]
    for key, (name, box) in PORTRAITS.items():
        out[key] = shrink(*cut(name, box), 64)
    return out
