"""Characters: heroes, NPCs and monsters. Each humanoid has front/back x idle/walk frames."""
from __future__ import annotations

from PIL import Image
from pix import hexc, shade, from_rows, outline, overlay, hstack, pad, CLEAR

# Head shapes (14 wide). Face rows use S/s skin, E eyes. Back view swaps the face for hair.
HEAD_SHORT = [
    '....hHHHHh....',
    '..hHHKKHHHHh..',
    '.hHKKHHHHHHHh.',
    '.HHKHHHHHHHHh.',
    '.HHHHhHHHhHHh.',
    '.HhSSSSSSSShh.',
    '.hSSSSSSSSSSh.',
    '..SSESSSSESS..',
    '..SSESSSSESS..',
    '..sSSSSSSSSs..',
    '...sSSSSSSs...',
    '....ssssss....',
]
HEAD_LONG = [
    '....hHHHHh....',
    '..hHHKKHHHHh..',
    '.hHKKHHHHHHHh.',
    '.HHKHHHHHHHHh.',
    '.HHHHhHHHhHHh.',
    '.HHSSSSSSSSHh.',
    '.HhSSSSSSSSSh.',
    '.HSSESSSSESSh.',
    '.HSSESSSSESSh.',
    '.HhSSSSSSSShh.',
    '.HHsSSSSSSsHh.',
    '.HH.ssssss.Hh.',
]
HEAD_BEARD = [
    '....hHHHHh....',
    '..hHHKHHHHHh..',
    '.hHKHHHHHHHHh.',
    '.HHHHHHHHHHHh.',
    '.HhSSSSSSSShh.',
    '.hSSSSSSSSSSh.',
    '..SSESSSSESS..',
    '..SSESSSSESS..',
    '..sSSSSSSSSs..',
    '..dSddddddSd..',
    '...dddDDddd...',
    '....dddddd....',
]
HEAD_HOOD = [
    '....hHHHHh....',
    '..hHHKKHHHHh..',
    '.hHKKHHHHHHHh.',
    '.HHKHHHHHHHHh.',
    '.HHHhhhhhhHHh.',
    '.HHhxxxxxxhHh.',
    '.HhxxxxxxxxhH.',
    '.Hhxx%xx%xxhH.',
    '.Hhxx%xx%xxhH.',
    '.HhxxxxxxxxhH.',
    '.HHhxxxxxxhHh.',
    '..HHhhhhhhHH..',
]

BODY_TUNIC = [
    '...kCCCCCCc...',
    '..SkCCCCCCcS..',
    '..SkCCCCCCcS..',
    '..sBBBBbBBBs..',
    '...cCCCCCCc...',
]
BODY_ROBE = [
    '...kCCCCCCc...',
    '..SkCCCCCCcS..',
    '..SkCCCCCCcS..',
    '..sCBBbBBBCs..',
    '...kCCCCCCc...',
    '...kCCCCCCc...',
    '..kkCCCCCCcc..',
]
BODY_APRON = [
    '...kCCCCCCc...',
    '..SkAAAAAAcS..',
    '..SkAAAAAAcS..',
    '..sBAAAAAABs..',
    '...cAAAAAAc...',
]
BODY_CLOAK = [
    '..HHHHHHHHhh..',
    '.HHHHHHHHHHhh.',
    '.HHHHHHHHHHhh.',
    '.HHHHHHHHHHhh.',
    '.HHHHHHHHHHhh.',
    '..HHHHHHHHhh..',
]

LEGS = {
    'idle': ['...PPPppPPp...', '...PPp..PPp...', '...FFf..FFf...', '...FFf..FFf...'],
    'walk1': ['...PPPppPPp...', '...PPp..PPp...', '...FFf..PPp...', '........FFf...'],
    'walk2': ['...PPPppPPp...', '...PPp..PPp...', '...PPp..FFf...', '...FFf........'],
}
ROBE_FEET = {
    'idle': ['...FFf..FFf...'],
    'walk1': ['...FFf........'],
    'walk2': ['........FFf...'],
}


def to_back(rows: list[str]) -> list[str]:
    """Back view of a head: the face becomes hair (neck stays skin)."""
    out = []
    for i, r in enumerate(rows):
        if i >= len(rows) - 1:
            out.append(r)
            continue
        out.append(''.join(('H' if ch in 'SE%x' else 'h' if ch in 'sdD' else ch) if i >= 4 else ch for ch in r))
    return out


def body_back(rows: list[str]) -> list[str]:
    return [r.replace('b', 'B').replace('A', 'C').replace('k', 'C') for r in rows]


def humanoid(pal: dict[str, str], head=HEAD_SHORT, body=BODY_TUNIC, robe=False, props=None):
    """Returns {'front': [idle, walk1, walk2], 'back': [...]} as outlined RGBA images.

    props(view, img) may draw held items / accessories on top (img is padded 4px each side)."""
    p = {k: hexc(v) for k, v in pal.items()}
    for base, sh, li in (('H', 'h', 'K'), ('S', 's', None), ('C', 'c', 'k'), ('P', 'p', None), ('F', 'f', None), ('A', 'a', None), ('d', 'D', None)):
        if base in p:
            p.setdefault(sh, shade(p[base], -0.3))
            if li:
                p.setdefault(li, shade(p[base], 0.25))
    p.setdefault('E', hexc('#1a1420'))
    p.setdefault('B', hexc('#4a2c17'))
    p.setdefault('b', hexc('#e8c15a'))
    p.setdefault('x', hexc('#0e0a14'))
    p.setdefault('%', hexc('#ff3b3b'))
    out = {}
    for view in ('front', 'back'):
        frames = []
        h = head if view == 'front' else to_back(head)
        b = body if view == 'front' else body_back(body)
        for f in ('idle', 'walk1', 'walk2'):
            legs = ROBE_FEET[f] if robe else LEGS[f]
            im = from_rows(h + b + legs, p)
            im = pad(im, 4, 4, 4, 0)
            if props:
                im = props(view, im, f)
            frames.append(outline(im))
        out[view] = frames
    return out


def draw(im: Image.Image, pts: list[tuple[int, int]], color: str) -> Image.Image:
    px = im.load()
    c = hexc(color)
    for x, y in pts:
        if 0 <= x < im.width and 0 <= y < im.height:
            px[x, y] = c
    return im


# ------------------------------------------------------------ props (coords in padded 22-wide canvas)

def sword_back(view, im, f):
    # Hilt over the right shoulder (front) or blade across the back (back view).
    if view == 'front':
        draw(im, [(16, 14), (17, 13), (18, 12)], '#c9ccd6')
        draw(im, [(16, 15), (17, 15), (15, 14)], '#8a5a2b')
        draw(im, [(18, 11)], '#e8c15a')
    else:
        draw(im, [(5 + i, 22 - i) for i in range(11)], '#c9ccd6')
        draw(im, [(6 + i, 22 - i) for i in range(10)], '#8f93a3')
        draw(im, [(15, 13), (16, 12), (14, 12), (16, 14)], '#8a5a2b')
        draw(im, [(17, 11)], '#e8c15a')
    return im


def staff(color_top: str):
    def f(view, im, frame):
        x = 18 if view == 'front' else 3
        draw(im, [(x, y) for y in range(6, 27)], '#7a4a24')
        draw(im, [(x + 1, y) for y in range(8, 27)], '#5a3418')
        draw(im, [(x - 1, 5), (x, 4), (x + 1, 5), (x, 5), (x, 6), (x - 1, 6), (x + 1, 6)], color_top)
        draw(im, [(x, 4)], '#ffffff')
        return im
    return f


def hammer(view, im, f):
    x = 18 if view == 'front' else 3
    draw(im, [(x, y) for y in range(19, 27)], '#7a4a24')
    draw(im, [(x - 1, 17), (x, 17), (x + 1, 17), (x - 1, 18), (x, 18), (x + 1, 18), (x + 2, 17), (x + 2, 18)], '#6a6f7a')
    return im


def ears_wolf(view, im, f):
    draw(im, [(6, 3), (7, 2), (7, 3), (14, 3), (14, 2), (15, 3)], '#3a3a44')
    draw(im, [(7, 4), (14, 4)], '#d98b8b')
    if view == 'front':
        draw(im, [(15, 22), (16, 22), (16, 23), (15, 23)], '#c9ccd6')  # dagger at belt
        draw(im, [(16, 24)], '#c9ccd6')
        draw(im, [(6, 16), (7, 16), (8, 16), (9, 16), (10, 16), (11, 16), (12, 16), (13, 16), (14, 16), (15, 16)], '#a8332b')  # scarf
    return im


def ears_elf(view, im, f):
    draw(im, [(4, 13), (3, 12), (17, 13), (18, 12)], '#f1c9a0')
    if view == 'front':
        return staff('#7fe0ff')(view, im, f)
    return staff('#7fe0ff')(view, im, f)


def both(*fns):
    def f(view, im, frame):
        for fn in fns:
            im = fn(view, im, frame)
        return im
    return f


def humanoids():
    return {
        'hero': humanoid({'H': '#7a4426', 'S': '#f1c27d', 'C': '#3f7d3a', 'P': '#5b4a3a', 'F': '#4a2c17'}, props=sword_back),
        'hero_lyra': humanoid({'H': '#f2d27a', 'S': '#f6d3ad', 'C': '#2f6f9f', 'P': '#2a4f66', 'F': '#3a2a2a', 'B': '#c9a14a', 'b': '#7fe0ff'},
                              head=HEAD_LONG, body=BODY_ROBE, robe=True, props=ears_elf),
        'hero_rook': humanoid({'H': '#4a4a58', 'S': '#c98e5a', 'C': '#4a3c30', 'P': '#2e2a36', 'F': '#2a1e16'}, props=ears_wolf),
        'npc_elder': humanoid({'H': '#e8e8f0', 'S': '#efc7a0', 'C': '#6a4c93', 'P': '#4a3468', 'F': '#3a2a2a', 'B': '#c9a14a'},
                              head=HEAD_LONG, body=BODY_ROBE, robe=True, props=staff('#9fe36a')),
        'npc_smith': humanoid({'H': '#2a2a2a', 'S': '#d9a06a', 'C': '#7a7f8a', 'A': '#8a5a2b', 'P': '#444444', 'F': '#2a1e16', 'd': '#3a2a20'},
                              head=HEAD_BEARD, body=BODY_APRON, props=hammer),
        'npc_stranger': humanoid({'H': '#2b2238', 'S': '#2b2238', 'C': '#2b2238', 'P': '#1a1420', 'F': '#140f1a'},
                                 head=HEAD_HOOD, body=BODY_CLOAK, robe=True),
        'npc_villager': humanoid({'H': '#a0522d', 'S': '#f1c27d', 'C': '#b5651d', 'P': '#5b4a3a', 'F': '#4a2c17'}),
        'npc_villager2': humanoid({'H': '#d9a43a', 'S': '#f6d3ad', 'C': '#8f3a4a', 'P': '#3a3048', 'F': '#3a2a2a'}, head=HEAD_LONG, body=BODY_ROBE, robe=True),
    }


def slime():
    pal = {'A': hexc('#6fcf5a'), 'a': hexc('#4aa83f'), 'D': hexc('#2f7a2a'), 'W': hexc('#e8ffe0'), 'w': hexc('#b6f0a6'), 'E': hexc('#1a1420')}
    tall = [
        '.....AAAAAA.....',
        '...AAWWAAAAAA...',
        '..AAWwAAAAAAAa..',
        '.AAAwAAAAAAAAAa.',
        '.AAAAAAAAAAAAAa.',
        'AAAAAEAAAAEAAAAa',
        'AAAAAEAAAAEAAAAa',
        'AAAAAAAAAAAAAAaa',
        'aAAAAAAAAAAAAaaa',
        '.aaAAAAAAAAAaaD.',
        '..DDaaaaaaaaDD..',
    ]
    squash = [
        '....AAAAAAAA....',
        '..AAWWAAAAAAAA..',
        '.AAWwAAAAAAAAAa.',
        'AAAwAEAAAAEAAAAa',
        'AAAAAEAAAAEAAAAa',
        'AAAAAAAAAAAAAAaa',
        'aAAAAAAAAAAAAaaa',
        '.aaaAAAAAAAaaaD.',
        '..DDDaaaaaaDDD..',
    ]
    return [outline(from_rows(tall, pal)), outline(pad(from_rows(squash, pal), 0, 2, 0, 0))]


def wolf():
    pal = {'G': hexc('#7d7d8a'), 'g': hexc('#5c5c6a'), 'L': hexc('#b5b5c0'), 'E': hexc('#ffd23b'), 'N': hexc('#1a1420'),
           'T': hexc('#6a6a76'), 'D': hexc('#3a3a44'), 'M': hexc('#c94a4a')}
    body = [
        '..............G..G...',
        '.............GGGGG...',
        'TT..........GGGGEGN..',
        '.TTgGGGGGGGGGGGGGGGN.',
        '..TGGGGGGGGGGGGGGLM..',
        '...gGGGGGGGGGGGGLL...',
        '...gGGLLLLLLLGGGg....',
        '...ggLLLLLLLLLgg.....',
    ]
    legs1 = ['...gg.gg...gg..gg....', '...gg.gg...gg..gg....', '...DD.DD...DD..DD....']
    legs2 = ['....gg.gg.gg..gg.....', '...gg...gg.gg...gg...', '...DD...DD.DD...DD...']
    return [outline(from_rows(body + legs1, pal)), outline(from_rows(body + legs2, pal))]


def all_sprites() -> dict[str, Image.Image]:
    out: dict[str, Image.Image] = {}
    for key, views in humanoids().items():
        # Sheet layout: front idle, front walk1, front walk2, back idle, back walk1, back walk2
        out[key] = views["front"] + views["back"]
    out["slime"] = slime()
    out["wolf"] = wolf()
    return out
