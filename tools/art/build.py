"""Builds every game sprite into public/assets/sprites and writes a manifest the game loads.

Run from the repo root:  python3 tools/art/build.py
The art is drawn here in code (pixel by pixel), so it can be tweaked and rebuilt any time.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
import characters  # noqa: E402
import environment  # noqa: E402
import ui  # noqa: E402
from pix import hstack  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public' / 'assets' / 'sprites'

# A sprite given as a list of frames becomes a sheet laid out left to right.
# Humanoid sheets have 6 frames: front idle/walk1/walk2, back idle/walk1/walk2.


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    sprites = {}
    sprites.update(environment.all_sprites())
    sprites.update(characters.all_sprites())
    sprites.update(ui.all_sprites())
    manifest = []
    for key, art in sorted(sprites.items()):
        im = hstack(art) if isinstance(art, list) else art
        im.save(OUT / f'{key}.png')
        entry = {'key': key, 'w': im.width, 'h': im.height}
        if isinstance(art, list):
            entry['frameWidth'] = im.width // len(art)
        manifest.append(entry)
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=1) + '\n')
    print(f'wrote {len(manifest)} sprites to {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
