# Animation Art (AI-generated frames)

Characters today are a single picture that the game nudges and squashes, so they look like paper cutouts.
To make legs and arms really move, each character needs **several pictures of the same character in
different poses** (frames), played quickly like a flipbook.

## The 4 heroes first

| File name | Who | In game now |
|---|---|---|
| `anim_human_m.png` | Human male: messy brown hair, green tunic, brown cloak, sword and small shield | `hero` |
| `anim_human_f.png` | Human female: white-haired healer in a white robe, dagger (the current art is blurry, so a cleaner redraw of the same idea is welcome) | `npc_healer` |
| `anim_elf_m.png` | Elf male archer: brown hair, green tunic, quiver, longbow | `hero_rook` |
| `anim_elf_f.png` | Elf female mage: purple witch hat and robe, long brown hair, wooden staff with an orb | `hero_lyra` |

After these work in game, the job outfits (Knight, Hilda, Kaelah, Valerius, Borgan) follow the same way.

## One image per character: a strip of frames

Make **one image per character** with **all frames side by side in one row**. Keeping them in one image
helps the AI draw the same face, hair and clothes in every frame.

Frames, left to right (8 in total):

| # | Pose |
|---|---|
| 1 | Idle: standing |
| 2 | Walk: left foot forward, right arm forward |
| 3 | Walk: feet together (passing) |
| 4 | Walk: right foot forward, left arm forward |
| 5 | Walk: feet together (passing) |
| 6 | Attack: wind-up (sword raised / bow drawn back / staff raised) |
| 7 | Attack: strike (sword swung down / arrow released / staff pointed forward) |
| 8 | Hurt: leaning back |

## Rules

- **Attach the character's current picture as the reference image** (download it from
  `public/assets/sprites/<name>.png`, or ask Claude to send it). This is what keeps the look the same.
- Every frame faces the **same direction: 3/4 view facing down-right**, the same angle as now.
  The game flips it for walking left.
- **Same size and same feet line** in every frame. Don't zoom in or out between frames.
- Leave **empty space between frames**; frames must not touch.
- **Transparent background** if your tool can do it; if not, **plain white**. Do not use magenta or pink.
- No shadow on the ground, no text, no frame numbers.
- Bigger is better: about 2048 px wide for the whole strip.

## Prompt (copy and paste; change the part in brackets)

```
16-bit pixel art sprite sheet, SNES/GBA-era fantasy RPG style, crisp pixels, soft top-left lighting.
The exact same character as the reference image: [human male hero, brown hair, green tunic, holding a sword].
8 frames in one horizontal row, evenly spaced, same size, same feet line, all facing 3/4 down-right:
1 idle standing, 2 walk left foot forward, 3 walk passing, 4 walk right foot forward, 5 walk passing,
6 attack wind-up [sword raised], 7 attack strike [sword swung down], 8 hurt leaning back.
Transparent background (or plain white), no ground shadow, no text, no numbers.
```

Weapon wording for the brackets:
- Sword: wind-up `sword raised over shoulder`, strike `sword swung down in front`
- Dagger: wind-up `dagger pulled back`, strike `dagger stabbing forward`
- Bow: wind-up `bow drawn with arrow nocked`, strike `arrow released, arm extended`
- Staff: wind-up `staff raised high, glowing tip`, strike `staff pointed forward, casting`

## If the AI messes it up

- If the faces or clothes differ between frames, try again, or send the best 2–3 attempts. Claude can
  take the best frame of each pose from different attempts.
- If it cannot do 8 frames in a row, do the **walk (frames 1–5)** first. That alone fixes most of the
  "paper" look.

## Delivery

Send the images in the chat with Claude, or upload them to `art/raw/` with the file names above.
Claude cuts out the frames, lines them up on the same feet line, and wires them into the game.
