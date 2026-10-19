# Aethelgard: Chronos of Fate

Isometric pixel-art action RPG with base building, tower defense, free job switching, and a dark mystery.
Runs on PC (web) and Android, with iOS planned.

- **Play on the web:** https://ronanski.github.io/rpg-game-test/
- **Android APK:** see [Releases](https://github.com/Ronanski/rpg-game-test/releases)
- **Architecture and database:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Art asset list:** [docs/ASSETS.md](docs/ASSETS.md)
- **Roadmap and checkpoints:** [ROADMAP.md](ROADMAP.md)
- **World, regions and characters:** [docs/WORLD.md](docs/WORLD.md)

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
- [x] NPC dialogue with quests (Martha, Grom the blacksmith, Serena, Hooded Stranger)
- [x] Real-time combat: slimes and wolves, EXP, level up, gold, loot, respawn
- [x] Starter hero selection: Kael (Human Warrior), Lyra (Elf Mage), Rook (Beastkin Rogue)
- [x] Health potions: POT button or Q key (+50 HP)
- [x] Touch controls (virtual stick, ATK, TALK, POT) and keyboard; landscape-only Android APK
- [ ] Base building mode (day) and wave defense (night)
- [ ] Job change menu and sub-classes, inventory and equipment UI
- [ ] Real pixel art and Tiled maps
