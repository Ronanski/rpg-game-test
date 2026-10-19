import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { StarterScene } from './scenes/StarterScene';
import { WorldScene } from './scenes/WorldScene';
import { UIScene } from './ui/UIScene';

// Load the pixel font first so the first frame of text already uses it.
const font = new FontFace('Pixelify Sans', `url(${import.meta.env.BASE_URL}fonts/PixelifySans-Medium.ttf)`);
font
  .load()
  .then((f) => (document.fonts as unknown as Set<FontFace>).add(f))
  .catch((e) => console.warn('font failed to load', e))
  .finally(startGame);

function startGame() {
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#0d0b14',
    pixelArt: true,
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    input: { activePointers: 3 },
    scene: [BootScene, StarterScene, WorldScene, UIScene],
  });
}
