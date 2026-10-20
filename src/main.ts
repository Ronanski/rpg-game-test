import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { StarterScene } from './scenes/StarterScene';
import { TitleScene } from './scenes/TitleScene';
import { WorldScene } from './scenes/WorldScene';
import { UIScene } from './ui/UIScene';
import { checkForUpdate } from './core/Updater';
import { DPR, pixels } from './core/Screen';

// Text uses the device's own UI font (see ui/theme.ts), so there is nothing to load first.
startGame();

// Phone app: fetch the newest version in the background, at start and every time the game comes
// back to the screen (Android keeps apps alive in the background, so a "reopen" is often not a
// fresh start and would otherwise never look for updates).
checkForUpdate();
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && checkForUpdate());

function startGame() {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#0d0b14',
    pixelArt: true,
    // Drawn at the screen's real pixels and shown at the window's size (see core/Screen.ts).
    scale: { mode: Phaser.Scale.NONE, ...pixels(window.innerWidth, window.innerHeight), zoom: 1 / DPR },
    input: { activePointers: 3 },
    scene: [BootScene, TitleScene, StarterScene, WorldScene, UIScene],
  });
  const fit = () => {
    const { width, height } = pixels(window.innerWidth, window.innerHeight);
    if (width !== game.scale.width || height !== game.scale.height) game.scale.resize(width, height);
  };
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', () => setTimeout(fit, 200));
  // Dev server only: lets automated browser tests inspect and drive the game.
  if (import.meta.env.DEV) (window as unknown as { game: Phaser.Game }).game = game;
}
