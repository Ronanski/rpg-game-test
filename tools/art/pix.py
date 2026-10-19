"""Small pixel-art toolkit: palettes, row-based sprites, outlines, and a tiny iso 3D rasterizer."""
from __future__ import annotations

import math
import random
from PIL import Image, ImageDraw

Color = tuple[int, int, int, int]
CLEAR: Color = (0, 0, 0, 0)


def hexc(s: str, a: int = 255) -> Color:
    s = s.lstrip('#')
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), a)


def mix(a: Color, b: Color, t: float) -> Color:
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (a[3],)  # type: ignore


def shade(c: Color, f: float) -> Color:
    """f < 0 darkens toward a cool purple-black, f > 0 lightens toward warm white."""
    if f < 0:
        return mix(c, (26, 16, 34, 255), -f)
    return mix(c, (255, 244, 214, 255), f)


def ramp(base: str, n: int = 4, lo: float = -0.45, hi: float = 0.3) -> list[Color]:
    c = hexc(base)
    return [shade(c, lo + (hi - lo) * i / (n - 1)) for i in range(n)]


def from_rows(rows: list[str], pal: dict[str, Color]) -> Image.Image:
    w = max(len(r) for r in rows)
    im = Image.new('RGBA', (w, len(rows)), CLEAR)
    px = im.load()
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch not in '. ':
                px[x, y] = pal[ch]
    return im


def pad(im: Image.Image, l: int, t: int, r: int, b: int) -> Image.Image:
    out = Image.new('RGBA', (im.width + l + r, im.height + t + b), CLEAR)
    out.paste(im, (l, t))
    return out


def outline(im: Image.Image, dark: float = 0.62, fixed: Color | None = None) -> Image.Image:
    """Adds a 1px outline outside the sprite, colored as a dark version of the neighbor."""
    im = pad(im, 1, 1, 1, 1)
    src = im.copy().load()
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            if src[x, y][3]:
                continue
            for dx, dy in ((0, 1), (1, 0), (-1, 0), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and src[nx, ny][3] > 128:
                    px[x, y] = fixed or shade(src[nx, ny], -dark)
                    break
    return im


def overlay(im: Image.Image, top: Image.Image, x: int, y: int) -> Image.Image:
    out = im.copy()
    out.alpha_composite(top, (x, y))
    return out


def hstack(frames: list[Image.Image]) -> Image.Image:
    """Sprite sheet with equal frame widths (all frames padded to the largest)."""
    w = max(f.width for f in frames)
    h = max(f.height for f in frames)
    sheet = Image.new('RGBA', (w * len(frames), h), CLEAR)
    for i, f in enumerate(frames):
        sheet.paste(f, (i * w + (w - f.width) // 2, h - f.height))
    return sheet


# ---------------------------------------------------------------- noise

def periodic_noise(seed: int, cells: int = 4):
    """Smooth value noise on the unit torus, so tiles built from it wrap seamlessly."""
    rnd = random.Random(seed)
    grid = [[rnd.random() for _ in range(cells)] for _ in range(cells)]

    def f(u: float, v: float) -> float:
        x, y = (u % 1) * cells, (v % 1) * cells
        x0, y0 = int(x), int(y)
        tx, ty = x - x0, y - y0
        tx, ty = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
        a = grid[y0 % cells][x0 % cells]
        b = grid[y0 % cells][(x0 + 1) % cells]
        c = grid[(y0 + 1) % cells][x0 % cells]
        d = grid[(y0 + 1) % cells][(x0 + 1) % cells]
        return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty

    return f


def fbm(seed: int):
    n1, n2, n3 = periodic_noise(seed, 3), periodic_noise(seed + 1, 6), periodic_noise(seed + 2, 12)
    return lambda u, v: n1(u, v) * 0.5 + n2(u, v) * 0.3 + n3(u, v) * 0.2


def periodic_voronoi(seed: int, n: int = 3, jitter: float = 0.7):
    """Returns f(u,v) -> (d1, d2, cell_id) on the unit torus."""
    rnd = random.Random(seed)
    pts = []
    for j in range(n):
        for i in range(n):
            pts.append(((i + 0.5 + (rnd.random() - 0.5) * jitter) / n, (j + 0.5 + (rnd.random() - 0.5) * jitter) / n, len(pts)))

    def f(u: float, v: float):
        best = [9.0, 9.0]
        cid = 0
        for px, py, k in pts:
            dx = abs((u % 1) - px); dx = min(dx, 1 - dx)
            dy = abs((v % 1) - py); dy = min(dy, 1 - dy)
            d = math.hypot(dx, dy)
            if d < best[0]:
                best[1] = best[0]; best[0] = d; cid = k
            elif d < best[1]:
                best[1] = d
        return best[0], best[1], cid

    return f


BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def dither_pick(colors: list[Color], t: float, x: int, y: int) -> Color:
    """Picks from a ramp with ordered dithering between steps (t in 0..1)."""
    t = min(max(t, 0), 0.9999) * (len(colors) - 1)
    i = int(t)
    frac = t - i
    if i + 1 < len(colors) and frac > (BAYER[y % 4][x % 4] + 0.5) / 16:
        i += 1
    return colors[i]


# ---------------------------------------------------------------- iso tiles (32x16 native)

TW, TH = 32, 16


def iso_tile(tex) -> Image.Image:
    """Fills a 32x16 diamond. tex(u, v, x, y) gets grid coords u,v in [0,1)."""
    im = Image.new('RGBA', (TW, TH), CLEAR)
    px = im.load()
    for y in range(TH):
        half = (y + 1) * 2 if y < TH // 2 else (TH - y) * 2
        for x in range(TW // 2 - half, TW // 2 + half):
            sx, sy = (x + 0.5 - TW / 2) / (TW / 2), (y + 0.5 - TH / 2) / (TH / 2)
            u, v = (sx + sy) / 2 + 0.5, (sy - sx) / 2 + 0.5
            px[x, y] = tex(u, v, x, y)
    return im


# ---------------------------------------------------------------- tiny iso 3D rasterizer
# Grid units: 1 = one tile. z is in native pixels. Screen: sx = (gx - gy) * 16, sy = (gx + gy) * 8 - z.

class Iso:
    def __init__(self, w: int, h: int, ox: int, oy: int):
        self.im = Image.new('RGBA', (w, h), CLEAR)
        self.ox, self.oy = ox, oy

    def p(self, gx: float, gy: float, z: float) -> tuple[float, float]:
        return (self.ox + (gx - gy) * 16, self.oy + (gx + gy) * 8 - z)

    def face(self, o, a, b, tex, tri: bool = False):
        """Parallelogram (or triangle) face: corner o, edges to a and b (3D points). tex(u, v, x, y)."""
        O, A, B = self.p(*o), self.p(*a), self.p(*b)
        ax, ay = A[0] - O[0], A[1] - O[1]
        bx, by = B[0] - O[0], B[1] - O[1]
        det = ax * by - ay * bx
        if abs(det) < 1e-6:
            return
        poly = [O, A, B] if tri else [O, A, (A[0] + bx, A[1] + by), B]
        mask = Image.new('L', self.im.size, 0)
        ImageDraw.Draw(mask).polygon(poly, fill=255)
        mpx, px = mask.load(), self.im.load()
        xs = [q[0] for q in poly]; ys = [q[1] for q in poly]
        for y in range(max(0, int(min(ys)) - 1), min(self.im.height, int(max(ys)) + 2)):
            for x in range(max(0, int(min(xs)) - 1), min(self.im.width, int(max(xs)) + 2)):
                if not mpx[x, y]:
                    continue
                dx, dy = x + 0.5 - O[0], y + 0.5 - O[1]
                u = (dx * by - dy * bx) / det
                v = (ax * dy - ay * dx) / det
                c = tex(min(max(u, 0), 1), min(max(v, 0), 1), x, y)
                if c and c[3]:
                    px[x, y] = c

    def box(self, gx0, gy0, gx1, gy1, z0, z1, top, left, right):
        """Axis-aligned box; draws the 3 visible faces. left = face at gy1, right = face at gx1."""
        self.face((gx0, gy1, z0), (gx1, gy1, z0), (gx0, gy1, z1), left)
        self.face((gx1, gy1, z0), (gx1, gy0, z0), (gx1, gy1, z1), right)
        self.face((gx0, gy0, z1), (gx1, gy0, z1), (gx0, gy1, z1), top)
