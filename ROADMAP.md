# Roadmap: Echoes of the Core

Each milestone ends with a **checkpoint**: a short list of things the owner can check in the web browser. A milestone counts as done only when every checkpoint item passes and the owner approves.

Status: ✅ done · 🔄 in progress · ⏳ not started

Releases follow the project rules: **Beta** and **Stable** builds ship only on the owner's explicit "GO BETA" or "GO STABLE".

---

## M0: Foundation ✅
Database schema, isometric free-roam village, NPC dialogue, real-time combat, and web + Android builds.

**Checkpoint**
- [x] The game opens at https://ronanski.github.io/rpg-game-test/
- [x] You can walk around, talk to Elder Maren, and fight slimes

## M1: Playable prototype 🔄
- [x] Pick the starting hero: Kael, Lyra or Rook (PR #6)
- [x] Health potions: POT button / Q key (PR #6)
- [ ] A browser preview link on every pull request, so a feature can be tested before it is merged
- [ ] This roadmap

**Checkpoint**
- [ ] Open the PR preview link and choose each of the 3 heroes. Each one looks and plays a little differently.
- [ ] Get hurt by a slime, press POT, and watch the HP go up and the potion count go down.

## M2: Art overhaul (reference style) ⏳
Target look: detailed 16-bit isometric pixel art with warm torch light, matching the reference images in [docs/ASSETS.md](docs/ASSETS.md).
- [ ] Art pipeline: images in `art/raw/` are cut out, resized and loaded into the game automatically
- [ ] Batch 1 art: ground tiles, tree, house, hero, slime
- [ ] HUD restyle: framed portrait panel and action boxes like the reference
- [ ] Lighting: torches and a darker evening tint
- [ ] Batch 2 and 3 art: NPCs, wolf, decorations (barrels, fountain, crates, market stalls)

**Checkpoint**
- [ ] A side-by-side screenshot of the village next to the reference looks like the same game

## M3: Save progress ⏳
Today, refreshing the page loses everything (level, gold, quests).
- [ ] Progress is saved and reloaded: hero, level, gold, items, quests
- [ ] Works in the browser and on the phone with the same account

**Checkpoint**
- [ ] Level up, refresh the page, and you are still that level with the same gold

## M4: Base building (day) ⏳
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

## M6: Jobs, skills and gear ⏳
- [ ] Each job attacks differently (Mage: firebolt, Rogue: backstab)
- [ ] Job change menu and sub-classes (Knight, Assassin, …)
- [ ] Inventory and equipment screen; race bonuses apply

**Checkpoint**
- [ ] Change Kael to Mage, equip a staff, and cast firebolt

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
