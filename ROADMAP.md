# Roadmap: Aethelgard: Chronos of Fate

Each milestone ends with a **checkpoint**: a short list of things the owner can check in the web browser. A milestone counts as done only when every checkpoint item passes and the owner approves.

Status: ✅ done · 🔄 in progress · ⏳ not started

Releases follow the project rules: **Beta** and **Stable** builds ship only on the owner's explicit "GO BETA" or "GO STABLE".

---

## M0: Foundation ✅
Database schema, isometric free-roam village, NPC dialogue, real-time combat, and web + Android builds.

**Checkpoint**
- [x] The game opens at https://ronanski.github.io/rpg-game-test/
- [x] You can walk around, talk to Martha, and fight slimes

## M1: Playable prototype 🔄
- [x] Character creation: race → gender → name (easy names per race); everyone starts as a classless Adventurer
- [x] Octopath-style speech bubbles over the speaker's head
- [x] Health potions: POT button / Q key (PR #6)
- [x] A browser test link for the PR (private claude.ai page, updated with each change)
- [ ] An automatic preview link on every pull request (needs the owner's GO)
- [x] This roadmap

**Checkpoint**
- [ ] Open the test link, make a character (race, gender, name), and talk to Martha: the speech bubble appears over her head.
- [ ] Get hurt by a slime, press POT, and watch the HP go up and the potion count go down.

## M2: Art overhaul (reference style) ✅
Target look: detailed 16-bit isometric pixel art with warm torch light, matching the reference images in [docs/ASSETS.md](docs/ASSETS.md).
- [x] Art pipeline: sheets in `art/raw/` are cut out, resized and loaded into the game automatically (`python3 tools/art/build.py`)
- [x] Owner's sheets imported (`art/raw/sheet_a` … `sheet_g`): heroes, 17 NPCs, slimes, wolf, goblin, orc, skeleton, dragon, 14 buildings (tavern, forge, inn, chapel, windmill, watchtower, market, stable, ruins, tent…), trees, plants, rocks, fences, stalls, carts, lamps, animals, cave entrance, ground tiles
- [x] Code-drawn fill-ins: HUD frames and icons
- [x] HUD restyle: framed portrait panel, quest panel, icon action buttons, portrait dialogue box, pixel font
- [x] New enemies in the world: blue slimes (south woods), goblins (north-west ruins)
- [x] Walking animation: step frames (front and back for the human hero) made from the clear hero sprites. The sheets' own walk frames were too blurry and their "up" frames faced the camera, so they were not used.
- [x] Water and bridge tiles from the owner's sheet (sheet_f), with all pink background removed
- [x] Lighting: golden-hour dusk tint, and torches, lamps and the campfire glow through it (M5 adds the full day/night cycle)

**Checkpoint**
- [ ] A side-by-side screenshot of the village next to the reference looks like the same game

## M3: Save progress 🔄
- [x] Progress is saved in the browser and reloaded: hero, level, stats, gold, items, quests, story flags, position (autosave every 5 seconds, after quest changes and when the tab closes)
- [x] CONTINUE button on the title screen; NEW GAME asks for a second tap before replacing the save
- [ ] Cloud save, so the same progress works in the browser and on the phone (needs Supabase keys and an account login)

**Checkpoint**
- [ ] Level up, refresh the page, press CONTINUE, and you are still that level with the same gold

## M4: Base building (day) ⏳ (next)
- [ ] Build mode: place walls, towers, farms and mines on the town grid
- [ ] Wood, stone, gold and mana; buildings take real time to finish
- [ ] Upgrade buildings

**Checkpoint**
- [ ] Build a wall and a tower, wait for the timer, and refresh: they are still there

## M5: Night waves (tower defense) ⏳
- [ ] Day/night cycle
- [ ] Monster waves attack the Ancient Core at night; towers shoot and walls block
- [ ] Rewards for surviving a wave, losses for failing

**Checkpoint**
- [ ] Survive one night with the towers you built, and see the rewards

## M6: Jobs, skills and gear 🔄 (core done)
Jobs are earned by what you do in the game (start classless), and can be changed anytime.
- [x] Everyone starts as a classless Adventurer
- [x] Earn jobs by playing: Warrior (defeat 15 monsters), Rogue (8 critical hits), Mage (reach level 3 and learn from Old Ezra), Builder (build 5 structures, arrives with M4)
- [x] JOBS menu (JOB button under the gold, or J key): see every job, its skill and unlock progress; change job anytime
- [x] Each job attacks differently: Warrior heavy wide swing, Rogue fast strikes and more crits, Mage Firebolt (ranged, 5 MP)
- [x] MP slowly refills; race bonuses apply (Human +10% EXP, Elf +20% MP regen)
- [x] Jobs and unlock progress are saved
- [x] More actions: DODGE roll (Shift; brief invulnerability) and a SKILL per job (F): Power Strike, Whirlwind, Dash Strike, Flame Nova, Hammer Slam (MP + cooldown shown on the button)
- [x] Weapons and gear: weapon / armor / accessory slots that add stats; each job has its weapon types (Warrior sword, Rogue dagger, Mage staff); Mages need a staff to cast
- [x] BAG screen (BAG button or I): equip, unequip, drink potions
- [x] Shops: Serena (potions) and Gus (weapons, armor; buys loot)
- [x] Gear drops from goblins; mana potions from blue slimes; everyone starts with a Rusty Sword
- [ ] Sub-classes (Knight, Assassin, …) and job levels
- [ ] Bow and ranged weapons

**Checkpoint**
- [ ] Defeat 15 monsters, open JOBS, change to Warrior, and see stronger, wider hits
- [ ] Reach level 3, talk to Old Ezra, change to Mage, and cast Firebolt
- [ ] Buy an Iron Sword from Gus, equip it in BAG, and see ATK go up
- [ ] Roll through a wolf with DODGE without getting hurt, then hit it with SKILL

## M7: Story chapter 1 and new places ⏳
- [ ] Building interiors (tavern, smithy) and a cave dungeon, like the reference images
- [ ] Chapter 1 main quests and the first hint of the dark twist
- [ ] Recruit a second hero

**Checkpoint**
- [ ] Play chapter 1 from start to end without getting stuck

## M8: Beta, then Stable ⏳
- [ ] Bug fixing and balance pass
- [ ] Beta APK (only on "GO BETA")
- [ ] Stable release (only on "GO STABLE")
