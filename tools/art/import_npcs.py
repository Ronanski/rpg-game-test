"""Cuts the NPC animation board (left half of art/raw/sheet_npc_monsters.webp) into spritesheets.

Frame layout the game relies on: 0 idle, 1-3 walk, 4 talking.
The board changes faces and clothes between some poses, so only the rows that stay the same person
are used, and only their first idle pose, the walk and the first talking pose. (Work poses share the
cell with a table and a customer; townsfolk don't fight, so attack, hurt and dying are not used.)
"""
from pathlib import Path

import numpy as np
from PIL import Image

from import_monsters import _cell, _split
from import_sheets import shrink

RAW = Path(__file__).resolve().parents[2] / 'art' / 'raw'

COLS = {'idle': (89, 172), 'walk': (174, 283), 'talk': (285, 371), 'hurt': (570, 647)}
ROWS = {
    'npcanim_villager_m': (76, 174), 'npcanim_villager_f': (175, 281),
    'npcanim_guard': (387, 503), 'npcanim_farmer': (736, 856), 'npcanim_innkeeper': (856, 974),
}
HEIGHT = 52  # standing height in game pixels
WANT = {'idle': 1, 'walk': 3, 'talk': 1}


def npc_anims() -> dict:
    a = np.asarray(Image.open(RAW / 'sheet_npc_monsters.webp').convert('RGB')).astype(np.float32)
    out = {}
    for key, (y0, y1) in ROWS.items():
        cells = {c: _cell(a, x0, x1, y0, y1, grounded=True) for c, (x0, x1) in COLS.items()}
        ref_w = min(rgb.shape[1] for c in ('hurt', 'idle') for rgb, _ in cells[c])
        picks = []
        for c, n in WANT.items():
            parts = [p for rgb, al in cells[c] for p in _split(rgb, al, ref_w)]
            parts = (parts * n)[:n] if parts else picks[:n]
            picks += parts
        if key == 'npcanim_farmer':
            picks[4] = picks[0]  # the board's talking farmer is someone else
        scale = HEIGHT / picks[0][0].shape[0]
        frames = [shrink(rgb, al, max(6, round(rgb.shape[0] * scale))) for rgb, al in picks]
        w = max(f.width for f in frames) + 2
        h = max(f.height for f in frames)
        canvas = []
        for f in frames:
            c = Image.new('RGBA', (w, h), (0, 0, 0, 0))
            c.paste(f, ((w - f.width) // 2, h - f.height))
            canvas.append(c)
        out[key] = canvas
    return out
