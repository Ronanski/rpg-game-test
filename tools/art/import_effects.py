"""Cuts weapon and skill effects out of the effects board (art/raw/sheet_effects.webp).

The board paints soft glows on white, so each pixel's distance from white becomes its opacity and
the white is taken back out of its colour: glows stay soft instead of getting a white box around them.
"""
from pathlib import Path

import numpy as np
from PIL import Image

RAW = Path(__file__).resolve().parents[2] / 'art' / 'raw'

# Board boxes (x0, y0, x1, y1) of the effects the game uses.
EFFECTS = {
    'fx_slash_fire': (843, 25, 880, 68),   # flame blade arc (heavy hits)
    'fx_hit': (1028, 85, 1078, 137),       # impact star
    'fx_heal': (718, 218, 768, 265),       # green ring with crosses
    'fx_fireball': (686, 583, 725, 617),   # mage firebolt
    'fx_burst': (725, 586, 765, 627),      # fire explosion
    'fx_explode': (1078, 522, 1117, 556),  # explosive burst
}


def effects() -> dict:
    im = Image.open(RAW / 'sheet_effects.webp').convert('RGBA')
    white = Image.new('RGBA', im.size, (255, 255, 255, 255))
    white.alpha_composite(im)
    a = np.asarray(white.convert('RGB')).astype(np.float32)
    out = {}
    for key, (x0, y0, x1, y1) in EFFECTS.items():
        c = a[y0:y1, x0:x1]
        # Soft glows on the board are faint; lift them so they read over grass.
        alpha = np.clip(((255 - c).max(axis=2) / 255) ** 0.55 * 1.15, 0, 1)
        alpha[alpha < 0.08] = 0
        safe = np.maximum(alpha, 1e-3)[..., None]
        col = np.clip((c - 255 * (1 - safe)) / safe, 0, 255)
        rgba = np.dstack([col, alpha * 255]).astype(np.uint8)
        img = Image.fromarray(rgba, 'RGBA')
        out[key] = img.crop(img.getbbox())
    # The board's blue sword arcs overlap the hero drawn with them, so the clean flame arc is
    # recoloured cool white-blue for normal sword swings.
    f = np.asarray(out['fx_slash_fire']).astype(np.float32)
    lum = f[..., :3].mean(axis=2, keepdims=True)
    blue = np.clip(lum * np.array([0.75, 0.92, 1.25]) + np.array([10, 25, 45]), 0, 255)
    out['fx_slash'] = Image.fromarray(np.dstack([blue, f[..., 3:]]).astype(np.uint8), 'RGBA')
    return out
