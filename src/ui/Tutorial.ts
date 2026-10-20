import Phaser from 'phaser';
import { state } from '../core/GameState';
import { bus } from '../core/EventBus';
import { give } from '../systems/town/Economy';
import type { QuestTracker } from '../systems/quest/QuestTracker';
import { panel, resizePanel, text, COLORS } from './theme';

/** First-play guide: one short tip at a time, each done by actually doing it. */
const STEPS = [
  { tip: 'Move: drag on the left side of the screen (or WASD).' },
  { tip: 'Talk to Martha: follow the yellow arrow and tap her.' },
  { tip: 'Defeat a slime: AUTO shoots by itself, or press ATTACK.' },
  { tip: 'Defeat 5 slimes, then go back to Martha for your reward.' },
  { tip: 'Build a tower: tap BUILD, then SHOP, then an Arrow Tower.' },
  { tip: 'At night monsters attack the Core. Stay near it, or press START NIGHT when ready.' },
];

const TOWERS = ['arrow_tower', 'mage_tower', 'cannon_tower', 'wooden_wall', 'spike_trap'];

export class Tutorial {
  private root: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.NineSlice;
  private label: Phaser.GameObjects.Text;
  private step = -1;
  private start: { x: number; y: number } | null = null;

  constructor(scene: Phaser.Scene, private quests: QuestTracker) {
    this.bg = panel(scene, 0, 0, 200, 40, true);
    this.label = scene.add.text(0, 0, '', { ...text(14), wordWrap: { width: 290 } });
    this.root = scene.add.container(0, 0, [this.bg, this.label]).setDepth(30).setVisible(false);
    const onMap = (d: { px: number; py: number }) => {
      this.start ??= { x: d.px, y: d.py };
      if (!state.storyFlags.has('tut_moved') && Math.hypot(d.px - this.start.x, d.py - this.start.y) > 80) state.storyFlags.add('tut_moved');
    };
    bus.on('minimap', onMap);
    scene.events.once('shutdown', () => bus.off('minimap', onMap));
  }

  /** Which step is next (all done: -1). Worked out from the game itself, so saves need no extra data. */
  private current(): number {
    if (state.storyFlags.has('tutorial_done')) return -1;
    const q = this.quests.statusOf('main_01_slimes');
    const kills = q === 'active' ? this.quests.progress('main_01_slimes') : q === 'completed' ? 5 : 0;
    const done = [
      state.storyFlags.has('tut_moved'),
      q !== 'available',
      kills >= 1,
      q === 'completed',
      state.town.buildings.some((b) => TOWERS.includes(b.type)),
      state.cycle.day >= 2,
    ];
    return done.indexOf(false);
  }

  /** Shown with its bottom centre at (cx, bottom), at most `maxW` screen px wide. */
  update(cx: number, bottom: number, k: number, maxW = 330) {
    const i = this.current();
    if (i !== this.step) {
      if (this.step >= 0 && i === -1 && !state.storyFlags.has('tutorial_done')) {
        state.storyFlags.add('tutorial_done');
        bus.emit('toast', 'Tutorial complete. Good luck, archer!');
      }
      this.step = i;
      // The tower step: make sure a first Arrow Tower is affordable.
      if (i === 4 && !state.storyFlags.has('tut_wood') && state.town.wood < 40) {
        state.storyFlags.add('tut_wood');
        give('wood', 40 - state.town.wood, false);
        bus.emit('toast', 'Martha sends you some wood for your first tower.');
      }
    }
    if (i < 0) {
      state.storyFlags.add('tutorial_done');
      this.root.setVisible(false);
      return;
    }
    const show = !state.inMenu && !state.inDialogue && !state.buildMode;
    const inner = Math.max(160, Math.min(300, maxW / k - 24));
    this.label.setWordWrapWidth(inner).setText(`TIP ${i + 1}/${STEPS.length}  ${STEPS[i].tip}`).setColor(COLORS.text);
    const w = Math.min(inner, this.label.width) + 24, h = this.label.height + 14;
    resizePanel(this.bg, w, h);
    this.bg.setPosition(-w / 2, -h);
    this.label.setPosition(-w / 2 + 12, -h + 7);
    // Bottom centre, between the joystick and the action buttons (toasts use the top centre).
    this.root.setVisible(show).setScale(k).setPosition(cx, bottom);
  }
}
