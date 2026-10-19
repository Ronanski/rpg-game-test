"""HUD / UI pieces: 9-slice panels, buttons and icons, in the style of the reference HUD."""
from __future__ import annotations

from PIL import Image
from pix import CLEAR, hexc, shade, from_rows, outline


def panel(fill: str, rim: str, size: int = 24) -> Image.Image:
    """Beveled frame: dark outer line, light rim (brighter top-left), inner dark line, flat fill."""
    im = Image.new('RGBA', (size, size), CLEAR)
    px = im.load()
    f, r = hexc(fill), hexc(rim)
    for y in range(size):
        for x in range(size):
            e = min(x, y, size - 1 - x, size - 1 - y)
            # Rounded corners: cut the outermost corner pixels.
            if (x in (0, size - 1) and y in (0, 1, size - 2, size - 1)) or (y in (0, size - 1) and x in (1, size - 2)):
                continue
            if e == 0:
                c = hexc('#07080e')
            elif e == 1:
                c = shade(r, 0.25) if (x < size - 2 and y < size - 2 and (x == 1 or y == 1)) else shade(r, -0.25)
            elif e == 2:
                c = r
            elif e == 3:
                c = hexc('#0b0d16')
            else:
                c = shade(f, 0.06) if y < 6 else f
            px[x, y] = c
    return im


def icon(rows: list[str], pal: dict[str, str]) -> Image.Image:
    return outline(from_rows(rows, {k: hexc(v) for k, v in pal.items()}), fixed=hexc('#07080e'))


ICONS = {
    # Weapons the sheets don't have (drawn at half size like the other code icons).
    'item_staff': icon([
        '.........GBG',
        '........GWBG',
        '.........GBG',
        '........WW..',
        '.......WW...',
        '......WW....',
        '.....WW.....',
        '....WW......',
        '...WW.......',
        '..WW........',
        '.WW.........',
    ], {'W': '#8a5a2b', 'G': '#c9a14a', 'B': '#7fe0ff'}),
    'item_dagger': icon([
        '........SS',
        '.......SWS',
        '......SWS.',
        '.....SWS..',
        '..G.SWS...',
        '...GWS....',
        '...BG.....',
        '..BB.G....',
        '.BB.......',
    ], {'S': '#9aa0b0', 'W': '#eef2ff', 'G': '#e8c15a', 'B': '#5a3418'}),
    'res_wood': icon([
        '..BBBBBB..',
        '.BRRRRRRB.',
        'BRrRRRRRRB',
        'BRRrRRRRRB',
        'BRRRrRRRRB',
        '.BRRRRRRB.',
        '..BBBBBB..',
    ], {'B': '#5a3418', 'R': '#a0703c', 'r': '#c9915a'}),
    'res_stone': icon([
        '...GGGG...',
        '..GLLLGG..',
        '.GLLGGGGG.',
        'GLGGGGGGDG',
        'GGGGGGGDDG',
        '.GGGGDDDG.',
        '..DDDDDD..',
    ], {'G': '#9a958e', 'L': '#c9c4bc', 'D': '#6a6762'}),
    'res_mana': icon([
        '....C....',
        '...CWC...',
        '..CCWCC..',
        '.CCCWCCC.',
        '..CCCCC..',
        '...CCC...',
        '....C....',
    ], {'C': '#5ad1ff', 'W': '#e0f8ff'}),
    'icon_build': icon([
        '.GGGG......',
        'GGGGGG.....',
        'GGGGGGW....',
        '.GG..WW....',
        '.....WW....',
        '......WW...',
        '.......WW..',
        '........WW.',
        '.........WW',
    ], {'G': '#9aa0b0', 'W': '#a0703c'}),
    'item_bow': icon([
        '....WW.....',
        '...W..S....',
        '..W....S...',
        '.W......S..',
        '.W.......S.',
        '.W......AAG',
        '.W.......S.',
        '.W......S..',
        '..W....S...',
        '...W..S....',
        '....WW.....',
    ], {'W': '#8a5a2b', 'S': '#e8e0c8', 'A': '#9aa0b0', 'G': '#e8c15a'}),
    'icon_dodge': icon([
        '....WWW....',
        '..WW...WW..',
        '.W.......W.',
        'W..........',
        'W.....W....',
        'W....WWW...',
        '.W..WWWWW..',
        '..WW..W....',
        '....WWW....',
    ], {'W': '#9fe3ff'}),
    'icon_skill': icon([
        '.....Y.....',
        '....YYY....',
        '.Y..YWY..Y.',
        '..YYYWYYY..',
        '...YWWWY...',
        '..YYYWYYY..',
        '.Y..YWY..Y.',
        '....YYY....',
        '.....Y.....',
    ], {'Y': '#ffd75e', 'W': '#fff8d0'}),
    'icon_sword': icon([
        '.........SS',
        '........SWS',
        '.......SWS.',
        '......SWS..',
        '.....SWS...',
        '.G..SWS....',
        '..GSWS.....',
        '...GS......',
        '..BBG......',
        '.BB..G.....',
        'BB.........',
    ], {'S': '#9aa0b0', 'W': '#eef2ff', 'G': '#e8c15a', 'B': '#7a4a24'}),
    'icon_talk': icon([
        '.WWWWWWWWW.',
        'WWWWWWWWWWW',
        'WWDWWDWWDWW',
        'WWWWWWWWWWW',
        '.WWWWWWWWW.',
        '..WW.......',
        '.WW........',
    ], {'W': '#f4ead0', 'D': '#3a3048'}),
    'icon_potion': icon([
        '...CCC...',
        '...BBB...',
        '...GGG...',
        '..GRRRG..',
        '.GRRWRRG.',
        '.GRRRWRG.',
        '.GRRRRRG.',
        '.GrRRRRG.',
        '..GrrrG..',
        '...GGG...',
    ], {'C': '#a07040', 'B': '#c9ccd6', 'G': '#cfe6f0', 'R': '#e04848', 'r': '#a82a3a', 'W': '#ffd0d0'}),
    'icon_scroll': icon([
        '.PPPPPPPP.',
        'PpPPPPPPpP',
        '.PLLLLLLP.',
        '.PPPPPPPP.',
        '.PLLLLLPP.',
        '.PPPPPPPP.',
        '.PLLLLLLP.',
        'PpPPPPPPpP',
        '.PPPPPPPP.',
    ], {'P': '#efdcae', 'p': '#c9a46a', 'L': '#8a6a4a'}),
    'icon_coin': icon([
        '..YYYY..',
        '.YWYYYy.',
        'YWYYYYYy',
        'YYYyyYYy',
        'YYYyyYYy',
        'YYYYYYyy',
        '.YYYYyy.',
        '..yyyy..',
    ], {'Y': '#f4c542', 'y': '#c08a1a', 'W': '#fff3b0'}),
    'icon_bag': icon([
        '...BBBB...',
        '....bb....',
        '..BBBBBB..',
        '.BBBBBBBB.',
        'BBBBGGBBBb',
        'BBBBGGBBBb',
        'BBBBBBBBbb',
        '.BBBBBBbb.',
    ], {'B': '#9a6a3a', 'b': '#6a4424', 'G': '#e8c15a'}),
}


def all_sprites() -> dict[str, Image.Image]:
    out = {
        'ui_panel': panel('#1a2034', '#8790b4'),
        'ui_panel_gold': panel('#1d1a2c', '#c9a14a'),
        'ui_button': panel('#2a3150', '#9aa3c8', 16),
        'ui_button_down': panel('#141a2c', '#5a6280', 16),
    }
    out.update(ICONS)
    return out
