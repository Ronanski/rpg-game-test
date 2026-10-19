"""Procedural prop sprites: trees, rocks, bushes, bridge posts, houses.
Each returns (rgba uint8 array, (anchor_x, anchor_y)) where the anchor is the
art-pixel point that sits on the ground at the prop's tile centre."""
import numpy as np
from common import PAL, value_noise, BAYER4, outline_alpha, hexc

LIGHT = np.array([-0.55, -0.75, 0.62]); LIGHT /= np.linalg.norm(LIGHT)


def _sphere_cluster(canvas, cx, cy, rx, ry, pal, lo, hi, seed, rim=True, ambient=0.0):
    """Paint one shaded blob (leaf cluster / rock lump) onto an RGBA canvas."""
    H, W = canvas.shape[:2]
    y0, y1 = max(int(cy - ry - 1), 0), min(int(cy + ry + 2), H)
    x0, x1 = max(int(cx - rx - 1), 0), min(int(cx + rx + 2), W)
    ys, xs = np.mgrid[y0:y1, x0:x1]
    dx = (xs - cx) / rx; dy = (ys - cy) / ry
    d2 = dx * dx + dy * dy
    m = d2 <= 1.0
    nz = np.sqrt(np.clip(1 - d2, 0, 1))
    b = dx * LIGHT[0] + dy * LIGHT[1] + nz * LIGHT[2]
    tex = value_noise(xs * 0.55, ys * 0.8, seed, 1.0) - 0.5
    b = b * 0.85 + tex * 0.45 + ambient
    lvl = np.clip(np.floor(lo + (b + 0.2) / 1.2 * (hi - lo + 1) + (BAYER4[ys % 4, xs % 4] - 0.5) * 0.4), lo, hi).astype(int)
    if rim:
        # Darker rim on the shadowed side separates this clump from the ones behind it.
        lvl = np.where((d2 > 0.62) & (dx + dy > 0.25), lo, lvl)
    cols = np.array(pal)[lvl]
    sub = canvas[y0:y1, x0:x1]
    sub[m, :3] = cols[m]; sub[m, 3] = 255


def tree(variant, seed):
    rng = np.random.default_rng(seed)
    W, H = 58, 74
    c = np.zeros((H, W, 4), dtype=np.uint8)
    base_x, base_y = 29, 70
    # trunk with root flare and bark shading
    top = 46 if variant != 1 else 42
    for y in range(top, base_y + 1):
        t = (y - top) / (base_y - top)
        half = 2.6 + (3.4 if y > base_y - 3 else 0) * (y - (base_y - 3)) / 3 if y > base_y - 3 else 2.6 + t * 0.6
        lean = int(round((1 - t) * (1 if variant == 2 else -1)))
        for x in range(int(base_x - half + lean), int(base_x + half + lean) + 1):
            rel = (x - (base_x - half + lean)) / (2 * half + 1e-6)
            idx = 3 if rel < 0.3 else 2 if rel < 0.65 else 1
            if rng.random() < 0.12: idx = max(idx - 1, 1)
            c[y, x, :3] = PAL['bark'][idx]; c[y, x, 3] = 255
    # a couple of branches reaching into the canopy
    for bx, by, ex, ey in ((29, 48, 20, 36), (29, 46, 38, 34)):
        for i in range(12):
            x = round(bx + (ex - bx) * i / 11); y = round(by + (ey - by) * i / 11)
            c[y, x:x + 2, :3] = PAL['bark'][2]; c[y, x:x + 2, 3] = 255
    # canopy: shaded leaf clusters painted back to front
    if variant == 0:   rx, ry, cy, n = 22, 18, 28, 30
    elif variant == 1: rx, ry, cy, n = 16, 23, 28, 28
    else:              rx, ry, cy, n = 24, 17, 30, 32
    pts = []
    for _ in range(n):
        a = rng.random() * 2 * np.pi; r = np.sqrt(rng.random()) * 0.8
        pts.append((29 + np.cos(a) * r * rx, cy + np.sin(a) * r * ry, rng.uniform(5.0, 7.5)))
    pts.sort(key=lambda p: p[1])
    for i, (px, py, pr) in enumerate(pts):
        amb = -0.25 * (py - (cy - ry)) / (2 * ry) + 0.1      # lower clumps a bit darker
        _sphere_cluster(c, px, py, pr, pr * 0.85, PAL['leaf'], 1, 5, seed * 31 + i, ambient=amb - 0.05)
    # leaf highlights: little 2px leaves on the lit upper-left
    for _ in range(70):
        x = int(29 + rng.uniform(-rx, rx * 0.6)); y = int(cy + rng.uniform(-ry, ry * 0.4))
        if 0 <= y < H - 1 and 0 <= x < W - 1 and c[y, x, 3] and c[y + 1, x + 1, 3]:
            c[y, x, :3] = PAL['leaf'][6]; c[y, x + 1, :3] = PAL['leaf'][5]
    if variant == 2:   # fruit
        for _ in range(7):
            x = int(29 + rng.uniform(-rx * 0.8, rx * 0.8)); y = int(cy + rng.uniform(-ry * 0.5, ry * 0.7))
            if c[y, x, 3]:
                c[y, x, :3] = hexc('#c8462e'); c[y - 1, x, :3] = hexc('#ef7a4f')
    c = outline_alpha(c, PAL['leaf'][0])
    return c, (base_x, base_y)


def rock(variant, seed):
    rng = np.random.default_rng(seed)
    W, H = 22, 18
    c = np.zeros((H, W, 4), dtype=np.uint8)
    lumps = [(11, 11, 8, 5.5)] + [(11 + rng.uniform(-5, 5), 9 + rng.uniform(-2, 2), rng.uniform(3.5, 6), rng.uniform(3, 4.5)) for _ in range(1 + variant)]
    lumps.sort(key=lambda l: l[1])
    for i, (x, y, rx, ry) in enumerate(lumps):
        _sphere_cluster(c, x, y, rx, ry, PAL['stone'], 1, 5, seed + i, rim=True)
    # moss on top-facing pixels
    ys, xs = np.nonzero(c[..., 3])
    for y, x in zip(ys, xs):
        if y > 0 and c[y - 1, x, 3] == 0 and rng.random() < 0.85:
            for k in range(rng.integers(1, 3)):
                if y + k < H and c[y + k, x, 3]:
                    c[y + k, x, :3] = PAL['moss'][2 - k]
    c = outline_alpha(c, PAL['stone'][0])
    return c, (11, 15)


def bush(variant, seed):
    rng = np.random.default_rng(seed)
    W, H = 24, 18
    c = np.zeros((H, W, 4), dtype=np.uint8)
    pts = sorted([(12 + rng.uniform(-6, 6), 10 + rng.uniform(-3, 3), rng.uniform(3.5, 5.5)) for _ in range(7)], key=lambda p: p[1])
    for i, (x, y, r) in enumerate(pts):
        _sphere_cluster(c, x, y, r, r * 0.85, PAL['leaf'], 2, 6, seed + i)
    if variant == 1:
        for _ in range(5):
            x, y = int(12 + rng.uniform(-6, 6)), int(9 + rng.uniform(-3, 3))
            if c[y, x, 3]: c[y, x, :3] = hexc('#d94a6a')
    c = outline_alpha(c, PAL['leaf'][0])
    return c, (12, 15)


def post():
    W, H = 6, 13
    c = np.zeros((H, W, 4), dtype=np.uint8)
    c[1:12, 1:5, 3] = 255
    c[1:12, 1:3, :3] = PAL['wood'][3]; c[1:12, 3:5, :3] = PAL['wood'][2]
    c[1:3, 1:5, :3] = PAL['wood'][4]
    c = outline_alpha(c, PAL['wood'][0])
    return c, (3, 11)


def house(variant, seed):
    """2x2-tile timber cottage. Local grid (0,0) is the footprint's top corner."""
    rng = np.random.default_rng(seed)
    o = 0.18                    # roof overhang (tiles)
    zw, zr = 24, 40             # wall height, ridge height (art px)
    W, H = 84, 84
    OX, OY = W // 2, 48         # screen offset of local grid origin
    canvas = np.zeros((H, W, 4), dtype=np.uint8)
    ys, xs = np.mgrid[0:H, 0:W]
    X = (xs - OX).astype(float); Y = (ys - OY).astype(float)
    roof = PAL['roof'] if variant == 0 else [hexc(h) for h in ('#1d2638', '#2e3d5a', '#3f5578', '#5a7299', '#7f97bb')]
    def paint(mask, col):
        canvas[mask, :3] = col[mask] if col.ndim == 3 else col; canvas[mask, 3] = 255

    k = (zr - zw) / (1 + o)
    # back roof slope (faces away, darker)
    gy = (Y - X / 2 + zw + o * k) / (16 - k); gx = gy + X / 16
    z = zw + (gy + o) * k
    m = (gy >= -o) & (gy <= 1) & (gx >= -o) & (gx <= 2 + o)
    row = np.floor((gy + o) * 5).astype(int)
    col = np.array(roof)[np.where(row % 2 == 0, 1, 2)]
    paint(m, col)
    # SE wall (gx = 2): darker side
    gy = 2 - X / 16; z = (2 + gy) * 8 - Y
    m = (gy >= 0) & (gy <= 2) & (z >= 0) & (z <= zw)
    wall = np.array(PAL['plaster'])[np.where(BAYER4[ys % 4, xs % 4] > 0.85, 0, 1)]
    beam = (np.abs(gy - 0) < 0.07) | (np.abs(gy - 2) < 0.07) | (np.abs(gy - 1) < 0.06) | (np.abs(z - zw / 2) < 1.2) | (z > zw - 2)
    wall[beam] = PAL['wood'][1]
    wall[z < 3] = PAL['stone'][2]
    win = (np.abs(gy - 0.5) < 0.22) & (z > 9) & (z < 17)
    wall[win] = hexc('#2a2030'); wall[win & (np.abs(gy - 0.5) < 0.16) & (z > 10) & (z < 16)] = hexc('#e8b04a')
    wall[win & (np.abs(gy - 0.5) < 0.03)] = PAL['wood'][1]
    paint(m, wall)
    # gable triangle above the SE wall
    m2 = (gy >= 0) & (gy <= 2) & (z > zw) & (z <= zw + (1 - np.abs(gy - 1)) * (zr - zw))
    g = np.array(PAL['plaster'])[np.full(gy.shape, 1)]
    g[(np.abs(gy - 1) < 0.06)] = PAL['wood'][1]
    paint(m2, g)
    # SW wall (gy = 2): lit side, with door and window
    gx = X / 16 + 2; z = (gx + 2) * 8 - Y
    m = (gx >= 0) & (gx <= 2) & (z >= 0) & (z <= zw)
    wall = np.array(PAL['plaster'])[np.where(BAYER4[ys % 4, xs % 4] > 0.9, 1, 2)]
    beam = (np.abs(gx) < 0.07) | (np.abs(gx - 2) < 0.07) | (np.abs(gx - 1.05) < 0.06) | (np.abs(z - zw / 2) < 1.2) | (z > zw - 2)
    brace = (np.abs((gx - 1.05) * 10 - (z - zw / 2) * 0.9) < 1.1) & (gx > 1.05) & (gx < 2) & (z > zw / 2) & (z < zw - 2)
    wall[beam | brace] = PAL['wood'][2]
    wall[z < 3] = PAL['stone'][3]
    door = (gx > 0.3) & (gx < 0.75) & (z < 16)
    wall[door] = np.array(PAL['wood'])[np.where((np.floor(gx * 22) % 2) == 0, 2, 3)][door]
    wall[door & ((gx < 0.34) | (gx > 0.71) | (z > 15))] = PAL['wood'][0]
    wall[door & (np.abs(gx - 0.66) < 0.03) & (np.abs(z - 8) < 1)] = hexc('#e8c35a')
    win = (np.abs(gx - 1.5) < 0.24) & (z > 8) & (z < 17)
    wall[win] = hexc('#2a2030'); wall[win & (np.abs(gx - 1.5) < 0.18) & (z > 9) & (z < 16)] = hexc('#f2c35a')
    wall[win & ((np.abs(gx - 1.5) < 0.03) | (np.abs(z - 12.5) < 0.6))] = PAL['wood'][1]
    paint(m, wall)
    # front roof slope (faces the viewer)
    gy = (Y - X / 2 + zw + (2 + o) * k) / (16 + k); gx = gy + X / 16
    m = (gy >= 1) & (gy <= 2 + o) & (gx >= -o) & (gx <= 2 + o)
    row = np.floor((2 + o - gy) * 6).astype(int)
    seam = np.abs(((gx * 4 + (row % 2) * 0.5) % 1) - 0.5) > 0.42
    lvl = np.where(row % 2 == 0, 3, 2) + ((2 + o - gy) * 6 % 1 < 0.25)
    lvl = np.where(seam, 1, lvl)
    lvl = np.where(gy < 1.08, 4, lvl)                 # ridge cap highlight
    paint(m, np.array(roof)[np.clip(lvl, 0, 4)])
    # fascia on the roof's SE edge
    fx = np.abs(gx - (2 + o)) < 0.05
    paint(m & fx, np.array(roof)[np.full(gx.shape, 0)])
    # chimney
    cxm = (X > -14) & (X < -9) & (Y > -30) & (Y < -17)
    ch = np.array(PAL['stone'])[np.where(X < -11, 3, 2)]
    ch[(Y < -28)] = PAL['stone'][1]
    paint(cxm, ch)
    canvas = outline_alpha(canvas, hexc('#120c10'))
    anchor = (OX + 0, OY + 32)          # local (2,2,0) = footprint bottom corner
    return canvas, anchor


if __name__ == '__main__':
    import sys
    from PIL import Image
    out = sys.argv[1]
    imgs = [tree(0, 1), tree(1, 2), tree(2, 3), rock(0, 4), rock(1, 5), rock(2, 6), bush(0, 7), bush(1, 8), post(), house(0, 9), house(1, 10)]
    Wt = sum(i[0].shape[1] + 4 for i in imgs); Ht = max(i[0].shape[0] for i in imgs)
    sheet = Image.new('RGBA', (Wt, Ht), (90, 140, 70, 255)); x = 0
    for a, _ in imgs:
        im = Image.fromarray(a, 'RGBA'); sheet.alpha_composite(im, (x, Ht - a.shape[0])); x += a.shape[1] + 4
    sheet.resize((Wt * 4, Ht * 4), Image.NEAREST).save(out)
