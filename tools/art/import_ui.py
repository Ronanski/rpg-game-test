"""Cuts HUD art out of the owner's UI kit (art/raw/sheet_ui_kit.webp, transparent background).

- the round mini-map frame (its painted map is cleared so the game draws the real one inside)
- zoom + / - and the expand button
- the menu icons (Items, Skills, ... System)
- map pins (location, side quest, quest, ..., turn-in, star)
The kit is drawn large and smooth, so pieces are resized smoothly to game size here.
"""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

RAW = Path(__file__).resolve().parents[2] / 'art' / 'raw'

RING = {'centre': (543, 318), 'inner': 132, 'outer': 174, 'size': 132}
# Inner radius of the cleared ring in game pixels (the mini-map is drawn inside it).
RING_INNER = round(RING['inner'] * RING['size'] / (2 * RING['outer']))
BUTTONS = {'ui_btn_plus': (1458, 576, 1512, 626), 'ui_btn_minus': (1391, 633, 1443, 684), 'ui_btn_expand': (1391, 576, 1443, 626)}
ICON_ROW = (399, 874, 1328, 964)
ICONS = ['items', 'skills', 'equipment', 'quests', 'map', 'status', 'party', 'crafting', 'codex', 'save', 'settings', 'system']
PINS = {
    'pin_location': (381, 494, 440, 578), 'pin_side': (455, 494, 512, 578), 'pin_quest': (530, 495, 587, 578),
    'pin_grey': (606, 495, 663, 578), 'pin_purple': (681, 495, 740, 578), 'pin_turnin': (760, 495, 817, 578),
    'pin_star': (833, 495, 899, 578),
}


def _fit(im: Image.Image, h: int) -> Image.Image:
    im = im.crop(im.getbbox())
    return im.resize((max(1, round(im.width * h / im.height)), h), Image.LANCZOS)


def ui_parts() -> dict:
    kit = Image.open(RAW / 'sheet_ui_kit.webp').convert('RGBA')
    out = {}
    # Mini-map frame: keep only the ring band and its compass points.
    cx, cy = RING['centre']
    ring = np.asarray(kit.crop((cx - RING['outer'], cy - RING['outer'], cx + RING['outer'], cy + RING['outer']))).copy()
    yy, xx = np.mgrid[0:ring.shape[0], 0:ring.shape[1]]
    d = np.hypot(xx - RING['outer'], yy - RING['outer'])
    ring[(d < RING['inner']) | (d > RING['outer']), 3] = 0
    # Outside the ring band only the four compass points stay (the zoom slider touches the E point).
    dx, dy = np.abs(xx - RING['outer']), np.abs(yy - RING['outer'])
    ring[(d > 156) & (dx > 20) & (dy > 20), 3] = 0
    # Drop bits of the zoom slider and corner buttons that poke into the square: keep the ring itself.
    lab, n = ndi.label(ring[..., 3] > 30)
    if n > 1:
        sizes = ndi.sum(ring[..., 3] > 30, lab, index=np.arange(1, n + 1))
        ring[lab != 1 + int(np.argmax(sizes)), 3] = 0
    out['ui_minimap_ring'] = Image.fromarray(ring, 'RGBA').resize((RING['size'], RING['size']), Image.LANCZOS)
    for key, box in BUTTONS.items():
        out[key] = _fit(kit.crop(box), 40)
    rx0, ry0, rx1, ry1 = ICON_ROW
    step = (rx1 - rx0) / len(ICONS)
    for i, name in enumerate(ICONS):
        out[f'icon_{name}'] = _fit(kit.crop((round(rx0 + i * step), ry0, round(rx0 + (i + 1) * step), ry1)), 48)
    for key, box in PINS.items():
        out[key] = _fit(kit.crop(box), 26)
    return out
