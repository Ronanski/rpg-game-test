"""Ground tiles, trees, buildings and decorations."""
from __future__ import annotations

import math
import random
from PIL import Image, ImageDraw
from pix import (CLEAR, Iso, hexc, shade, mix, ramp, outline, iso_tile, fbm, periodic_voronoi,
                 dither_pick, hstack, pad, from_rows)

# ---------------------------------------------------------------- ground

GRASS = ramp('#4f8f3e', 5, -0.35, 0.22)


def grass(seed: int, flowers: float = 0.0) -> Image.Image:
    n = fbm(seed)
    rnd = random.Random(seed)
    blades = {(rnd.randrange(32), rnd.randrange(16)) for _ in range(26)}
    fl = {(rnd.randrange(32), rnd.randrange(16)): rnd.choice(['#f4e07a', '#f4f1e8', '#e88aa0', '#9fc7ff']) for _ in range(int(flowers * 40))}

    def tex(u, v, x, y):
        if (x, y) in fl:
            return hexc(fl[(x, y)])
        if (x, y - 1) in fl:
            return GRASS[0]
        t = n(u, v) * 0.85 + 0.08
        if (x, y) in blades:
            return GRASS[min(4, int(t * 4) + 2)]
        if (x, y - 1) in blades:
            return GRASS[0]
        return dither_pick(GRASS[1:4], (t - 0.1) * 1.15, x, y)
    return iso_tile(tex)


def dirt(seed: int) -> Image.Image:
    cols = ramp('#a27a4c', 5, -0.35, 0.2)
    n = fbm(seed)
    rnd = random.Random(seed)
    pebbles = {(rnd.randrange(32), rnd.randrange(16)) for _ in range(9)}

    def tex(u, v, x, y):
        if (x, y) in pebbles:
            return hexc('#c9b89a')
        if (x - 1, y) in pebbles or (x, y - 1) in pebbles:
            return cols[0]
        return dither_pick(cols[1:5], n(u, v), x, y)
    return iso_tile(tex)


def cobble(seed: int) -> Image.Image:
    vor = periodic_voronoi(seed, 4, 0.55)
    n = fbm(seed + 9)
    rnd = random.Random(seed)
    tones = [rnd.uniform(-0.12, 0.12) for _ in range(16)]
    base = hexc('#8e8a86')
    mortar = hexc('#57524f')

    def tex(u, v, x, y):
        d1, d2, cid = vor(u, v)
        e = d2 - d1
        if e < 0.035:
            return mortar
        c = shade(base, tones[cid] + (n(u, v) - 0.5) * 0.15)
        # Top-left rim light and bottom-right shadow on each stone.
        du, dv = vor(u - 0.03, v - 0.03), vor(u + 0.03, v + 0.03)
        if du[2] != cid:
            return shade(c, 0.22)
        if dv[2] != cid:
            return shade(c, -0.22)
        return c
    return iso_tile(tex)


def water(seed: int, phase: float) -> Image.Image:
    cols = ramp('#2f6fb0', 5, -0.3, 0.25)
    n = fbm(seed)

    def tex(u, v, x, y):
        w = math.sin((u * 2 + v * 1) * math.pi * 4 + phase * math.pi * 2 + n(u, v) * 4)
        t = 0.35 + n(u + phase * 0.25, v) * 0.4 + (0.3 if w > 0.85 else 0)
        if w > 0.97:
            return hexc('#cfe9ff')
        return dither_pick(cols, t, x, y)
    return iso_tile(tex)


def bridge() -> Image.Image:
    wood = ramp('#8a5a2b', 4, -0.35, 0.2)

    def tex(u, v, x, y):
        plank = int(u * 6)
        f = u * 6 - plank
        if f < 0.12:
            return wood[0]
        if (plank * 7 + int(v * 3)) % 5 == 0 and abs(v * 3 % 1 - 0.5) < 0.05:
            return hexc('#c9ccd6')
        return wood[1 + (plank % 2)] if f > 0.8 else wood[2 if plank % 3 else 3]
    return iso_tile(tex)


def tiles() -> dict[str, Image.Image]:
    return {
        'tile_grass': [grass(s) for s in (11, 12, 13)],
        'tile_flowers': [grass(s, 0.6) for s in (21, 22)],
        'tile_path': [dirt(s) for s in (31, 32, 33)],
        'tile_stone': [cobble(s) for s in (41, 42, 43)],
        'tile_water': [water(51, p / 4) for p in range(4)],
        'tile_bridge': bridge(),
    }

# ---------------------------------------------------------------- trees


def blob(im: Image.Image, cx, cy, r, cols, seed, light=(-0.6, -0.8)):
    """Shaded leafy sphere: lit from top-left, with dithered leaf noise."""
    px = im.load()
    rnd = random.Random(seed)
    for y in range(int(cy - r), int(cy + r) + 1):
        for x in range(int(cx - r), int(cx + r) + 1):
            dx, dy = (x + 0.5 - cx) / r, (y + 0.5 - cy) / r
            d = dx * dx + dy * dy
            if d > 1 or not (0 <= x < im.width and 0 <= y < im.height):
                continue
            nz = math.sqrt(1 - d)
            lit = -(dx * light[0] + dy * light[1]) * 0.5 + nz * 0.6
            lit += (rnd.random() - 0.5) * 0.35
            px[x, y] = dither_pick(cols, (lit + 0.3) / 1.3, x, y)


def oak(seed: int) -> Image.Image:
    im = Image.new('RGBA', (40, 52), CLEAR)
    d = ImageDraw.Draw(im)
    bark = ramp('#6a4426', 3, -0.35, 0.15)
    d.rectangle([17, 30, 22, 50], fill=bark[1])
    d.rectangle([17, 30, 18, 50], fill=bark[2])
    d.rectangle([21, 30, 22, 50], fill=bark[0])
    d.polygon([(15, 50), (17, 46), (17, 50)], fill=bark[1])
    d.polygon([(24, 50), (22, 46), (22, 50)], fill=bark[0])
    leaves = ramp('#3f8a3a', 5, -0.5, 0.3)
    rnd = random.Random(seed)
    for cx, cy, r in [(12, 26, 10), (28, 26, 10), (20, 30, 10), (14, 16, 10), (26, 15, 10), (20, 10, 9)]:
        blob(im, cx + rnd.randint(-1, 1), cy + rnd.randint(-1, 1), r, leaves, seed + cx)
    return outline(im)


def pine(seed: int) -> Image.Image:
    im = Image.new('RGBA', (30, 56), CLEAR)
    px = im.load()
    leaves = ramp('#2f6e48', 5, -0.5, 0.25)
    bark = ramp('#5a3a22', 3, -0.3, 0.1)
    for y in range(44, 55):
        for x in range(13, 17):
            px[x, y] = bark[0 if x > 14 else 1]
    rnd = random.Random(seed)
    for layer, (top, bot, half) in enumerate([(2, 18, 7), (10, 30, 10), (20, 44, 14)]):
        for y in range(top, bot):
            t = (y - top) / (bot - top)
            w = 1 + half * t
            for x in range(int(15 - w), int(15 + w) + 1):
                if 0 <= x < 30:
                    side = (x - 15) / max(w, 1)
                    lit = 0.65 - side * 0.45 - t * 0.25 + (rnd.random() - 0.5) * 0.3
                    if y > bot - 3 and rnd.random() < 0.4:
                        continue
                    px[x, y] = dither_pick(leaves, lit, x, y)
    return outline(im)


def bush(seed: int) -> Image.Image:
    im = Image.new('RGBA', (22, 16), CLEAR)
    leaves = ramp('#4a9440', 5, -0.5, 0.3)
    for cx, cy, r in [(7, 10, 6), (14, 10, 6), (11, 6, 6)]:
        blob(im, cx, cy, r, leaves, seed + cx)
    px = im.load()
    rnd = random.Random(seed)
    for _ in range(4):
        x, y = rnd.randint(4, 17), rnd.randint(5, 13)
        if px[x, y][3]:
            px[x, y] = hexc('#d9433d')
    return outline(im)


def rock(seed: int) -> Image.Image:
    im = Image.new('RGBA', (20, 14), CLEAR)
    stone = ramp('#8a8680', 5, -0.45, 0.3)
    blob(im, 10, 9, 8, stone, seed, light=(-0.7, -0.7))
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            if px[x, y][3] and y > 11:
                px[x, y] = CLEAR
    moss = hexc('#5f9a48')
    rnd = random.Random(seed)
    for _ in range(10):
        x, y = rnd.randint(4, 14), rnd.randint(2, 5)
        if px[x, y][3]:
            px[x, y] = moss
    return outline(im)

# ---------------------------------------------------------------- buildings


def plaster_timber(lit: float, door: bool, window_u: list[float]):
    plaster = shade(hexc('#e6d6b0'), lit)
    beam = shade(hexc('#5a3820'), lit)
    stone = shade(hexc('#8e8a86'), lit)

    def tex(u, v, x, y):
        if v < 0.16:
            return shade(stone, -0.18) if (x + (y // 2) * 3) % 6 == 0 or y % 3 == 0 else stone
        if door and 0.18 < u < 0.38 and v < 0.62:
            if abs(u - 0.18) < 0.03 or abs(u - 0.38) < 0.03 or v > 0.58:
                return shade(beam, -0.2)
            return shade(hexc('#7a4a24'), lit - (0.15 if (x % 3 == 0) else 0))
        for wu in window_u:
            if abs(u - wu) < 0.09 and 0.36 < v < 0.68:
                if abs(u - wu) > 0.065 or v < 0.39 or v > 0.65 or abs(u - wu) < 0.012:
                    return shade(beam, -0.1)
                return hexc('#ffd77a') if v < 0.5 else hexc('#f0b04a')
        if v > 0.93 or v < 0.2 or u < 0.03 or u > 0.97 or abs(u - 0.5) < 0.025:
            return beam
        # Diagonal braces in the upper half.
        if v > 0.55 and (abs((u % 0.5) * 2 - (v - 0.55) / 0.4) < 0.07):
            return beam
        return plaster if (x * 7 + y * 3) % 23 else shade(plaster, -0.08)
    return tex


def roof_tex(base: str, lit: float):
    cols = ramp(base, 4, -0.4, 0.2)

    def tex(u, v, x, y):
        row = int(v * 7)
        f = v * 7 - row
        off = 0.5 if row % 2 else 0
        tile = (u * 8 + off) % 1
        if f > 0.82:
            return shade(cols[0], lit)
        if tile < 0.08:
            return shade(cols[1], lit)
        return shade(cols[2] if f < 0.4 else cols[3] if f < 0.6 else cols[2], lit)
    return tex


def house(roof: str = '#b24a32', thatch: bool = False) -> Image.Image:
    """2x2 footprint, half-timber walls, gable roof with the ridge along gx."""
    iso = Iso(72, 102, 36, 50)
    H, RH, o = 24, 22, 0.18
    left = plaster_timber(0.06, True, [0.72])
    right = plaster_timber(-0.18, False, [0.5])
    gable_c = plaster_timber(-0.18, False, [])
    iso.face((0, 2, 0), (2, 2, 0), (0, 2, H), left)
    iso.face((2, 2, 0), (2, 0, 0), (2, 2, H), right)
    # Gable triangle on the gx=2 wall.
    iso.face((2, 2, H), (2, 0, H), (2, 1, H + RH), gable_c, tri=True)
    rt = '#c9a046' if thatch else roof
    # Back roof plane (toward -gy), then front plane (toward +gy).
    iso.face((-o, 1, H + RH), (2 + o, 1, H + RH), (-o, -o, H - 2), roof_tex(rt, -0.3))
    iso.face((-o, 2 + o, H - 2), (2 + o, 2 + o, H - 2), (-o, 1, H + RH), roof_tex(rt, 0.05))
    # Chimney.
    brick = lambda lit: (lambda u, v, x, y: shade(hexc('#8a4a3a'), lit - (0.15 if y % 3 == 0 else 0)))
    iso.box(0.35, 0.45, 0.65, 0.75, H + RH - 8, H + RH + 10, brick(0.1), brick(0.0), brick(-0.25))
    return outline(iso.im)


def well() -> Image.Image:
    """1x1 stone fountain with water."""
    im = Image.new('RGBA', (34, 30), CLEAR)
    px = im.load()
    stone = ramp('#9a958e', 5, -0.45, 0.25)
    wcol = ramp('#3a7fc0', 4, -0.2, 0.35)
    cx, cy = 17, 18
    for y in range(im.height):
        for x in range(im.width):
            dx, dy = (x + 0.5 - cx) / 15, (y + 0.5 - cy) / 7.5
            d = dx * dx + dy * dy
            if d <= 1:
                inner = (dx * dx + dy * dy) < 0.62
                if inner:
                    px[x, y] = dither_pick(wcol, 0.4 + dx * 0.2 - dy * 0.3, x, y)
                else:
                    px[x, y] = dither_pick(stone, 0.6 - dx * 0.3 - dy * 0.3, x, y)
            elif 0 <= (y + 0.5 - cy) <= 6 and abs(dx) <= 1 and ((x + 0.5 - cx) / 15) ** 2 + ((y + 0.5 - cy - 6) / 7.5) ** 2 <= 1:
                px[x, y] = dither_pick(stone, 0.45 - dx * 0.35 - (0.15 if (x + y // 3 * 2) % 5 == 0 else 0), x, y)
    # Central spout.
    d = ImageDraw.Draw(im)
    d.rectangle([15, 6, 19, 16], fill=stone[2])
    d.rectangle([15, 6, 16, 16], fill=stone[3])
    d.rectangle([14, 4, 20, 6], fill=stone[3])
    for i, (x, y) in enumerate([(17, 1), (17, 2), (17, 3), (13, 6), (21, 6), (12, 8), (22, 8)]):
        px[x, y] = hexc('#bfe4ff')
    return outline(im)


def barrel() -> Image.Image:
    im = Image.new('RGBA', (12, 15), CLEAR)
    px = im.load()
    wood = ramp('#8a5a2b', 5, -0.45, 0.25)
    for y in range(15):
        bulge = 5 + (1 if 3 <= y <= 11 else 0)
        for x in range(6 - bulge, 6 + bulge):
            t = 0.75 - (x - (6 - bulge)) / (2 * bulge) * 0.7
            c = dither_pick(wood, t, x, y)
            if y in (2, 3, 11, 12):
                c = shade(hexc('#5a5f6a'), t * 0.5 - 0.2)
            elif (x - (6 - bulge)) % 3 == 0:
                c = shade(c, -0.15)
            px[x, y] = c
    for x in range(1, 11):
        px[x, 0] = wood[3]
        px[x, 1] = wood[1]
    return outline(im)


def crate() -> Image.Image:
    iso = Iso(24, 30, 12, 16)
    wood = lambda lit: (lambda u, v, x, y: shade(hexc('#a0703c'), lit + (-0.25 if u < 0.1 or u > 0.9 or v < 0.1 or v > 0.9 or abs(u - v) < 0.08 else 0)))
    iso.box(0, 0, 0.62, 0.62, 0, 12, wood(0.15), wood(0), wood(-0.25))
    return outline(iso.im)


def torch() -> list[Image.Image]:
    frames = []
    for f in range(3):
        im = Image.new('RGBA', (8, 26), CLEAR)
        d = ImageDraw.Draw(im)
        d.rectangle([3, 9, 4, 25], fill=hexc('#6a4426'))
        d.rectangle([3, 9, 3, 25], fill=hexc('#8a5a2b'))
        d.rectangle([2, 8, 5, 10], fill=hexc('#4a4a52'))
        flame = [[(3, 7), (4, 7), (2, 6), (3, 6), (4, 6), (5, 6), (3, 5), (4, 5), (3, 4), (4, 3)],
                 [(3, 7), (4, 7), (2, 6), (3, 6), (4, 6), (5, 6), (3, 5), (4, 5), (4, 4), (3, 3)],
                 [(3, 7), (4, 7), (2, 6), (3, 6), (4, 6), (5, 6), (2, 5), (3, 5), (4, 5), (3, 4), (3, 2)]][f]
        px = im.load()
        for i, (x, y) in enumerate(flame):
            px[x, y] = hexc('#ff8a2a') if y >= 6 else hexc('#ffd24a')
        px[3, 6] = hexc('#fff3b0')
        frames.append(outline(im))
    return frames


def stall(color: str) -> Image.Image:
    """Market stall: counter with a striped awning."""
    iso = Iso(44, 64, 22, 36)
    wood = lambda lit: (lambda u, v, x, y: shade(hexc('#8a5a2b'), lit - (0.15 if y % 4 == 0 else 0)))
    iso.box(0, 0, 1, 0.5, 0, 10, wood(0.15), wood(0), wood(-0.25))
    post = lambda lit: (lambda u, v, x, y: shade(hexc('#6a4426'), lit))
    for gx, gy in ((0.02, 0.0), (0.92, 0.0)):
        iso.box(gx, gy, gx + 0.06, gy + 0.06, 0, 28, post(0.1), post(0), post(-0.2))
    stripe = lambda lit: (lambda u, v, x, y: shade(hexc(color) if int(u * 6) % 2 == 0 else hexc('#f4ead0'), lit))
    iso.face((-0.1, 0.8, 22), (1.1, 0.8, 22), (-0.1, -0.1, 30), stripe(0.05))
    px = iso.im.load()
    rnd = random.Random(7)
    goods = ['#d9433d', '#f4c542', '#7cc06a', '#e88a2a']
    for _ in range(14):
        gx, gy = rnd.uniform(0.1, 0.9), rnd.uniform(0.05, 0.4)
        sx, sy = iso.p(gx, gy, 11)
        px[int(sx), int(sy)] = hexc(rnd.choice(goods))
    return outline(iso.im)


def flowerbed() -> Image.Image:
    im = Image.new('RGBA', (14, 10), CLEAR)
    leaves = ramp('#4a9440', 4, -0.4, 0.2)
    blob(im, 7, 6, 5, leaves, 3)
    px = im.load()
    for x, y, c in [(4, 3, '#e88aa0'), (8, 2, '#f4e07a'), (10, 5, '#e88aa0'), (6, 6, '#9fc7ff'), (3, 6, '#f4e07a')]:
        px[x, y] = hexc(c)
    return outline(im)


def all_sprites() -> dict[str, Image.Image]:
    out = tiles()
    out['tree'] = [oak(1), oak(2)]
    out['pine'] = [pine(3), pine(4)]
    out['bush'] = [bush(5), bush(6)]
    out['rock'] = rock(7)
    out['house'] = house()
    out['house_blue'] = house('#3f5f8f')
    out['house_thatch'] = house(thatch=True)
    out['fountain'] = well()
    out['barrel'] = barrel()
    out['crate'] = crate()
    out['torch'] = torch()
    out['stall_red'] = stall('#b23a32')
    out['stall_yellow'] = stall('#d9a43a')
    out['flowerbed'] = flowerbed()
    out['b_spikes'] = spike_trap()
    out['b_farm'] = farm_plot()
    out['b_scaffold'] = scaffold()
    return out


def spike_trap() -> Image.Image:
    """1x1 wooden frame with iron spikes."""
    iso = Iso(36, 26, 18, 6)
    wood = lambda lit: (lambda u, v, x, y: shade(hexc('#6a4426'), lit - (0.2 if (u < 0.1 or u > 0.9 or v < 0.1 or v > 0.9) else 0)))
    iso.box(0.1, 0.1, 0.9, 0.9, 0, 3, wood(0.1), wood(-0.05), wood(-0.25))
    im = iso.im
    px = im.load()
    for gx in (0.3, 0.5, 0.7):
        for gy in (0.3, 0.5, 0.7):
            sx, sy = iso.p(gx, gy, 3)
            sx, sy = int(sx), int(sy)
            for k in range(6):
                for w in range(-(5 - k) // 3, (5 - k) // 3 + 1):
                    if 0 <= sx + w < im.width and 0 <= sy - k < im.height:
                        px[sx + w, sy - k] = hexc('#c9ccd6') if w <= 0 else hexc('#7a7f8a')
    return outline(im)


def farm_plot() -> Image.Image:
    """2x2 tilled field with rows of crops."""
    iso = Iso(72, 50, 36, 6)
    def soil(u, v, x, y):
        row = (u * 6) % 1
        if 0.35 < row < 0.65:
            leaf = ((x * 7 + y * 3) % 5) < 3
            return hexc('#5fae4a') if leaf else hexc('#3f8a3a')
        return shade(hexc('#7a5230'), -0.1 if row < 0.2 else 0.05)
    iso.face((0, 0, 2), (2, 0, 2), (0, 2, 2), soil)
    edge = lambda lit: (lambda u, v, x, y: shade(hexc('#6a4426'), lit))
    iso.face((0, 2, 0), (2, 2, 0), (0, 2, 2), edge(0))
    iso.face((2, 2, 0), (2, 0, 0), (2, 2, 2), edge(-0.25))
    return outline(iso.im)


def scaffold() -> Image.Image:
    """Wooden scaffold shown while something is being built."""
    im = Image.new('RGBA', (34, 40), CLEAR)
    d = ImageDraw.Draw(im)
    wood, dark = hexc('#a0703c'), hexc('#6a4426')
    for x in (3, 15, 27):
        d.rectangle([x, 4, x + 3, 39], fill=wood)
        d.rectangle([x + 3, 4, x + 3, 39], fill=dark)
    for y in (6, 20, 34):
        d.rectangle([1, y, 32, y + 2], fill=wood)
    d.line([4, 36, 28, 8], fill=dark, width=2)
    return outline(im)
