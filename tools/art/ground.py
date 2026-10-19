"""Bakes the whole ground layer of a world into one pixel-art image.

Everything is computed per art pixel, so terrain edges are organic instead of
diamond-shaped tiles: jagged grass lips over dirt, a lowered river with earth
banks and foam, cobbled plaza, and a plank bridge.
"""
import numpy as np
from common import TW, TH, PAL, BAYER4, fbm, value_noise, dither_level, shade, BG
import world as W

DEPTH = 7   # how far the water surface sits below the ground (art px)
PAD = 8


def geometry(n):
    ox = n * TW // 2 + PAD
    oy = TH // 2 + PAD
    width = n * TW + PAD * 2
    height = n * TH + PAD * 2 + DEPTH + 4
    return ox, oy, width, height


def to_screen(gx, gy, ox, oy):
    return (gx - gy) * TW / 2 + ox, (gx + gy) * TH / 2 + oy


def bake(world, seed=3):
    n = world['size']
    tiles = np.array(world['tiles'])
    ox, oy, Wd, Ht = geometry(n)
    ys, xs = np.mgrid[0:Ht, 0:Wd]
    u = (xs - ox) / (TW / 2); v = (ys - oy) / (TH / 2)
    gx = (u + v) / 2; gy = (v - u) / 2

    # Terrain lookup with noise displacement for organic borders.
    def lookup(dx, dy):
        ix = np.round(gx + dx).astype(int); iy = np.round(gy + dy).astype(int)
        inside = (ix >= 0) & (iy >= 0) & (ix < n) & (iy < n)
        t = np.full(gx.shape, -1)
        t[inside] = tiles[iy[inside], ix[inside]]
        return t
    ndx = (fbm(gx, gy, seed, 0.55) - 0.5) * 0.9
    ndy = (fbm(gx, gy, seed + 50, 0.55) - 0.5) * 0.9
    T_raw = lookup(0, 0)
    T = lookup(ndx, ndy)
    T_small = lookup(ndx * 0.3, ndy * 0.3)
    man_made = (T_raw == W.BRIDGE) | (T == W.BRIDGE)
    T = np.where(man_made, T_raw, T)
    stoneish = (T_raw == W.STONE) | (T == W.STONE)
    T = np.where(stoneish & ~man_made, T_small, T)
    T = np.where(T_raw == -1, -1, T)

    img = np.zeros((Ht, Wd, 3), dtype=np.uint8)
    img[:] = BG
    valid = T >= 0
    water = T == W.WATER
    grass = (T == W.GRASS) | (T == W.FLOWERS)
    dirt = T == W.PATH
    stone = T == W.STONE
    bridge = T == W.BRIDGE
    ground = valid & ~water

    # ---- grass: soft light patches quantized with ordered dither
    gv = fbm(gx, gy, seed + 1, 0.25) * 0.75 + fbm(gx, gy, seed + 2, 1.1) * 0.25
    gv = (gv - 0.3) / 0.45
    lvl = dither_level(gv, xs, ys, 3, 0.35) + 2     # palette idx 2..4, clean patches
    img[grass] = shade(PAL['grass'], lvl)[grass]

    # ---- dirt path
    dv = fbm(gx, gy, seed + 3, 0.5) * 0.7 + fbm(gx, gy, seed + 4, 2.0) * 0.3
    dv = (dv - 0.3) / 0.4
    lvl = dither_level(dv, xs, ys, 3, 0.3) + 2      # idx 2..4
    img[dirt] = shade(PAL['dirt'], lvl)[dirt]

    # ---- cobblestone plaza (voronoi in grid space)
    s = 3.6
    px_, py_ = gx * s, gy * s
    cx0, cy0 = np.floor(px_).astype(int), np.floor(py_).astype(int)
    rng = np.random.default_rng(seed + 5)
    jit = rng.random((512, 512, 2)) * 0.8 + 0.1
    tone = rng.integers(2, 4, (512, 512))
    d1 = np.full(gx.shape, 9.0); d2 = np.full(gx.shape, 9.0)
    best = np.zeros(gx.shape + (2,), dtype=int); bvec = np.zeros(gx.shape + (2,))
    for oy_ in (-1, 0, 1):
        for ox_ in (-1, 0, 1):
            cx = cx0 + ox_; cy = cy0 + oy_
            j = jit[cy % 512, cx % 512]
            vx = cx + j[..., 0] - px_; vy = cy + j[..., 1] - py_
            d = np.sqrt(vx * vx + vy * vy)
            closer = d < d1
            d2 = np.where(closer, d1, np.minimum(d2, d))
            d1 = np.where(closer, d, d1)
            best[closer] = np.stack([cx, cy], -1)[closer]
            bvec[closer] = np.stack([vx, vy], -1)[closer]
    gap = d2 - d1
    ctone = tone[best[..., 1] % 512, best[..., 0] % 512]
    # Light from top-left in screen space; (vx,vy) points from pixel to cell centre.
    lit = (bvec[..., 0] + bvec[..., 1]) * 0.9       # pixel toward bottom-right of centre -> darker
    slvl = np.clip(ctone + np.where(lit > 0.3, -1, np.where(lit < -0.3, 1, 0)), 1, 4)
    simg = shade(PAL['stone'], slvl)
    simg[gap < 0.1] = PAL['stone'][1]
    simg[(gap >= 0.1) & (gap < 0.17) & (lit > 0)] = PAL['stone'][1]
    img[stone] = simg[stone]

    # ---- bridge planks (planks cross the road, i.e. constant gx)
    plank = np.floor(gx * 4).astype(int)
    pf = gx * 4 - plank
    ptone = 2 + (np.random.default_rng(seed + 6).integers(0, 2, 4096)[plank % 4096])
    bimg = shade(PAL['wood'], ptone + (pf < 0.35))
    bimg[pf > 0.86] = PAL['wood'][0]
    img[bridge] = bimg[bridge]

    # ---- water: distance (in screen px) to the ground above / below in each column
    dist_up = np.zeros((Ht, Wd), dtype=int)
    run = np.full(Wd, 99)
    above_mat = np.full(Wd, -1)
    mat_up = np.full((Ht, Wd), -1)
    for y in range(Ht):
        run = np.where(water[y], run + 1, 0)
        above_mat = np.where(water[y], above_mat, T[y])
        dist_up[y] = run; mat_up[y] = above_mat
    dist_dn = np.zeros((Ht, Wd), dtype=int)
    run = np.full(Wd, 99)
    for y in range(Ht - 1, -1, -1):
        run = np.where(water[y], run + 1, 0)
        dist_dn[y] = run

    face = water & (dist_up >= 1) & (dist_up <= DEPTH)
    surf = water & ~face
    # Bank face: earth strata, darker towards the water line; wood under the bridge.
    strata = fbm(xs * 0.15, ys * 0.9, seed + 7, 1.0)
    k = dist_up
    flvl = np.clip(4 - (k * 4) // (DEPTH + 1) + (strata > 0.6).astype(int) - (strata < 0.35).astype(int), 0, 4)
    fimg = shade(PAL['dirt'], flvl)
    fimg[k == 1] = PAL['grass'][1]                              # grass lip
    fimg[(k == 2) & (BAYER4[ys % 4, xs % 4] > 0.5)] = PAL['grass'][0]
    wood_face = face & (mat_up == W.BRIDGE)
    wimg = shade(PAL['wood'], np.where(k <= 2, 2, 1))
    wimg[k == DEPTH] = PAL['wood'][0]
    fimg[wood_face] = wimg[wood_face]
    img[face] = fimg[face]

    # Water surface: deeper away from banks, ripple streaks and sparkles.
    depth = np.minimum(dist_up - DEPTH, dist_dn)
    base = np.clip(5 - depth // 4, 2, 5)
    rip = value_noise(xs * 0.08, ys * 0.5, seed + 8, 1.0)
    rip2 = value_noise(xs * 0.05 + 7, ys * 0.35, seed + 9, 1.0)
    wl = base + (rip > 0.72).astype(int) - (rip2 < 0.25).astype(int)
    wimg = shade(PAL['water'], wl)
    sparkle = (value_noise(xs * 0.6, ys * 1.3, seed + 10, 1.0) > 0.93)
    wimg[sparkle] = PAL['water'][7]
    foam_n = value_noise(xs * 0.3, ys * 0.3, seed + 11, 1.0)
    foam = ((dist_up - DEPTH) <= 1) & (foam_n > 0.3) | ((dist_up - DEPTH) == 2) & (foam_n > 0.7)
    wimg[foam] = PAL['water'][6]
    shore = dist_dn <= 1
    wimg[shore] = PAL['water'][6]
    img[surf] = wimg[surf]

    # ---- borders: dark lips where grass meets dirt / stone, with jagged tufts
    def shift(m, dy, dx):
        out = np.zeros_like(m)
        ys0 = slice(max(dy, 0), Ht + min(dy, 0)); ys1 = slice(max(-dy, 0), Ht + min(-dy, 0))
        xs0 = slice(max(dx, 0), Wd + min(dx, 0)); xs1 = slice(max(-dx, 0), Wd + min(-dx, 0))
        out[ys0, xs0] = m[ys1, xs1]
        return out
    nong = (dirt | stone | bridge)
    near_grass = shift(grass, 1, 0) | shift(grass, -1, 0) | shift(grass, 0, 1) | shift(grass, 0, -1)
    lip = nong & near_grass
    img[lip] = PAL['grass'][0]
    # tufts hanging down onto paths
    tuft_len = (value_noise(xs * 0.7, ys * 0.0 + 3, seed + 12, 1.0) * 3.2).astype(int)
    for d in (1, 2, 3):
        hang = nong & shift(grass, d, 0) & (tuft_len >= d)
        img[hang] = PAL['grass'][3] if d < 3 else PAL['grass'][1]
        under = nong & shift(grass, d + 1, 0) & (tuft_len == d)
        img[under & ~shift(grass, 1, 0)] = PAL['grass'][0]
    # dirt darkens just below a grass lip (shadow)
    shadow_lip = dirt & (shift(grass, 2, 0) | shift(grass, 3, 0)) & ~lip
    img[shadow_lip] = (img[shadow_lip] * 0.82).astype(np.uint8)
    # ground edge above water gets a dark outline
    img[ground & shift(water, -1, 0)] = PAL['grass'][0]

    # ---- details scattered on grass: blades, tufts, flowers; pebbles on dirt
    rng = np.random.default_rng(seed + 13)
    gyx = np.argwhere(grass)
    flowers_tile = (T == W.FLOWERS)
    def put(y, x, c):
        if 0 <= y < Ht and 0 <= x < Wd and grass[y, x]:
            img[y, x] = c
    # Grass clumps: little fans of 3-5 blades with a dark base and light tips.
    for y, x in gyx[rng.random(len(gyx)) < 0.009]:
        tall = rng.random() < 0.5
        for bx, bh in ((-2, 2), (-1, 3), (0, 4 if tall else 3), (1, 3), (2, 2)):
            if rng.random() < 0.2: continue
            put(y, x + bx, PAL['grass'][1])
            for i in range(1, bh):
                put(y - i, x + bx + (bx > 0 and i == bh - 1) - (bx < 0 and i == bh - 1),
                    PAL['grass'][5] if i == bh - 1 else PAL['grass'][4])
    # Single light blades sprinkled lightly.
    for y, x in gyx[rng.random(len(gyx)) < 0.006]:
        put(y, x, PAL['grass'][2]); put(y - 1, x, PAL['grass'][5])
    # Flower clusters: a few blossoms with petals around a centre, mostly on flower tiles.
    fl = gyx[(rng.random(len(gyx)) < 0.0006) | (flowers_tile[gyx[:, 0], gyx[:, 1]] & (rng.random(len(gyx)) < 0.004))]
    for y, x in fl:
        c = PAL['flower'][rng.integers(0, len(PAL['flower']))]
        for _ in range(rng.integers(2, 5)):
            fy, fx = y + rng.integers(-3, 4), x + rng.integers(-5, 6)
            put(fy + 1, fx, PAL['grass'][1]); put(fy + 2, fx, PAL['grass'][2])
            put(fy, fx - 1, c); put(fy, fx + 1, c); put(fy - 1, fx, c)
            put(fy, fx, PAL['flower'][0] if (c != PAL['flower'][0]).any() else PAL['flower'][4])
    dyx = np.argwhere(dirt)
    for y, x in dyx[rng.random(len(dyx)) < 0.004]:
        if dirt[y, x]: img[y, x] = PAL['dirt'][5]
        if y + 1 < Ht and dirt[y + 1, x]: img[y + 1, x] = PAL['dirt'][1]
        if rng.random() < 0.5 and x + 1 < Wd and dirt[y, x + 1]: img[y, x + 1] = PAL['dirt'][4]

    # ---- bridge rails: posts along both edges of the deck
    edge_back = bridge & ~shift(bridge, 1, 1) & shift(water, 2, 2)
    img[bridge & ~(shift(bridge, 1, 0) & shift(bridge, -1, 0))] = PAL['wood'][1]
    rail_cols = {}
    for y, x in np.argwhere(bridge):
        if not bridge[min(y + 1, Ht - 1), x]:
            rail_cols.setdefault(x, []).append(y)
    alpha = np.where(valid, 255, 0).astype(np.uint8)
    return img, alpha, (ox, oy)


def shadows(img, world, origin, kind_r={'tree': (13, 5, 5, 2), 'rock': (7, 3, 2, 1), 'bush': (7, 3, 2, 1), 'house': (30, 10, 10, 6), 'post': (2, 1, 1, 1)}):
    """Darken soft ellipses under props (light from top-left -> shadow to bottom-right)."""
    ox, oy = origin
    H, Wd = img.shape[:2]
    ys, xs = np.mgrid[0:H, 0:Wd]
    dark = np.zeros((H, Wd), dtype=bool)
    for p in world['props']:
        rx, ry, offx, offy = kind_r[p['kind']]
        cxg, cyg = (p['x'] + 0.5, p['y'] + 0.5) if p['kind'] == 'house' else (p['x'], p['y'])
        sx, sy = to_screen(cxg, cyg, ox, oy)
        sx += offx; sy += offy
        x0, x1 = int(sx - rx - 2), int(sx + rx + 3); y0, y1 = int(sy - ry - 2), int(sy + ry + 3)
        sub = (((xs[y0:y1, x0:x1] - sx) / rx) ** 2 + ((ys[y0:y1, x0:x1] - sy) / ry) ** 2)
        m = (sub < 0.75) | ((sub < 1.0) & (BAYER4[ys[y0:y1, x0:x1] % 4, xs[y0:y1, x0:x1] % 4] > 0.5))
        dark[y0:y1, x0:x1] |= m
    img[dark] = (img[dark].astype(float) * np.array([0.62, 0.68, 0.78])).astype(np.uint8)
    return img
