"""The starter region layout (village, roads, river, forest). Source of truth for
both the baked ground image and the game (written to src/world/starter.json)."""
import math
import numpy as np

N = 48
GRASS, FLOWERS, PATH, STONE, WATER, BRIDGE = 0, 1, 2, 3, 4, 5
VILLAGE = (18, 18, 29, 29)
RIVER_X = 37


def build(seed=7):
    rng = np.random.default_rng(seed)
    t = np.full((N, N), GRASS, dtype=int)
    blocked = np.zeros((N, N), dtype=bool)
    t[rng.random((N, N)) < 0.07] = FLOWERS

    x0, y0, x1, y1 = VILLAGE
    t[y0:y1 + 1, x0:x1 + 1] = STONE
    for x in range(x1, N - 3):
        t[23, x] = t[24, x] = PATH
    for y in range(y1, N - 3):
        t[y, 23] = t[y, 24] = PATH
    for y in range(3, y0):
        t[y, 23] = PATH
    # Side trail to the slime meadow (north-east), along the iso axis.
    for y in range(9, 23):
        t[y, 31] = PATH

    for y in range(N):
        wob = round(math.sin(y / 5) * 1.5)
        for dx in range(3):
            x = RIVER_X + wob + dx
            if y in (23, 24):
                t[y, x] = BRIDGE
            else:
                t[y, x] = WATER
                blocked[y, x] = True

    props = []
    def free(x, y):
        return 0 <= x < N and 0 <= y < N and not blocked[y, x] and t[y, x] in (GRASS, FLOWERS)

    houses = [(19, 19), (26, 19), (19, 26), (27, 27)]
    for hx, hy in houses:
        props.append({'kind': 'house', 'x': hx, 'y': hy, 'variant': len(props) % 2})
        blocked[hy:hy + 2, hx:hx + 2] = True

    npcs = [
        {'id': 'elder', 'name': 'Elder Maren', 'texture': 'npc_elder', 'x': 23, 'y': 21},
        {'id': 'smith', 'name': 'Toma the Smith', 'texture': 'npc_smith', 'x': 21, 'y': 25},
        {'id': 'stranger', 'name': 'Hooded Stranger', 'texture': 'npc_stranger', 'x': 43, 'y': 21},
    ]
    start = {'x': 24, 'y': 24}
    keep = npcs + [start]
    def near_keep(x, y):
        return any(abs(k['x'] - x) <= 1 and abs(k['y'] - y) <= 1 for k in keep)

    in_village = lambda x, y: x0 - 1 <= x <= x1 + 1 and y0 - 1 <= y <= y1 + 1
    spawn_rects = [(29, 8, 35, 17), (10, 31, 20, 40), (41, 28, 45, 42)]
    in_meadow = lambda x, y: any(a <= x <= c and b <= y <= d for a, b, c, d in spawn_rects)
    for y in range(N):
        for x in range(N):
            edge = x < 2 or y < 2 or x >= N - 2 or y >= N - 2
            if not free(x, y) or near_keep(x, y) or in_village(x, y) and not edge:
                continue
            r = rng.random()
            if in_meadow(x, y) and not edge:
                if r < 0.03:
                    props.append({'kind': 'bush', 'x': x, 'y': y, 'variant': int(rng.integers(0, 2))})
                continue
            if edge or r < 0.06:
                props.append({'kind': 'tree', 'x': x, 'y': y, 'variant': int(rng.integers(0, 3))})
                blocked[y, x] = True
            elif r < 0.085:
                props.append({'kind': 'rock', 'x': x, 'y': y, 'variant': int(rng.integers(0, 3))})
                blocked[y, x] = True
            elif r < 0.12:
                props.append({'kind': 'bush', 'x': x, 'y': y, 'variant': int(rng.integers(0, 2))})
    # A few rocks along the river banks for detail (decor only, never on the road).
    for y in range(2, N - 2):
        wob = round(math.sin(y / 5) * 1.5)
        for x in (RIVER_X + wob - 1, RIVER_X + wob + 3):
            if free(x, y) and not near_keep(x, y) and rng.random() < 0.25 and y not in (22, 23, 24, 25):
                props.append({'kind': 'rock', 'x': x, 'y': y, 'variant': int(rng.integers(0, 3))})
                blocked[y, x] = True

    # Bridge corner posts (decor, on the deck corners).
    bx = [x for x in range(N) if t[23, x] == BRIDGE]
    for px_ in (min(bx) - 0.5, max(bx) + 0.5):
        for py_ in (22.5, 24.5):
            props.append({'kind': 'post', 'x': px_, 'y': py_, 'variant': 0})

    blocked[0, :] = blocked[-1, :] = blocked[:, 0] = blocked[:, -1] = True
    return {
        'size': N,
        'tiles': t.tolist(),
        'blocked': blocked.astype(int).tolist(),
        'props': props,
        'npcs': npcs,
        'playerStart': start,
        'spawns': [
            {'monster': 'slime', 'x0': 29, 'y0': 8, 'x1': 35, 'y1': 17, 'count': 5},
            {'monster': 'slime', 'x0': 10, 'y0': 31, 'x1': 20, 'y1': 40, 'count': 5},
            {'monster': 'wolf', 'x0': 41, 'y0': 28, 'x1': 45, 'y1': 42, 'count': 4},
        ],
    }
