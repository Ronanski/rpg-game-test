"""Cuts the monster animation board (art/raw/sheet_npc_monsters.webp, right half) into spritesheets.

Each monster becomes one sheet with a fixed frame layout the game relies on:
0-1 idle (also used while walking), 2 attack wind-up, 3 attack strike, 4 hurt, 5-6 dying.
The board's walk frames overlap each other, so they are not used.
"""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

from import_sheets import shrink

RAW = Path(__file__).resolve().parents[2] / 'art' / 'raw'

# Grid of the board (pixels): columns idle, walk, attack, skill, hurt, die; one row per monster.
COLS = {'idle': (850, 937), 'attack': (1050, 1173), 'hurt': (1305, 1398), 'die': (1401, 1530)}
ROWS = {
    'slime': (76, 144), 'slime_blue': (146, 214), 'slime_red': (216, 285), 'goblin': (287, 352),
    # (The wolves on the board overlap too much to cut apart; the game keeps the single-picture wolf.)
    'orc': (355, 428), 'skeleton': (507, 579), 'zombie': (582, 655),
    'bat': (657, 728), 'spider': (730, 797),
    # The dragons spill over their cells on the board; the game keeps the single-picture dragon.
}
# Height in game pixels of the idle pose (close to the old single-picture monsters).
HEIGHT = {
    'slime': 26, 'slime_blue': 28, 'slime_red': 28, 'goblin': 46, 'orc': 66, 'skeleton': 54,
    'zombie': 50, 'bat': 30, 'spider': 30,
}


def _split(rgb: np.ndarray, al: np.ndarray, ref_w: float):
    """Two (or more) sprites drawn touching each other: cut them apart at the emptiest columns."""
    n = int(round(rgb.shape[1] / ref_w))
    if n < 2 or rgb.shape[1] < 1.6 * ref_w:
        return [(rgb, al)]
    mass = al.sum(axis=0)
    cuts, prev = [], 0
    for k in range(1, n):
        guess = rgb.shape[1] * k // n
        lo, hi = max(prev + 4, guess - int(ref_w * 0.35)), min(rgb.shape[1] - 4, guess + int(ref_w * 0.35))
        cut = lo + int(np.argmin(mass[lo:hi])) if hi > lo else guess
        cuts.append(cut)
        prev = cut
    out, x0 = [], 0
    for c in cuts + [rgb.shape[1]]:
        part = al[:, x0:c]
        ys, xs = np.nonzero(part)
        if len(ys):
            out.append((rgb[ys.min():ys.max() + 1, x0 + xs.min():x0 + xs.max() + 1], part[ys.min():ys.max() + 1, xs.min():xs.max() + 1]))
        x0 = c
    return out


def _cell(a: np.ndarray, x0, x1, y0, y1, grounded: bool = False):
    """Sprites in one grid cell, left to right: list of (rgb, alpha) crops.
    `grounded` drops bits floating in the top half (speech bubbles over NPCs)."""
    pad = 3
    rgb = a[y0 + pad:y1 - pad, x0 + pad:x1 - pad]
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    bg = np.median(border, axis=0)
    diff = np.abs(rgb - bg).max(axis=2)
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    lum = rgb.mean(axis=2)
    solid = diff > 34
    # Soft grey ground shadows and the pale board tint around sprites are not part of them.
    solid &= ~((sat < 26) & (lum > 150) & (diff < 80))
    solid = ndi.binary_opening(solid, iterations=1) | (diff > 90)
    lab, n = ndi.label(ndi.binary_dilation(solid, iterations=1))
    if n == 0:
        return []
    sizes = ndi.sum(solid, lab, index=np.arange(1, n + 1))
    objs = ndi.find_objects(lab)
    if grounded:
        for i, o in enumerate(objs):
            if o[0].stop < rgb.shape[0] * 0.55:
                sizes[i] = 0
    big = [i for i in range(n) if sizes[i] >= max(60, sizes.max() * 0.25)]
    # Small bits (effects, sparks) join the nearest big sprite.
    groups = {i: [i] for i in big}
    for i in range(n):
        if i in groups or sizes[i] < 6 or not big:
            continue
        cx = (objs[i][1].start + objs[i][1].stop) / 2
        j = min(big, key=lambda b: abs((objs[b][1].start + objs[b][1].stop) / 2 - cx))
        groups[j].append(i)
    out = []
    for i in sorted(big, key=lambda b: objs[b][1].start):
        m = np.isin(lab, [k + 1 for k in groups[i]]) & solid
        # Pale parts fully inside a sprite (aprons, highlights) close to the board colour stay solid.
        if grounded:
            m = ndi.binary_fill_holes(m)
        ys, xs = np.nonzero(m)
        crop = (slice(ys.min(), ys.max() + 1), slice(xs.min(), xs.max() + 1))
        out.append((rgb[crop], m[crop].astype(np.float32)))
    return out


def monster_anims() -> dict:
    a = np.asarray(Image.open(RAW / 'sheet_npc_monsters.webp').convert('RGB')).astype(np.float32)
    out = {}
    for key, (y0, y1) in ROWS.items():
        cells = {c: _cell(a, x0, x1, y0, y1) for c, (x0, x1) in COLS.items()}
        # One sprite's width: the narrowest whole sprite on the row (hurt and idle poses stand alone).
        ref_w = min(rgb.shape[1] for c in ('hurt', 'idle') for rgb, _ in cells[c])
        # The idle pair is often drawn touching.
        cells['idle'] = [p for rgb, al in cells['idle'] for p in _split(rgb, al, ref_w)]
        idle = cells['idle'][:2]
        if len(idle) < 2:
            idle = idle * 2
        atk = (cells['attack'] + cells['attack'])[:2]
        hurt = cells['hurt'][:1] or idle[:1]
        die = cells['die'][-2:] if len(cells['die']) >= 2 else (cells['die'] * 2)[:2]
        picks = idle + atk + hurt + die
        scale = HEIGHT[key] / idle[0][0].shape[0]
        frames = [shrink(rgb, al, max(6, round(rgb.shape[0] * scale))) for rgb, al in picks]
        # Same canvas for every frame, feet at the bottom centre.
        w = max(f.width for f in frames) + 2
        h = max(f.height for f in frames)
        canvas = []
        for f in frames:
            c = Image.new('RGBA', (w, h), (0, 0, 0, 0))
            c.paste(f, ((w - f.width) // 2, h - f.height))
            canvas.append(c)
        out[key] = canvas
    return out
