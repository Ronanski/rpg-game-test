import Phaser from 'phaser';
import { state } from '../core/GameState';
import { JOBS } from '../systems/combat/ClassSystem';
import { JOB_LIST, changeJob, isUnlocked, progressOf } from '../systems/combat/JobSystem';
import { panel, text, touchable, COLORS } from './theme';
import { safeArea, view } from '../core/Screen';

/** Full-screen JOBS menu: every job with its skill, how to earn it, and a CHANGE button once earned. */
export class JobMenu {
  private root: Phaser.GameObjects.Container;
  private shade: Phaser.GameObjects.Rectangle;

  constructor(private scene: Phaser.Scene, private onClose: () => void) {
    this.shade = scene.add.rectangle(0, 0, 10, 10, 0x07080e, 0.7).setOrigin(0).setDepth(70).setInteractive();
    this.root = scene.add.container().setDepth(71);
    this.close(false);
  }

  get isOpen() {
    return this.root.visible;
  }

  open() {
    state.inMenu = true;
    this.shade.setVisible(true);
    this.root.setVisible(true);
    this.draw();
  }

  close(notify = true) {
    state.inMenu = false;
    this.shade.setVisible(false);
    this.root.setVisible(false).removeAll(true);
    if (notify) this.onClose();
  }

  /** Redraws (after a job change or a resize). */
  draw() {
    if (!this.isOpen) return;
    const s = this.scene, { width, height } = view(s);
    this.shade.setSize(width, height);
    this.root.removeAll(true);
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => (this.root.add(o), o);
    const compact = height < 450;
    const rowH = compact ? 50 : 62;
    // Centred inside the notch-safe area, like the other menus.
    const sa = safeArea(), aw = width - sa.l - sa.r, ah = height - sa.t - sa.b;
    const w = Math.min(640, aw - 24), h = Math.min(ah - 16, 70 + rowH * JOB_LIST.length);
    const x = sa.l + (aw - w) / 2, y = sa.t + (ah - h) / 2;
    add(panel(s, x, y, w, h, true));
    add(s.add.text(x + 20, y + 14, 'JOBS', text(20, COLORS.gold)));
    add(s.add.text(x + 90, y + 18, 'Earn jobs by how you play. Change anytime.', text(12, COLORS.dim)));
    const closeBtn = add(s.add.text(x + w - 18, y + 12, '✕', text(22)).setOrigin(1, 0));
    touchable(closeBtn).on('pointerdown', () => this.close());

    const current = state.player!.jobId;
    JOB_LIST.forEach((j, i) => {
      const ry = y + 50 + i * rowH;
      const open = isUnlocked(j.id), isCurrent = current === j.id;
      add(s.add.rectangle(x + 14, ry, w - 28, rowH - 6, isCurrent ? 0x2a3150 : 0x141a2c, 0.9).setOrigin(0));
      add(s.add.text(x + 26, ry + 6, JOBS[j.id].name, text(compact ? 15 : 17, isCurrent ? COLORS.gold : open ? COLORS.text : COLORS.dim)));
      const detail = open ? j.skill : `🔒 ${j.how}${j.counter ? `  (${progressOf(j)}/${j.goal})` : ''}`;
      add(s.add.text(x + 26, ry + (compact ? 25 : 30), detail, { ...text(compact ? 11 : 12, open ? '#8fd18a' : COLORS.dim), wordWrap: { width: w - 190 } }));
      const bx = x + w - 120;
      if (isCurrent) add(s.add.text(bx + 48, ry + rowH / 2 - 3, 'CURRENT', text(13, COLORS.gold)).setOrigin(0.5));
      else if (open) {
        const b = add(panel(s, bx, ry + (rowH - 6) / 2 - 16, 96, 32));
        add(s.add.text(bx + 48, ry + (rowH - 6) / 2, 'CHANGE', text(13)).setOrigin(0.5));
        b.setInteractive({ useHandCursor: true }).on('pointerdown', () => (changeJob(j.id), this.draw()));
      }
    });
  }
}
