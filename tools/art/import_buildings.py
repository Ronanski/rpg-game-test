"""Cuts the building levels board (art/raw/sheet_building_levels.webp) into building sprites.

The board has 7 rows (one building each) of 8 stages: an empty plot, the wooden frame going up,
then six finished looks from simple to grand. The game uses the frame while a building is under
construction and three of the finished looks as its levels.
"""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

from import_sheets import shrink

RAW = Path(__file__).resolve().parents[2] / 'art' / 'raw'

ROW_CUTS = [0, 150, 282, 436, 592, 733, 863, 1024]
COL_CUTS = [0, 160, 337, 519, 719, 936, 1152, 1352, 1536]

# Board row -> (name, which stages to keep, width in game pixels of the first kept stage).
ROWS = {
    0: ('hut', [1, 2], 96),
    1: ('workshop', [1, 2, 4, 6], 104),
    2: ('tower', [1, 3, 5, 7], 70),
    3: ('forge', [1, 3, 5, 7], 104),
    4: ('farm', [1, 3, 5, 7], 110),
    6: ('crystal', [1, 3, 5, 7], 104),
}


def _cell(a: np.ndarray, x0, x1, y0, y1):
    rgb = a[y0:y1, x0:x1]
    solid = rgb.min(axis=2) < 238
    lab, n = ndi.label(ndi.binary_dilation(solid, iterations=2))
    sizes = ndi.sum(solid, lab, index=np.arange(1, n + 1))
    main = 1 + int(np.argmax(sizes))
    objs = ndi.find_objects(lab)
    o = objs[main - 1]
    keep = [main]
    # Bits that belong to the building (a flag, smoke) sit inside its box; neighbours poke in at the edges.
    for i, ob in enumerate(objs):
        cy, cx = (ob[0].start + ob[0].stop) / 2, (ob[1].start + ob[1].stop) / 2
        if i + 1 != main and o[1].start <= cx <= o[1].stop and o[0].start - 20 <= cy <= o[0].stop and sizes[i] > 20:
            keep.append(i + 1)
    m = np.isin(lab, keep) & solid
    # Fill pale highlights enclosed by the building (windows, glints) so they don't become holes.
    m = ndi.binary_fill_holes(m)
    ys, xs = np.nonzero(m)
    crop = (slice(ys.min(), ys.max() + 1), slice(xs.min(), xs.max() + 1))
    return rgb[crop], m[crop].astype(np.float32)


def building_levels() -> dict:
    a = np.asarray(Image.open(RAW / 'sheet_building_levels.webp').convert('RGB')).astype(np.float32)
    out = {}
    for r, (name, stages, width) in ROWS.items():
        y0, y1 = ROW_CUTS[r], ROW_CUTS[r + 1]
        cells = {c: _cell(a, COL_CUTS[c], COL_CUTS[c + 1], y0, y1) for c in stages}
        # One scale per building, so later levels are drawn bigger than early ones.
        scale = width / cells[stages[1]][0].shape[1]
        for c, (rgb, al) in cells.items():
            out[f'bl_{name}_{c}'] = shrink(rgb, al, max(8, round(rgb.shape[0] * scale)), colors=64)
    return out
