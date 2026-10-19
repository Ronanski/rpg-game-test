import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { StarterScene } from './scenes/StarterScene';
import { TitleScene } from './scenes/TitleScene';
import { WorldScene } from './scenes/WorldScene';
import { UIScene } from './ui/UIScene';
import { checkForUpdate } from './core/Updater';

// Text uses the device's own UI font (see ui/theme.ts), so there is nothing to load first.
startGame();

// Phone app: fetch the newest version in the background.
checkForUpdate();

function startGame() {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#0d0b14',
    pixelArt: true,
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    input: { activePointers: 3 },
    scene: [BootScene, TitleScene, StarterScene, WorldScene, UIScene],
  });
  // Dev server only: lets automated browser tests inspect and drive the game.
  if (import.meta.env.DEV) (window as unknown as { game: Phaser.Game }).game = game;
}
