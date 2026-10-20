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

## Playtest 3 fixes (owner's phone test) ✅
- [x] Monsters no longer walk backwards (each one's art facing is known)
- [x] Nights always end: raiders push through trees in the wilds, and after 2.5 minutes the rest flee at dawn
- [x] Zoom: + / − buttons, pinch with two fingers, mouse wheel
- [x] Tap an NPC to walk over and talk
- [x] ATTACK auto-targets the nearest monster (dashing in if needed); a red ring shows the target
- [x] A guide arrow at the screen edge points to the next goal (new quest, monsters to defeat, who to report to, the Core at night)
- [x] Bigger, easier to read HUD text on phones; townsfolk, heroes and Hana the same height; orcs bigger
- [x] Mini-map in the owner's compass ring (top right): hero arrow, quest pins (! and ?), the goal star, doors, the Core, monsters (red), shops (gold); works in the cave and buildings too
- [x] Big map: tap the mini-map, the MAP icon or press M; shows the whole area with place names
- [x] Icons from the owner's UI kit: settings (menu), zoom + / −, map, bag, build, quests
- [x] Elf archer walks in 3 directions from the owner's sheet: toward the camera, away from it (you see his back), and sideways (mirrored for left); he keeps facing that way when he stops
- [ ] 3-direction walks for the other heroes (characters without them still have one facing, 3/4 front): walking up shows their face. Needs back and side walk frames (owner's art)

## Next: roadmap from here
| # | Stage | What | Needs GO? |
|---|---|---|---|
| R1 | Archer kit ✅ | Multi Shot, Piercing (Lv3), Rain of Arrows (Lv5), Fire Arrows (Lv7) | no |
| R2 | Balance and bug pass ✅ | long automated runs (10 nights), difficulty, prices, EXP, gold | no |
| R3 | Tutorial ✅ | short guide on the first play: walk, AUTO, quests, build, night | no |
| R4 | Chapter 2: Sylvan ✅ | new region, monsters, boss, story after the Core's secret | no |
| R5 | Beta | Beta APK for other testers | GO BETA |
| R6 | Stable | official release | GO STABLE |

## UI and asset audit ✅
Measured on 8 screen sizes (568x320 old phone up to 1280x720) with a script that checks every HUD piece for overlap, off-screen and touch size:
- [x] One layout rule: the same 10 px margin on every edge, plus the phone's notch / rounded corners (safe area)
- [x] The HUD shrinks a little more on narrow phones so the top panels never meet (they overlapped before on 568-844 px wide screens)
- [x] The row under the hero panel lines up with it edge to edge: gold and resources in four equal slots, then JOB, BAG, BUILD, AUTO with icons
- [x] Every button is at least 44 px to touch (iOS / Android standard), even when it is drawn smaller (gear, zoom, START NIGHT, close)
- [x] Action buttons use the owner's painted icons (ATTACK sword-and-shield, SKILL star) and all icons fill the same box
- [x] Zoom + / − sit centred beside the mini-map; tap the mini-map for the big map
- [x] Guide arrow label on a dark chip so it reads over the ground; NPC roles ("Potions") only show up close, so fewer labels pile up
- [x] Tutorial tip fits between the joystick and the buttons on every size
- [x] Assets: 205 sprites, none missing, none mismatched, no pink, 1.6 MB in total; 21 old unused ones are kept for later
- [x] Removed dead code (an unused HUD label); ESC no longer cancels placing twice

## Playtest 6: UI polish ✅
- [x] Build mode and placing buttons (SHOP, DONE, PLACE, CANCEL) use the black-and-gold frame like the rest of the game
- [x] MENU and building panels are only as big as what they show
- [x] BAG: the equipped item's icon no longer covers its slot name
- [x] The yellow guide arrow stays clear of the mini-map and the action buttons, and hides while you talk
- [x] Job texts updated (the archer's SKILL is Multi Shot)
- [x] Action buttons in one thumb arc around ATTACK: DODGE, SKILL, POTION close in; TALK and RAIN on the outer ring (no more floating buttons); AUTO is now an ON/OFF toggle next to BUILD

## R4: Chapter 2, The Sylvan Seal ✅
- [x] **The Sylvan Wood**, a new forest area at the end of the south road (opens after Chapter 1): the elves' camp, the Blight Glen, the Moonwell, the Hollow, and the Heart Grove; thick trees you can brush past, a solid forest wall behind them
- [x] New people: **Vaelen**, the elf Warden (quests), and **Lyra** (shop: Elven Bow, Leafweave Mail, potions)
- [x] New monsters (stronger, for level 6+): Blight Slime, Thorn Spider, Blightfang (wolf), Rotwood Husk
- [x] Boss: **Vyrnax the Blighted**, the elves' old guardian dragon, in the Heart Grove (story bosses are no longer pushed back by every arrow, so they fight properly)
- [x] Five main quests: The Ones Who Remember, Blight in the Glen, The Hollow Ones, Heart of the Wood (reward: Sylvan Longbow), What the Elder Knew (ends with Martha's confession)
- [x] The guide arrow leads to other areas' doors when the goal is there
- [ ] Owner's art for an elf camp, forest ground and a treant/dragon boss would make it look less like Oakhaven

## Playtest 5: smaller, sharper HUD ✅
- [x] Sharp on phones: the game now draws at the screen's real pixels (up to 2x) instead of a low-resolution picture the phone blows up; text and art stay crisp
- [x] Compact HUD on phone screens: info panels 25% smaller, touch buttons 20% smaller (all still 45 px or more, easy to hit), smaller joystick

## R3: Tutorial ✅
- [x] On a new game, one short tip at a time at the bottom centre (TIP 1/6 ... 6/6): walk, talk to Martha, defeat a slime (AUTO), finish her quest, build a tower, survive the first night
- [x] Each tip finishes by doing it in the game (no extra buttons); the tower tip gives a little wood if you can't afford one yet
- [x] Hidden in menus, talks and build mode; ends with "Tutorial complete" and never shows again (older saves past day 1 skip it)

## R2: Balance pass ✅
Measured with a fast automated run (the archer on AUTO by the Core, 60 + 30 gold a day from the fields):
| Plan | Result before | Result after |
|---|---|---|
| Hero only | every night won, the Core never touched (towers pointless) | Core hurt from night 3, falls from night 7 |
| Towers + upgrades | every night won easily | nights 1-8 held, night 9 lost once then won on the retry, night 10 hard |
- [x] Bigger nights (3 + 3 per night raiders, more orcs and skeletons from night 7), stronger later (+15% per night from night 3), arriving in groups of three from different sides
- [x] When the Core falls, raiders take 15% (was 25%) and the same night comes again instead of a harder one, so a loss can be won back
- [x] No script errors during 50+ simulated nights

## R1: Archer kit ✅
- [x] SKILL with a bow is **Multi Shot**: three arrows, each locked on a different nearby monster
- [x] Level 3: **Piercing Arrows**, each arrow flies on to one more monster close by
- [x] Level 5: **Rain of Arrows** (RAIN button, R key): volleys fall on the nearest monster's spot and hit everything around it
- [x] Level 7: **Fire Arrows**, hits burn for three more ticks
- [x] New abilities are announced on level up

## Playtest 4 fixes (archer focus) ✅
- [x] One hero for now: New Game makes an Elf archer, you only pick the name
- [x] Readable text: the phone's own standard font, only 5 text sizes in the whole game, nothing overlapping (quest panel, mini-map, guide arrow, build bar, build shop checked at phone size); black-and-gold panels like the owner's UI kit
- [x] Trees, rocks and props only block their middle, so you can walk close past them; bushes can be walked through
- [x] More builders: Builder's Huts are cheaper (150 gold + 50 wood, then 500 gold, then 1200) and you can have up to 4
- [x] New towers: Mage Tower (frost bolts that slow) and Cannon Tower (blast that hits everything nearby)
- [x] Bosses are weaker (night 1 Alpha Wolf about 2x a wolf instead of 3x)
- [x] AUTO button (on by default): attacks the nearest monster in reach by itself
- [x] Arrows lock on: they fly to the monster even if you walk the other way

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
