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
import import_sheets  # noqa: E402
import import_monsters  # noqa: E402
import import_buildings  # noqa: E402
import import_npcs  # noqa: E402
import import_effects  # noqa: E402
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
    # The owner's sheets in art/raw/ replace the code-drawn versions where they exist.
    imported = import_sheets.all_sprites()
    monsters = import_monsters.monster_anims()
    imported.update(monsters)
    imported.update(import_buildings.building_levels())
    imported.update(import_effects.effects())
    npcs = import_npcs.npc_anims()
    imported.update(npcs)
    sprites.update(imported)
    manifest = []
    for key, art in sorted(sprites.items()):
        im = hstack(art) if isinstance(art, list) else art
        im.save(OUT / f'{key}.png')
        # Code-drawn art is made at half size and shown at 2x; imported art is already full size.
        entry = {'key': key, 'w': im.width, 'h': im.height, 'scale': 1 if key in imported else 2}
        if key in imported:
            entry['imported'] = True
        if isinstance(art, list):
            entry['frameWidth'] = im.width // len(art)
        if key in npcs:
            entry['nanim'] = True  # townsperson: 0 idle, 1-3 walk, 4 talking
        if key in monsters:
            entry['manim'] = True  # monster: 0-1 idle, 2-3 attack, 4 hurt, 5-6 dying (gets the game's shadow)
        if key.startswith('anim_'):
            entry['anim'] = True  # frame-by-frame hero: idle, 5 walk, wind-up, strike, hurt
        manifest.append(entry)
    (ROOT / 'src' / 'assets' / 'spriteManifest.json').write_text(json.dumps(manifest, indent=1) + '\n')
    print(f'wrote {len(manifest)} sprites to {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
