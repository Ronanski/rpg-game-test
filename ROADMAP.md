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
- [x] Title screen at launch (CONTINUE / NEW GAME) and a ☰ MENU in game (Esc) with SAVE & QUIT TO TITLE
- [ ] ~~Cloud save~~ put on hold by the owner: local save only for now

**Checkpoint**
- [ ] Level up, refresh the page, press CONTINUE, and you are still that level with the same gold

## M4: Base building (day) ✅
- [x] Ancient Core on the town grounds north-east of the village; build within its glowing circle
- [x] BUILD menu (button or B): Wall, Arrow Tower, Spike Trap, Lumber Mill, Stone Mine, Farm, Mana Extractor, with costs and build times from the database design
- [x] Placement: a green/red ghost in front of the hero (or where you tap); PLACE / CANCEL
- [x] Gather resources: hit trees for wood, rocks for stone, crystals for mana
- [x] Real-time build and upgrade timers with a scaffold and countdown; they keep running after a reload
- [x] Generators fill up over real time (capped); walk past to collect
- [x] Upgrade from a building's panel (TALK next to it); walls turn to stone at level 3
- [x] Arrow towers shoot and spike traps hurt monsters that come close
- [x] Builder job unlocks after 5 buildings and builds 30% faster
- [x] Town is saved
- [ ] Cloud save of the town (on hold with M3's cloud save)
- [x] Clash of Clans style building: BUILD MODE (button or B) zooms out over the town with a grid; drag to look around, tap a building for its info, SHOP to buy, PLACE by dragging the ghost
- [x] Builders: each Builder's Hut has one builder who walks to the job and hammers; one job per builder. The first hut is free, more cost 250 gold + 100 wood, then 1000 gold + 300 stone (max 3)
- [x] MOVE a finished building from its panel
- [x] Bigger town grounds (radius 10) at the south-east, away from the village

**Checkpoint**
- [ ] Chop trees for wood, build a farm and an arrow tower, wait for the timer, and refresh: they are still there
- [ ] Leave the farm for a while, walk past it, and collect gold

## M5: Night waves (tower defense) ✅
- [x] Day/night cycle: 2.5-minute days that fade to dusk, then a dark night (torches and the Core glow); the clock pauses in menus and while the game is closed
- [x] HUD clock: day number, time to nightfall, START NIGHT button; at night, raiders left and the Core's health
- [x] Night raids: a wave walks in from the northern wilds toward the Ancient Core; later nights bring more and stronger monsters (slimes, wolves, goblins, skeletons, orcs)
- [x] Towers and traps hit raiders; walls block them, and raiders break walls they are stuck on; raiders hit the Core when they reach it
- [x] Survive: +gold, wood and stone (more each night), and buildings are repaired at dawn
- [x] Core falls: raiders steal 25% of gold, wood and stone, and morning comes
- [x] Day number saved; a night in progress resumes as the end of that day
- [x] Fewer wild monsters by day (at least 3 per area, so quests can always be done), many more at night, and they come back faster at night
- [x] A different boss leads each night (Alpha Wolf, Goblin Chief, King Slime, Skeleton Knight, Orc Warlord, Ancient Dragon), bigger and stronger every night; after the Dragon the list repeats, tougher

**Checkpoint**
- [ ] Build two towers and a wall north of the Core, press START NIGHT, and survive night 1
- [ ] On a later night, watch raiders break a wall

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
- [x] Bow (Hunter Bow from Gus): arrows fly at the first enemy in front; Rogues and Adventurers can use it
- [x] Hit and skill effects: sword arcs, sparks, shockwave rings, whirlwind, flame burst, firebolt embers, dash afterimages, screen shake on big hits
- [x] Walking feels like walking: a hop per step, lean and sway, footstep dust
- [x] Body animation: legs stride and arms swing while walking (robes sway); attacks have a wind-up and strike, the weapon swings at the hand, bows are drawn and released, staffs are raised
- [x] Starting weapon matches the character art (Elf male: bow, Elf female: staff, Human male: sword, Human female: dagger)

**Checkpoint**
- [ ] Defeat 15 monsters, open JOBS, change to Warrior, and see stronger, wider hits
- [ ] Reach level 3, talk to Old Ezra, change to Mage, and cast Firebolt
- [ ] Buy an Iron Sword from Gus, equip it in BAG, and see ATK go up
- [ ] Roll through a wolf with DODGE without getting hurt, then hit it with SKILL

## Playtest 2 fixes (owner feedback) ✅
- [x] NEW GAME always works (title menu; second tap confirms replacing the save)
- [x] Changing job changes the outfit and the weapon (sword, dagger/bow, staff)
- [x] Back to menu: ☰ MENU button / Esc
- [x] Safe zones: wild monsters stop chasing at the village and town edge and give up when you run far
- [x] Bigger town; NPCs spread out with names, jobs and markers so you can tell who is who
- [x] NPCs breathe, glance around, and villagers walk around
- [x] Better walking and attack animation: the 4 starting heroes use frame-by-frame art (walk, attack, hurt) from the owner's sheet
- [x] Frame-by-frame monsters from the owner's board: slimes (green, blue, new fire slime), goblin, orc, skeleton, and new zombie, bat and cave spider; they step between idle poses, wind up and strike, flinch when hit, and fall over when defeated (wolf and dragon keep their single picture: the board's versions overlap)
- [x] Building levels from the owner's board: Ancient Core (crystal shrine), Arrow Tower, Lumber Mill (workshop), Stone Mine (forge) and Farm (windmill) look bigger and grander each level; new buildings show their wooden frame while going up
- [x] Townsfolk from the owner's NPC board walk and gesture when you talk to them: Lena, Ned, Cole, Mabel, Old Tam and the new farmer Jory (the board changes faces between some poses, so only the rows that stay the same person are used; Martha, Grom, Serena and the other named cast keep their own art)
- [x] Weapon and skill effects from the owner's effects board: sword and flame slashes, hit stars, the Mage's fireball and fire bursts (also in Flame Nova), Power Strike blast, and a healing ring for potions
- [ ] Frame-by-frame art for the job outfits

## M7: Story chapter 1 and new places ✅
- [x] Separate places you walk into through doors (the screen fades, quests and saves come along):
  - **Old Cave** at the end of the north road: entrance hall, slime grotto, bone hall with skeletons, and Gravemaw's pit; dark, lit by torches, crystals to mine
  - **The Sleeping Fox** tavern: Mabel the innkeeper (rest for 10 gold: full HP and MP) and Old Tam
- [x] Chapter 1 main quests (quest markers ! and ? show who to talk to):
  1. Slimes at the Gate (Martha)
  2. The Hooded Stranger (Martha: go and talk to him)
  3. Crystal Thieves (Wren: defeat 6 goblins at the ruins)
  4. The Old Cave (Martha: defeat Gravemaw at the bottom of the cave)
  5. A Locket in the Dark (the Stranger: show the locket to Hana), ending on the first dark twist
- [x] The day clock stops while you are inside a cave or building; saving inside brings you back there
- [x] Grom's Smithy (walk in through the blacksmith's door): Bree, Grom's apprentice, sells stronger gear (Steel Sword, Steel Dagger, Yew Bow, Crystal Staff, Chain Mail)
- [x] Second hero: after Chapter 1, talk to Hana again and she joins you. She follows you everywhere (caves and buildings too), shoots arrows at monsters near you, and stays in your party after saving

**Checkpoint**
- [ ] Play chapter 1 from start to end without getting stuck (scripted run passes; a full hand-played run is still to do)

## M8: Beta, then Stable ⏳
- [x] In-app update: install the APK once; on launch the app downloads the newest game from the web version in the background and uses it next start (or tap UPDATE READY on the title). No internet = plays the version it has. Saves are kept.
- [ ] Check in-app update on a real phone (needs the first APK with the updater, after a merge to main)
- [ ] Bug fixing and balance pass
- [ ] Beta APK (only on "GO BETA")
- [ ] Stable release (only on "GO STABLE")
