"""Builds every game art asset and the starter world data.

    python3 tools/art/build.py

Outputs:
  public/assets/art/*.png       ground layer + sprites (art-pixel resolution, shown at 2x)
  src/assets/manifest.json      sprite sizes and ground anchors
  src/world/starter.json        world layout used by the game (tiles, collision, props, NPCs)
"""
import json, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import world, ground, props, chars

ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'public', 'assets', 'art')
os.makedirs(OUT, exist_ok=True)
manifest = {}


def save(key, rgba, anchor):
    Image.fromarray(rgba, 'RGBA').save(os.path.join(OUT, key + '.png'), optimize=True)
    h, w = rgba.shape[:2]
    manifest[key] = {'w': w, 'h': h, 'ax': anchor[0], 'ay': anchor[1]}


w = world.build()
img, alpha, origin = ground.bake(w)
img = ground.shadows(img, w, origin)
save('ground', np.dstack([img, alpha]), origin)

for v in range(3):
    save(f'tree{v}', *props.tree(v, 11 + v))
    save(f'rock{v}', *props.rock(v, 21 + v))
for v in range(2):
    save(f'bush{v}', *props.bush(v, 31 + v))
    save(f'house{v}', *props.house(v, 41 + v))
save('post0', *props.post())

hero_front = chars.walk_frames(chars.render(chars.HUMAN_FRONT, chars.HERO))
hero_back = chars.walk_frames(chars.render(chars.HUMAN_BACK, chars.HERO))
foot = lambda a: (a.shape[1] // 2, a.shape[0] - 1)
for i, f in enumerate(hero_front): save(f'hero_front_{i}', f, foot(f))
for i, f in enumerate(hero_back): save(f'hero_back_{i}', f, foot(f))
for key, rows, pal in (('npc_elder', chars.robe(chars.HUMAN_FRONT), chars.ELDER),
                       ('npc_smith', chars.HUMAN_FRONT, chars.SMITH),
                       ('npc_stranger', chars.robe(chars.hood(chars.HUMAN_FRONT)), chars.STRANGER)):
    a = chars.render(rows, pal); save(key, a, foot(a))
for i in range(2):
    a = chars.slime(i); save(f'slime_{i}', a, foot(a))
for i, a in enumerate(chars.wolf_frames()): save(f'wolf_{i}', a, (a.shape[1] // 2, a.shape[0] - 1))

with open(os.path.join(ROOT, 'src', 'assets', 'manifest.json'), 'w') as f:
    json.dump(manifest, f, indent=1)
w['groundOrigin'] = {'x': origin[0], 'y': origin[1]}
with open(os.path.join(ROOT, 'src', 'world', 'starter.json'), 'w') as f:
    json.dump(w, f, separators=(',', ':'))
print(f'{len(manifest)} sprites -> {OUT}')
