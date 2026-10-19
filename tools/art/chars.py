"""Character sprites, hand-authored as pixel grids with per-character palettes.
Hero gets 4 walk frames facing the viewer and 4 facing away."""
import numpy as np
from common import hexc, PAL, value_noise, BAYER4, outline_alpha

HUMAN_FRONT = [
    "......OOOOOO......",
    "....OOjjjhhhOO....",
    "...OhjjhhhhhhHO...",
    "..OHjhhhhhhhhhHO..",
    "..OHhhSShhSShhHO..",
    "..OHSSSSSSSSSSHO..",
    "..OHSEESSSSEESHO..",
    "..OhSEwSSSSEwShO..",
    "...OSSSSssSSSSO...",
    "....OOSSSSSSOO....",
    "....OCcGkkGcCO....",
    "...OCcGkkkkGcCO...",
    "..OSOGkkggkkGOSO..",
    "..OSOGggggggGOSO..",
    "..OsOBBBbbBBBOsO..",
    "...OOGgggggGGOO...",
    "....OGggOggGO.....",
    "....OLLlOlLLO.....",
    "....OLLlOlLLO.....",
    "....OLLLOLLLO.....",
    "....OFFfOfFFO.....",
    "...OFFFfOfFFFO....",
    "...OOOOOOOOOOO....",
]

HUMAN_BACK = [
    "......OOOOOO......",
    "....OOjjjhhhOO....",
    "...OhjjhhhhhhHO...",
    "..OHjhhhhhhhhhHO..",
    "..OHhjhhhhhjhhHO..",
    "..OHhhhhhhhhhhHO..",
    "..OHhhjhhhhhhhHO..",
    "..OHhhhhhhhhhhHO..",
    "...OHhhhhhhhhHO...",
    "....OOHHHHHHOO....",
    "....OCcCMcCcCO....",
    "...OCcCcCMcCcCO...",
    "..OSOcCcCcMcCOSO..",
    "..OSOCcCcCcRCOSO..",
    "..OsOBBBBBBBROsO..",
    "...OOCcCcCcCCOO...",
    "....OCcCOCcCO.....",
    "....OLLlOlLLO.....",
    "....OLLlOlLLO.....",
    "....OLLLOLLLO.....",
    "....OFFfOfFFO.....",
    "...OFFFfOfFFFO....",
    "...OOOOOOOOOOO....",
]

BASE = {
    'O': '#140e18', 'S': '#f0c08a', 's': '#c88a5c', 'E': '#2a1a20', 'w': '#ffffff',
    'B': '#4a2c17', 'b': '#e8c35a', 'L': '#4e4436', 'l': '#6a5c48', 'F': '#3a2412', 'f': '#5a3a20',
    'M': '#b5bcc6', 'R': '#6e4429',
}
HERO = {**BASE, 'H': '#5a3018', 'h': '#8a4a24', 'j': '#b46a34',
        'G': '#2a5a2e', 'g': '#3f7d3a', 'k': '#5e9a44', 'C': '#3e4a2a', 'c': '#5a6a3a'}
ELDER = {**BASE, 'H': '#9a9aa8', 'h': '#d8d8e0', 'j': '#ffffff',
         'G': '#3e2a5e', 'g': '#5a3e88', 'k': '#7a5ab0', 'C': '#3e2a5e', 'c': '#5a3e88',
         'L': '#5a3e88', 'l': '#7a5ab0', 'F': '#3e2a5e', 'f': '#5a3e88', 'B': '#c8a050', 'b': '#f2d06a'}
SMITH = {**BASE, 'H': '#16161c', 'h': '#2c2c36', 'j': '#44444f', 'S': '#d8a070', 's': '#a8704a',
         'G': '#4a3020', 'g': '#6e4429', 'k': '#8e5c35', 'C': '#7a7a86', 'c': '#a0a0ac', 'L': '#3a3a44', 'l': '#55555f'}
STRANGER = {**BASE, 'H': '#120e1a', 'h': '#241c33', 'j': '#2e2440', 'S': '#0e0a14', 's': '#0e0a14', 'E': '#ff3b3b', 'w': '#ff9a7a',
            'G': '#1c1626', 'g': '#2b2238', 'k': '#3a2e4a', 'C': '#1c1626', 'c': '#2b2238',
            'L': '#1c1626', 'l': '#2b2238', 'F': '#120e1a', 'f': '#1c1626', 'B': '#3a2e4a', 'b': '#7a5ab0'}


def render(rows, pal):
    h, w = len(rows), len(rows[0])
    assert all(len(r) == w for r in rows), [len(r) for r in rows]
    out = np.zeros((h, w, 4), dtype=np.uint8)
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != '.':
                out[y, x, :3] = hexc(pal[ch]); out[y, x, 3] = 255
    return out


def walk_frames(img, leg_top=16):
    """4-frame walk cycle: neutral, right leg up + bob, neutral, left leg up + bob."""
    def lift(src, x0, x1):
        f = src.copy()
        region = src[leg_top:, x0:x1].copy()
        f[leg_top:, x0:x1] = 0
        f[leg_top - 1:-1, x0:x1][region[..., 3] > 0] = region[region[..., 3] > 0]
        return f
    def bob(src):
        f = np.zeros_like(src); f[1:, :] = src[:-1, :]
        f[leg_top + 1:] = src[leg_top + 1:]          # feet stay planted, body dips
        return f
    a = bob(lift(img, 9, 14)); b = bob(lift(img, 3, 9))
    return [img, a, img, b]


def robe(rows):
    """Long robe: replace legs with a flared skirt (elder, stranger)."""
    r = list(rows)
    r[16] = "....OGggggggGO...."
    r[17] = "....OGgggkggGO...."
    r[18] = "...OGggggkgggGO..."
    r[19] = "...OGgggggkggGO..."
    r[20] = "..OGGgggggggggGO.."
    r[21] = "..OFFfOOOOOOfFFO.."
    r[22] = "..OOOOO....OOOOO.."
    return r


def hood(rows):
    r = list(rows)
    r[0] = "......OOOOOO......"
    r[1] = "....OOhhhhhhOO...."
    r[2] = "...OhhjjjjjjhHO..."
    r[3] = "..OHhjhhhhhhjhHO.."
    r[4] = "..OHhSSSSSSSShHO.."
    return r


def slime(frame):
    W, H = 18, 14
    c = np.zeros((H, W, 4), dtype=np.uint8)
    sq = 1.0 if frame == 0 else 0.86
    cx, cy, rx, ry = 9, 13 - 6 * sq, 8 if frame == 0 else 8.6, 6 * sq
    ys, xs = np.mgrid[0:H, 0:W]
    dx = (xs - cx) / rx; dy = (ys - cy) / ry
    inside = (dx * dx + dy * dy <= 1) & (ys <= 12)
    nz = np.sqrt(np.clip(1 - dx * dx - dy * dy, 0, 1))
    b = -0.55 * dx - 0.75 * dy + 0.6 * nz
    pal = [hexc(h) for h in ('#1f5a2c', '#2f8a3a', '#4fb84a', '#7fdc6a', '#c8f5b0')]
    lvl = np.clip(np.floor((b + 0.4) / 1.4 * 4 + (BAYER4[ys % 4, xs % 4] - 0.5) * 0.4), 0, 3).astype(int)
    c[inside, :3] = np.array(pal)[lvl][inside]; c[inside, 3] = 255
    c[12, :, :3][c[12, :, 3] > 0] = pal[0]
    hx, hy = int(cx - rx * 0.45), int(cy - ry * 0.5)
    c[hy, hx, :3] = pal[4]; c[hy, hx + 1, :3] = pal[4]; c[hy + 1, hx, :3] = pal[4]
    ey = int(cy + ry * 0.05)
    for ex in (int(cx - 2), int(cx + 2)):
        c[ey, ex, :3] = hexc('#10141a'); c[ey - 1, ex, :3] = hexc('#10141a')
        c[ey - 1, ex + 0, :3] = hexc('#ffffff') if False else c[ey - 1, ex, :3]
    return outline_alpha(c, hexc('#0e2416'))


WOLF = [
    "......................O.O...",
    ".....................OgOgO..",
    "....................OgGGGGO.",
    "...OO..............OGGGyGGGO",
    "..OgGO.............OGGGGGGNO",
    "..OgGGOOOOOOOOOOOOOGGGGlllO.",
    "...OGGgggggggggggggGGGlllO..",
    "...OGGGgggggggggggGGGGllO...",
    "...OGGGGGGGGGGGGGGGGGGlO....",
    "...OlGGGGGGGGGGGGGGGGGO.....",
    "...OlllGGOOOOOOOOGGllO......",
    "....OGGGO.......OGGGO.......",
    "....OGGO........OGGO........",
    "....OGGO........OGGO........",
    "....ODDDO.......ODDDO.......",
    "....OOOOO.......OOOOO.......",
]
WOLF_PAL = {'O': '#16161e', 'G': '#6e6e7c', 'g': '#9a9aa8', 'l': '#c8c8d2', 'D': '#3a3a44', 'y': '#ffd23b', 'N': '#0a0a0e'}


def wolf_frames():
    a = render(WOLF, WOLF_PAL)
    b = a.copy()
    # stride: swap leg heights
    b[11:, 3:10] = 0; b[10:15, 3:10] = a[11:16, 3:10]
    return [a, b]


if __name__ == '__main__':
    import sys
    from PIL import Image
    hero_f = walk_frames(render(HUMAN_FRONT, HERO)); hero_b = walk_frames(render(HUMAN_BACK, HERO))
    imgs = hero_f + hero_b + [render(robe(HUMAN_FRONT), ELDER), render(HUMAN_FRONT, SMITH), render(robe(hood(HUMAN_FRONT)), STRANGER), slime(0), slime(1)] + wolf_frames()
    Wt = sum(i.shape[1] + 3 for i in imgs); Ht = max(i.shape[0] for i in imgs)
    sheet = Image.new('RGBA', (Wt, Ht), (90, 140, 70, 255)); x = 0
    for a in imgs:
        sheet.alpha_composite(Image.fromarray(a, 'RGBA'), (x, Ht - a.shape[0])); x += a.shape[1] + 3
    sheet.resize((Wt * 6, Ht * 6), Image.NEAREST).save(sys.argv[1])
