import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { StarterScene } from './scenes/StarterScene';
import { TitleScene } from './scenes/TitleScene';
import { WorldScene } from './scenes/WorldScene';
import { UIScene } from './ui/UIScene';
import { checkForUpdate } from './core/Updater';

// Load the fonts first so the first frame of text already uses them (Alegreya Sans for text,
// Cinzel for titles; both SIL OFL, files in public/fonts).
const fonts = [
  new FontFace('Alegreya Sans', `url(${import.meta.env.BASE_URL}fonts/AlegreyaSans-Bold.ttf)`, { weight: '700' }),
  new FontFace('Cinzel', `url(${import.meta.env.BASE_URL}fonts/Cinzel.ttf)`, { weight: '400 900' }),
];
Promise.all(fonts.map((f) => f.load().then((ff) => (document.fonts as unknown as Set<FontFace>).add(ff))))
  .catch((e) => console.warn('font failed to load', e))
  .finally(startGame);

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
