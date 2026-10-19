"""Cuts sprites out of the owner's AI-generated sheets in art/raw/ and fits them to game size.

Each sheet has objects on a plain white background. For every object listed in SPECS this:
  1. crops its box, and removes the white background (and big white gaps, e.g. inside a bow),
  2. turns the grey ground shadow into a soft transparent shadow,
  3. resizes to the in-game size and reduces it to a small palette, so it stays crisp pixel art.
Ground tiles instead sample the top face of the iso block into a 64x32 diamond.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

RAW = Path(__file__).resolve().parents[2] / 'art' / 'raw'

# key: (sheet, (x0, y0, x1, y1), target height in world px)
SPRITES = {
    'hero_front': ('sheet_b.jpg', (1603, 1149, 1913, 1546), 58),
    'hero_back': ('sheet_b.jpg', (1306, 1555, 1616, 1960), 58),
    'hero_lyra': ('sheet_a.jpg', (1304, 1154, 1482, 1463), 58),
    'hero_rook': ('sheet_a.jpg', (1034, 835, 1266, 1119), 56),
    'npc_elder': ('sheet_d.webp', (562, 644, 630, 724), 56),
    'npc_smith': ('sheet_d.webp', (651, 644, 726, 724), 56),
    'npc_stranger': ('sheet_d.webp', (740, 644, 809, 724), 58),
    'npc_villager_m': ('sheet_d.webp', (831, 648, 876, 724), 54),
    'npc_villager_f': ('sheet_d.webp', (896, 648, 955, 724), 54),
    'npc_archer': ('sheet_a.jpg', (1309, 813, 1506, 1118), 56),
    'npc_knight': ('sheet_a.jpg', (1514, 1180, 1712, 1463), 56),
    'npc_guard': ('sheet_a.jpg', (1744, 1190, 1942, 1463), 56),
    'npc_wizard': ('sheet_a.jpg', (1059, 1160, 1247, 1468), 58),
    'wolf': ('sheet_a.jpg', (1223, 465, 1482, 678), 40),
    'goblin': ('sheet_a.jpg', (1498, 460, 1696, 683), 46),
    'skeleton': ('sheet_a.jpg', (1714, 430, 1926, 693), 54),
    'house_thatch': ('sheet_a.jpg', (39, 685, 572, 1143), 118),
    'house_small': ('sheet_a.jpg', (939, 20, 1316, 383), 96),
    'tavern': ('sheet_b.jpg', (1142, 9, 1975, 772), 150),
    'house_red': ('sheet_d.webp', (8, 834, 142, 986), 126),
    'chapel': ('sheet_d.webp', (142, 834, 263, 986), 140),
    'windmill': ('sheet_d.webp', (254, 832, 374, 988), 150),
    'watchtower': ('sheet_d.webp', (376, 832, 456, 986), 140),
    'market': ('sheet_d.webp', (456, 832, 594, 986), 96),
    'blacksmith': ('sheet_e.webp', (582, 256, 782, 450), 120),
    'well': ('sheet_e.webp', (785, 268, 892, 450), 70),
    'stall_red': ('sheet_e.webp', (1070, 278, 1180, 418), 66),
    'stall_yellow': ('sheet_e.webp', (1188, 250, 1273, 362), 64),
    'stall_blue': ('sheet_e.webp', (1274, 258, 1353, 354), 60),
    'stall_green': ('sheet_e.webp', (1236, 356, 1322, 452), 64),
    'cart': ('sheet_e.webp', (1356, 262, 1468, 348), 46),
    'hay_cart': ('sheet_e.webp', (1386, 362, 1474, 452), 44),
    'lamp': ('sheet_e.webp', (1474, 260, 1530, 384), 56),
    # Item icons (inventory, shop, buttons).
    'item_sword': ('sheet_e.webp', (1367, 914, 1393, 946), 24),
    'item_shield': ('sheet_e.webp', (1397, 915, 1422, 946), 24),
    'item_health_potion': ('sheet_e.webp', (1426, 910, 1451, 944), 24),
    'item_mana_potion': ('sheet_h.webp', (947, 871, 969, 900), 22),
    'item_core_shard': ('sheet_e.webp', (1422, 955, 1447, 983), 22),
    'item_slime_gel': ('sheet_h.webp', (983, 871, 1004, 900), 22),
    'item_wolf_pelt': ('sheet_e.webp', (1398, 953, 1419, 983), 22),
    'item_bag': ('sheet_h.webp', (1156, 871, 1180, 900), 22),
    'item_coin': ('sheet_e.webp', (1371, 991, 1394, 1017), 20),
    # Town buildings (M4).
    'b_core': ('sheet_c.png', (384, 566, 556, 723), 104),
    'b_stone_wall': ('sheet_f.webp', (12, 298, 74, 391), 40),
    'b_tower': ('sheet_d.webp', (376, 832, 456, 986), 92),
    'b_mine': ('sheet_f.webp', (96, 167, 180, 252), 62),
    'b_extractor': ('sheet_c.png', (384, 566, 556, 723), 36),
    # sheet_h: the owner's named cast (see docs/WORLD.md).
    'npc_martha': ('sheet_h.webp', (482, 562, 553, 661), 56),
    'npc_grom': ('sheet_h.webp', (564, 555, 653, 659), 56),
    'npc_serena': ('sheet_h.webp', (671, 555, 741, 658), 54),
    'npc_vaelen': ('sheet_h.webp', (768, 548, 873, 659), 62),
    'npc_kaelah': ('sheet_h.webp', (878, 560, 978, 659), 54),
    'npc_lyra': ('sheet_h.webp', (1000, 555, 1086, 660), 54),
    'npc_bran': ('sheet_h.webp', (485, 708, 547, 798), 54),
    'npc_ignis': ('sheet_h.webp', (551, 713, 605, 798), 54),
    'npc_valerius': ('sheet_h.webp', (609, 717, 670, 798), 54),
    'npc_borgan': ('sheet_h.webp', (674, 712, 740, 798), 54),
    'npc_nixie': ('sheet_h.webp', (745, 712, 795, 799), 54),
    'npc_torbin': ('sheet_h.webp', (805, 710, 878, 798), 52),
    'npc_hilda': ('sheet_h.webp', (884, 710, 936, 798), 56),
    'npc_harek': ('sheet_h.webp', (935, 712, 986, 798), 54),
    'npc_zephyr': ('sheet_h.webp', (1038, 716, 1108, 798), 56),
    # sheet_f (magenta): more NPCs, monsters, buildings, animals and props.
    'npc_merchant': ('sheet_f.webp', (710, 562, 773, 657), 56),
    'npc_healer': ('sheet_f.webp', (959, 555, 1009, 655), 56),
    'npc_child': ('sheet_f.webp', (639, 690, 681, 776), 42),
    'npc_bard': ('sheet_f.webp', (954, 684, 1018, 778), 54),
    'npc_ranger': ('sheet_f.webp', (784, 686, 843, 778), 56),
    'npc_thief': ('sheet_f.webp', (867, 686, 924, 777), 54),
    'slime_blue': ('sheet_f.webp', (1184, 574, 1255, 631), 30),
    'slime_purple': ('sheet_f.webp', (1299, 569, 1373, 628), 30),
    'slime_king': ('sheet_f.webp', (1411, 559, 1483, 629), 46),
    'orc': ('sheet_f.webp', (1280, 656, 1378, 732), 56),
    'dragon': ('sheet_f.webp', (1360, 753, 1525, 832), 130),
    'inn': ('sheet_f.webp', (946, 30, 1074, 177), 128),
    'warehouse': ('sheet_f.webp', (551, 225, 674, 340), 100),
    'ruins': ('sheet_f.webp', (548, 381, 682, 505), 100),
    'tent': ('sheet_f.webp', (806, 385, 929, 498), 84),
    'stable': ('sheet_f.webp', (941, 384, 1068, 498), 90),
    'deer': ('sheet_f.webp', (10, 861, 52, 914), 40),
    'boar': ('sheet_f.webp', (62, 865, 110, 913), 34),
    'rabbit': ('sheet_f.webp', (114, 869, 150, 911), 20),
    'chicken': ('sheet_f.webp', (155, 874, 193, 913), 20),
    'cow': ('sheet_f.webp', (197, 866, 245, 913), 36),
    'horse': ('sheet_f.webp', (247, 866, 295, 913), 42),
    'grave': ('sheet_f.webp', (544, 933, 585, 997), 34),
    'bone_pile': ('sheet_f.webp', (590, 931, 637, 994), 26),
    'stump': ('sheet_f.webp', (838, 862, 884, 910), 26),
    'fountain': ('sheet_b.jpg', (1157, 712, 1609, 1147), 62),
    'chest': ('sheet_b.jpg', (1650, 806, 1945, 1093), 30),
    'crystal': ('sheet_c.png', (384, 566, 556, 723), 32),
    'gate': ('sheet_c.png', (1305, 534, 1522, 719), 38),
    'barrel': ('sheet_c.png', (206, 796, 318, 943), 28),
    'crate': ('sheet_c.png', (333, 815, 454, 948), 26),
    'barrels': ('sheet_c.png', (465, 765, 635, 958), 40),
    'signpost': ('sheet_c.png', (656, 771, 772, 950), 40),
    'campfire': ('sheet_c.png', (1385, 777, 1526, 970), 34),
    'cave': ('sheet_c.png', (1100, 702, 1379, 999), 104),
}
# Animated: list of boxes become frames of one sheet (same canvas size).
ANIMS = {
    'slime': ('sheet_b.jpg', [(37, 1311, 299, 1517), (357, 1272, 611, 1517), (678, 1279, 939, 1517)], 30),
    # Nature and village props (sheet_c). Variants are frames; the game picks one per spot.
    'tree': ('sheet_c.png', [(27, 25, 355, 399), (359, 15, 684, 399), (692, 12, 1011, 416)], 112),
    'pine': ('sheet_c.png', [(1023, 29, 1275, 415), (1282, 37, 1524, 426)], 120),
    'bush': ('sheet_c.png', [(26, 408, 186, 545), (198, 406, 377, 550), (387, 404, 567, 552)], 32),
    'flowers': ('sheet_c.png', [(583, 431, 711, 537), (723, 435, 831, 541), (846, 437, 972, 539), (985, 411, 1123, 538)], 24),
    'rock': ('sheet_c.png', [(17, 573, 178, 710), (190, 566, 372, 726)], 30),
    'mushroom': ('sheet_c.png', [(569, 582, 689, 710), (704, 582, 847, 712)], 24),
    'fence': ('sheet_c.png', [(867, 557, 1082, 714), (1085, 557, 1307, 714)], 32),
    # The two torches differ slightly, so alternating them makes the flame flicker.
    'torch': ('sheet_c.png', [(15, 739, 105, 961), (115, 730, 195, 960)], 50),
}
TILES = {
    'tile_grass_deco': ('sheet_b.jpg', (27, 22, 713, 424)),
    'tile_stone': ('sheet_b.jpg', (28, 428, 713, 814)),
    'tile_path': ('sheet_b.jpg', (28, 826, 713, 1220)),
}
PORTRAITS = {
    # Head-and-shoulders crop for the HUD / dialogue portraits: (sheet, box)
    'portrait_hero': ('sheet_b.jpg', (1306, 1149, 1530, 1330)),
}

_cache: dict[str, np.ndarray] = {}


def sheet(name: str) -> np.ndarray:
    if name not in _cache:
        _cache[name] = np.asarray(Image.open(RAW / name).convert('RGB')).astype(np.float32)
    return _cache[name]


# Sheets drawn on a grey/white checkerboard ("fake transparency") instead of plain white.
CHECKER = {'sheet_d.webp', 'sheet_e.webp', 'sheet_h.webp'}
# Sheets drawn on solid magenta.
MAGENTA = {'sheet_f.webp'}


def cut(name: str, box, pad: int | None = None) -> tuple[np.ndarray, np.ndarray]:
    """Returns (rgb, alpha 0..1) with the white (or checkerboard) background removed."""
    a = sheet(name)
    if pad is None:
        pad = 1 if name in CHECKER or name in MAGENTA else 6  # these sheets are packed tight
    x0, y0, x1, y1 = box
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(a.shape[1], x1 + pad), min(a.shape[0], y1 + pad)
    rgb = a[y0:y1, x0:x1]
    if name in MAGENTA:
        r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        white = (r > 110) & (b > 110) & (g < 0.6 * np.minimum(r, b)) & (np.abs(r - b) < 45)
    elif name in CHECKER:
        white = ((rgb.max(axis=2) - rgb.min(axis=2)) < 20) & (rgb.mean(axis=2) > 170)
    else:
        white = rgb.min(axis=2) > 228
    lab, _ = ndi.label(white)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge))
    # Enclosed white gaps (between legs, inside a bow) are background too; small ones are highlights.
    sizes = ndi.sum(white, lab, index=np.arange(lab.max() + 1))
    bg |= white & (sizes[lab] > 250)
    # Drop the anti-aliased white fringe around the sprite.
    if name in MAGENTA:
        # Pink halo left by the magenta background.
        r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        fringe = ndi.binary_dilation(bg, iterations=2) & (r > 130) & (b > 120) & (g < r - 40)
    else:
        fringe = ndi.binary_dilation(bg, iterations=2) & (rgb.min(axis=2) > (165 if name in CHECKER else 200))
    alpha = (~(bg | fringe)).astype(np.float32)
    # Keep only the main object (neighbouring sprites can poke into the box).
    lab2, n2 = ndi.label(ndi.binary_dilation(alpha > 0, iterations=3))
    if n2 > 1:
        sizes2 = ndi.sum(alpha > 0, lab2, index=np.arange(1, n2 + 1))
        alpha[lab2 != 1 + int(np.argmax(sizes2))] = 0

    # Ground shadow: light, low-saturation grey in the lower part -> translucent dark.
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    lum = rgb.mean(axis=2)
    rows = np.arange(rgb.shape[0])[:, None] / rgb.shape[0]
    shadow = (alpha > 0) & (sat < 22) & (lum > 150) & (lum < 228) & (rows > 0.72)
    shadow = ndi.binary_opening(shadow, iterations=2)
    alpha[shadow] = 0.35
    rgb = rgb.copy()
    rgb[shadow] = (20, 16, 30)
    return rgb, alpha


def shrink(rgb: np.ndarray, alpha: np.ndarray, height: int, colors: int = 40) -> Image.Image:
    """Area-resize to the target height, then snap to a small palette and hard alpha."""
    ys, xs = np.nonzero(alpha)
    rgb, alpha = rgb[ys.min():ys.max() + 1, xs.min():xs.max() + 1], alpha[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h = height
    w = max(1, round(rgb.shape[1] * h / rgb.shape[0]))
    pre = np.dstack([rgb * alpha[..., None], alpha * 255]).astype(np.uint8)
    small = np.asarray(Image.fromarray(pre, 'RGBA').resize((w, h), Image.BOX)).astype(np.float32)
    a = small[..., 3] / 255
    col = np.where(a[..., None] > 0, small[..., :3] / np.maximum(a[..., None], 1e-3), 0)
    col = np.clip(col, 0, 255).astype(np.uint8)
    q = Image.fromarray(col, 'RGB').quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    out_a = np.where(a > 0.55, 255, np.where((a > 0.2) & (a < 0.45), 90, 0)).astype(np.uint8)
    # Pixels that were only shadow keep the soft shadow alpha.
    return Image.fromarray(np.dstack([np.asarray(q), out_a]), 'RGBA')


def sprite(name, box, height) -> Image.Image:
    return shrink(*cut(name, box), height)


def tile(name, box, w: int = 64, h: int = 32, inset: float = 0.9) -> Image.Image:
    """Samples the top diamond of an iso block (inset past its outline) into a w x h tile."""
    rgb, alpha = cut(name, box, pad=0)
    ys, xs = np.nonzero(alpha > 0.5)
    left_x, right_x, top_y = xs.min(), xs.max(), ys.min()
    left_y = ys[xs == left_x].min()
    right_y = ys[xs == right_x].min()
    top_x = int(np.median(xs[ys == top_y]))
    L, R, T = np.array([left_x, left_y], float), np.array([right_x, right_y], float), np.array([top_x, top_y], float)
    B = L + R - T
    C = (L + R + T + B) / 4
    L, R, T, B = [C + (p - C) * inset for p in (L, R, T, B)]
    # Area-average the source down first so sampling is not noisy.
    scale = (R[0] - L[0]) / w
    src = Image.fromarray(rgb.astype(np.uint8)).resize((max(1, round(rgb.shape[1] / scale)), max(1, round(rgb.shape[0] / scale))), Image.BOX)
    s = np.asarray(src)
    out = np.zeros((h, w, 4), np.uint8)
    for y in range(h):
        half = (y + 1) * (w // h) if y < h // 2 else (h - y) * (w // h)
        for x in range(w // 2 - half, w // 2 + half):
            sx, sy = (x + 0.5 - w / 2) / (w / 2), (y + 0.5 - h / 2) / (h / 2)
            u, v = (sx + sy) / 2 + 0.5, (sy - sx) / 2 + 0.5  # u: toward R, v: toward L (from T)
            p = T + (R - T) * u + (L - T) * v
            px, py = int(p[0] / scale), int(p[1] / scale)
            out[y, x, :3] = s[min(py, s.shape[0] - 1), min(px, s.shape[1] - 1)]
            out[y, x, 3] = 255
    q = Image.fromarray(out[..., :3]).quantize(colors=24, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    return Image.fromarray(np.dstack([np.asarray(q), out[..., 3]]), 'RGBA')


def fill_magenta(im: Image.Image) -> Image.Image:
    """Paints over leftover magenta background pixels with the colors of their neighbours."""
    a = np.asarray(im).copy()
    r, g, b = (a[..., i].astype(int) for i in range(3))
    # Any pink / purple tint (red and blue both well above green), dark or bright.
    bad = (a[..., 3] > 0) & (r - g > 25) & (b - g > 25)
    for _ in range(24):
        if not bad.any():
            break
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            src = np.roll(np.roll(a, dy, 0), dx, 1)
            ok = np.roll(np.roll(~bad & (a[..., 3] > 0), dy, 0), dx, 1)
            fix = bad & ok
            a[fix, :3] = src[fix, :3]
            bad &= ~fix
    return Image.fromarray(a, 'RGBA')


def texture_tile(name, rect, w: int = 64, h: int = 32) -> Image.Image:
    """Fills a w x h diamond with a flat rectangle of the sheet (e.g. bridge planks), stretched to fit."""
    x0, y0, x1, y1 = rect
    src = np.asarray(Image.fromarray(sheet(name)[y0:y1, x0:x1].astype(np.uint8)).resize((w // 2, h), Image.BOX))
    out = np.zeros((h, w, 4), np.uint8)
    for y in range(h):
        half = (y + 1) * (w // h) if y < h // 2 else (h - y) * (w // h)
        for x in range(w // 2 - half, w // 2 + half):
            out[y, x, :3] = src[y, (x // 2) % src.shape[1]]
            out[y, x, 3] = 255
    return Image.fromarray(out, 'RGBA')


def _paste(dst: np.ndarray, src: np.ndarray, dx: int, dy: int):
    """Pastes the opaque pixels of src onto dst, shifted by (dx, dy)."""
    h, w = src.shape[:2]
    ys, xs = np.nonzero(src[..., 3] > 0)
    ty, tx = ys + dy, xs + dx
    ok = (ty >= 0) & (ty < dst.shape[0]) & (tx >= 0) & (tx < dst.shape[1])
    dst[ty[ok], tx[ok]] = src[ys[ok], xs[ok]]


def soften_shadow(im: Image.Image) -> Image.Image:
    """Turns the opaque ground shadow at a character's feet into a soft translucent one.

    Shadow = the largest connected patch of greyish (low-saturation, mid-light) pixels in the
    bottom of the sprite. Boots are saturated browns and stay; a separate sword tip stays too.
    """
    a = np.asarray(im).copy()
    h = a.shape[0]
    rgb = a[..., :3].astype(int)
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    lum = rgb.mean(axis=2)
    y = np.arange(h)[:, None]
    cand = (a[..., 3] > 0) & (y > h * 0.76) & (sat < 32) & (lum > 80) & (lum < 215)
    lab, n = ndi.label(cand)
    if n:
        sizes = ndi.sum(cand, lab, index=np.arange(1, n + 1))
        biggest = 1 + int(np.argmax(sizes))
        m = ndi.binary_dilation(lab == biggest, iterations=1) & cand | (lab == biggest)
        a[m] = (20, 16, 30, 90)
    return Image.fromarray(a, 'RGBA')


def walk_frames(im: Image.Image, robe: bool = False) -> list[Image.Image]:
    """Idle + two stride poses from one standing sprite.

    The figure is split into body, left/right arms (outer columns of the torso) and left/right
    legs (bottom quarter). In each stride one leg steps forward (down 1px, out 1px) while the
    other lifts (up 3px), the arms swing the opposite way, and the body bobs up 1px.
    """
    a = np.asarray(im)
    pad = 3
    a = np.pad(a, ((pad, 0), (1, 1), (0, 0)))  # room for the lift and the stride
    # The baked-in ground shadow (semi-transparent) stays put; only the solid figure moves.
    shadow = np.where(a[..., 3:4] < 255, a, 0)
    a = np.where(a[..., 3:4] == 255, a, 0)
    ys, xs = np.nonzero(a[..., 3] > 0)
    top, bottom = ys.min(), ys.max() + 1
    left, right = xs.min(), xs.max() + 1
    cx = (left + right) // 2
    hgt = bottom - top
    legs = bottom - max(4, hgt // 4)
    chest, waist = top + hgt * 2 // 5, legs
    arm_w = max(2, (right - left) // 5)

    def part(y0, y1, x0, x1):
        p = np.zeros_like(a)
        p[y0:y1, x0:x1] = a[y0:y1, x0:x1]
        return p

    body = a.copy()
    body[legs:] = 0
    body[chest:waist, left:left + arm_w] = 0
    body[chest:waist, right - arm_w:right] = 0
    arm_l, arm_r = part(chest, waist, left, left + arm_w), part(chest, waist, right - arm_w, right)
    leg_l, leg_r = part(legs, bottom, 0, cx), part(legs, bottom, cx, a.shape[1])

    frames = [Image.fromarray(np.where(a[..., 3:4] > 0, a, shadow), 'RGBA')]
    if robe:
        # Long robes: no separate legs. The hem sways 1px each way and the body bobs.
        for d in (-1, 1):
            f = shadow.copy()
            hem = np.zeros_like(a)
            hem[legs:] = a[legs:]
            top_part = a.copy()
            top_part[legs:] = 0
            _paste(f, hem, d, 0)
            _paste(f, top_part, 0, -1)
            # Fill the 1px seam the bob leaves above the hem.
            seam = np.zeros_like(a)
            seam[legs - 1] = a[legs - 1]
            _paste(f, seam, d, 0)
            frames.append(Image.fromarray(f, 'RGBA'))
        return frames
    for step in (0, 1):
        f = shadow.copy()
        fwd, back = (leg_l, leg_r) if step == 0 else (leg_r, leg_l)
        fwd_out = -1 if step == 0 else 1
        _paste(f, back, 0, -3)          # lifting leg
        _paste(f, fwd, fwd_out, 1)      # planted leg reaching forward
        _paste(f, body, 0, -1)
        # Arms swing opposite to the legs.
        _paste(f, arm_l, 0, 1 if step == 1 else -2)
        _paste(f, arm_r, 0, 1 if step == 0 else -2)
        frames.append(Image.fromarray(f, 'RGBA'))
    return frames


# Rock/stone art from the magenta sheet keeps a purple outline; it has no real purple, so drop it all.
PURGE_PURPLE = {'b_mine', 'b_stone_wall'}


def purge_purple(im: Image.Image) -> Image.Image:
    """Recolors any purple-tinted pixel to a neutral dark grey (for art that has no real purple)."""
    a = np.asarray(im).copy()
    r, g, b = (a[..., i].astype(int) for i in range(3))
    bad = (a[..., 3] > 0) & (r - g > 18) & (b - g > 18)
    grey = ((r + g + b) // 3 * 0.8).astype(np.uint8)
    for i in range(3):
        a[..., i] = np.where(bad, grey, a[..., i])
    return Image.fromarray(a, 'RGBA')


def drop_magenta(im: Image.Image) -> Image.Image:
    """Makes leftover magenta background pixels transparent. Real purples (Lyra's robe, purple
    slime, mushrooms) keep some green and are left alone."""
    a = np.asarray(im).copy()
    r, g, b = (a[..., i].astype(int) for i in range(3))
    a[(r > 140) & (b > 140) & (g < 60) & (np.abs(r - b) < 60), 3] = 0
    return Image.fromarray(a, 'RGBA')


def frames_same_canvas(frames: list[Image.Image]) -> list[Image.Image]:
    w = max(f.width for f in frames)
    h = max(f.height for f in frames)
    out = []
    for f in frames:
        c = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        c.paste(f, ((w - f.width) // 2, h - f.height))
        out.append(c)
    return out


def all_sprites() -> dict:
    out: dict = {}
    for key, (name, box, height) in SPRITES.items():
        out[key] = sprite(name, box, height)
        if name in MAGENTA:
            out[key] = drop_magenta(out[key])
        if key in PURGE_PURPLE:
            out[key] = purge_purple(out[key])
    # Playable sprites get step frames: front idle/step/step (+ back idle/step/step for the hero).
    front, back = frames_same_canvas([out.pop('hero_front'), out.pop('hero_back')])
    out['hero'] = walk_frames(soften_shadow(front)) + walk_frames(soften_shadow(back))
    # Playable outfits (starting looks and job outfits) get walk frames.
    for key in ('hero_rook', 'npc_knight', 'npc_hilda', 'npc_kaelah', 'npc_borgan'):
        out[key] = walk_frames(soften_shadow(out[key]))
    for key in ('hero_lyra', 'npc_healer', 'npc_valerius'):
        out[key] = walk_frames(soften_shadow(out[key]), robe=True)
    for key, (name, boxes, height) in ANIMS.items():
        frames = [sprite(name, b, height) for b in boxes]
        out[key] = frames_same_canvas(frames)
    water = fill_magenta(tile('sheet_f.webp', (272, 49, 358, 127), inset=0.5))
    out['tile_water'] = [water, water.transpose(Image.FLIP_LEFT_RIGHT), water.transpose(Image.ROTATE_180), water.transpose(Image.FLIP_TOP_BOTTOM)]
    out['tile_bridge'] = fill_magenta(texture_tile('sheet_f.webp', (158, 324, 198, 342)))
    for key, (name, box) in TILES.items():
        t = tile(name, box)
        # Mirrored copies break up the repeat (a mirrored diamond is still a diamond).
        out[key] = [t, t.transpose(Image.FLIP_LEFT_RIGHT), t.transpose(Image.ROTATE_180), t.transpose(Image.FLIP_TOP_BOTTOM)]
    for key, (name, box) in PORTRAITS.items():
        out[key] = shrink(*cut(name, box), 64)
    return out
