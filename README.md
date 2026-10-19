# Echoes of the Core

Isometric pixel-art action RPG with base building, tower defense, free job switching, and a dark mystery.
Runs on PC (web) and Android, with iOS planned.

- **Play on the web:** https://ronanski.github.io/rpg-game-test/
- **Android APK:** see [Releases](https://github.com/Ronanski/rpg-game-test/releases)
- **Architecture and database:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Dev

```bash
npm install
npm run dev        # http://localhost:5173
npm run build
```

Copy `.env.example` to `.env.local` and fill in your Supabase keys to save progress. Without them, the game runs in offline mode.

## Status (v0.0.1, foundation)

- [x] Supabase schema, RLS, and server-side game functions (tested)
- [x] Isometric town grid: pan, pinch-zoom, tap to build
- [x] GitHub Pages and APK release pipelines
- [ ] Real pixel art and Tiled maps
- [ ] Starter hero selection, field exploration and combat
- [ ] Wave defense mode
- [ ] Job and quest UI
