# Art Asset List (AI-generated)

> **Status:** the game no longer depends on this list. All world art is now produced by the
> procedural pixel-art pipeline in `tools/art/` (see `docs/ART_PIPELINE.md`), run by Claude.
> This list is kept only as an optional route for hand-made or AI-made art (for example
> detailed character portraits), if you ever want to supply some.

Style target: the reference images. That means rich 16-bit/32-bit pixel art, an isometric 3/4 view, warm torch lighting, detailed textures, and a medieval fantasy setting.

## How to deliver

1. Generate each item **separately**, one object per image.
2. Send the images in the chat with Claude, or upload them to the repo folder `art/raw/` (GitHub: **Add file → Upload files**).
3. Name each file as shown below. If you can't rename it, say which is which.
4. Claude does the rest: background removal, cropping, resizing to game size, converting ground textures into isometric tiles, and wiring them into the game.

You **don't** need to:
- remove backgrounds (a plain magenta background is easier to cut out cleanly)
- resize anything (any size is fine, but bigger is better: 512–1024 px)
- make sprite sheets

## Rules for every image

- **One object only**, centered, fully visible, not cut off at the edges.
- **Plain solid magenta background (#FF00FF)**, with no ground, no scenery, and no drop shadow. The game adds its own shadows.
- **No text**, no UI, no watermark.
- **Same light direction everywhere:** light from the **top-left**.
- For **objects and characters**, use the same isometric 3/4 angle as the reference images.
- For **ground textures**, use a flat **top-down** square that tiles seamlessly. The game converts it to the isometric diamond itself.

## Style prompt (paste at the start of every prompt)

```
16-bit pixel art, rich detailed SNES/GBA-era fantasy RPG style, crisp pixels,
limited warm palette, soft top-left lighting, high detail, game asset,
single object centered, plain solid magenta (#FF00FF) background, no shadow, no text
```

If your tool supports a **reference/style image**, attach one of the reference screenshots every time. This keeps the style consistent across all assets.

---

## Batch 1: the most visible assets (do these first)

| File name | What | Prompt (after the style prompt) |
|---|---|---|
| `grass.png` | Ground texture | `seamless tileable top-down grass texture, short lush green grass with small variations, flat square texture, no perspective` |
| `path.png` | Ground texture | `seamless tileable top-down dirt road texture, packed brown earth with small pebbles, flat square texture, no perspective` |
| `stone.png` | Ground texture | `seamless tileable top-down cobblestone pavement texture, grey rounded stones, village plaza, flat square texture, no perspective` |
| `water.png` | Ground texture | `seamless tileable top-down river water texture, blue with light ripples and sparkles, flat square texture, no perspective` |
| `tree.png` | Object | `isometric 3/4 view single leafy oak tree, full tree from roots to crown, round dense canopy, brown trunk` |
| `house.png` | Object | `isometric 3/4 view small medieval village cottage, timber frame walls, red clay tile roof, wooden door, one window, chimney, whole building visible, viewed from the front-left corner` |
| `hero.png` | Character | `isometric 3/4 view full body young male adventurer hero, messy brown hair, green tunic, brown leather belt and boots, short sword on back, standing idle, facing down-right toward the viewer` |
| `slime.png` | Monster | `isometric 3/4 view cute green slime monster, glossy jelly body, simple eyes, facing down-right` |

## Batch 2: NPCs, enemies, details

| File name | What | Prompt (after the style prompt) |
|---|---|---|
| `hero_back.png` | Character | Same as `hero.png` but `facing up-right, away from the viewer, back visible` (same character!) |
| `npc_elder.png` | NPC | `isometric 3/4 view full body old village elder woman, long white hair, purple robe, wooden staff, kind face, facing down-left` |
| `npc_smith.png` | NPC | `isometric 3/4 view full body burly blacksmith man, short black hair, leather apron, rolled sleeves, hammer in hand, facing down-right` |
| `npc_stranger.png` | NPC | `isometric 3/4 view full body mysterious hooded stranger, dark tattered cloak, face hidden in shadow, two glowing red eyes, facing down-left` |
| `wolf.png` | Monster | `isometric 3/4 view grey wolf, aggressive stance, yellow eyes, side view facing right` |
| `bridge.png` | Ground texture | `seamless tileable top-down wooden bridge planks texture, planks running horizontally, flat square texture, no perspective` |
| `flowers.png` | Ground texture | `seamless tileable top-down grass texture with scattered small yellow, white and pink wildflowers, flat square texture, no perspective` |
| `portrait_hero.png` | UI | `pixel art character portrait bust of the same hero (messy brown hair, green tunic), facing slightly left, square frame, dark plain background` (this one does NOT need magenta) |

## Batch 3: decorations (makes the world feel rich)

| File name | Prompt (after the style prompt) |
|---|---|
| `rock.png` | `isometric 3/4 view mossy grey boulder` |
| `bush.png` | `isometric 3/4 view round green leafy bush with a few berries` |
| `barrel.png` | `isometric 3/4 view wooden barrel with iron bands` |
| `fence.png` | `isometric 3/4 view short wooden fence segment, running from bottom-left to top-right` |
| `torch.png` | `isometric 3/4 view standing wooden torch post with bright flame` |
| `fountain.png` | `isometric 3/4 view round stone village fountain with water spout` |
| `mushroom_glow.png` | `isometric 3/4 view cluster of glowing purple and blue mushrooms` |
| `crystal.png` | `isometric 3/4 view glowing green mana crystal cluster` |
| `chest.png` | `isometric 3/4 view closed wooden treasure chest with gold trim` |

## Later: base building and night waves (not needed yet)

Ancient Core, wooden wall, stone wall, arrow tower, spike trap, lumber mill, stone mine, farm, mana extractor, and the other GDD races and classes. Claude will send prompts for these when those features start.

## Optional: animation frames

Walking is currently faked with a bob. For real animation, generate the **same character in the same pose set** as separate images:
`hero_walk_1.png` … `hero_walk_4.png` (walking cycle, facing down-right). AI tools often change details between frames, so only do this if your tool keeps the character consistent.

## Tips

- If a result has a background other than plain magenta, regenerate it, or send it anyway and Claude will try to cut it out.
- Pick results where the object **isn't cut off** at the image edges.
- For ground textures, check that the image has **no perspective or horizon**. It must look like a photo taken straight down.
