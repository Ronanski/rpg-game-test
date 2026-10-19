# Echoes of the Core

Isometric pixel-art action RPG with base building, tower defense, free job switching, and a dark mystery.
Web-first: developed and played in the browser (PC and phone). The Android APK will be built
once the game is feature-complete (the Capacitor project in `android/` is kept ready).

- **Play on the web:** https://ronanski.github.io/rpg-game-test/
- **Android APK (paused):** older test builds are on [Releases](https://github.com/Ronanski/rpg-game-test/releases)
- **Architecture and database:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Art pipeline:** [docs/ART_PIPELINE.md](docs/ART_PIPELINE.md)

## Dev

```bash
npm install
npm run dev        # http://localhost:5173
npm run build
```

Copy `.env.example` to `.env.local` and fill in your Supabase keys to save progress. Without them, the game runs in offline mode.

## Status (v0.1.0)

- [x] Supabase schema: players, heroes, jobs and sub-classes, town buildings, factions and diplomacy, quests, items and inventory. Includes RLS and server-side game functions (tested)
- [x] Free-roam isometric world: village, roads, river, forest
- [x] NPC dialogue with quests (Elder Maren, Toma the Smith, Hooded Stranger)
- [x] Real-time combat: slimes and wolves, EXP, level up, gold, loot, respawn
- [x] Touch controls (virtual stick, ATK, TALK) and keyboard; landscape-only Android APK
- [ ] Starter hero selection (race, faction, origin)
- [ ] Base building mode (day) and wave defense (night)
- [ ] Job change menu and sub-classes, inventory and equipment UI
- [~] Pixel art: procedural pipeline (`tools/art/`) for ground, river, bridge, trees, rocks, houses and characters. Not yet at reference quality (see docs/ART_PIPELINE.md)
