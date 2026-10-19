import Phaser from 'phaser';
import type { DialogueLine } from '../systems/dialogue/DialogueSystem';
import { panel, resizePanel, text, COLORS } from './theme';

const MAX_W = 380;
const PAD = 16;
const TAIL = 12;
const FILL = 0x1a2034;
const RIM = 0x8790b4;

/** Where the speaker's head is on screen, so the bubble can point at it (null = off screen). */
export type Anchor = () => { x: number; y: number } | null;

/**
 * Speech bubble over the speaker's head (Octopath-style): name plate, typewriter text, and a tail
 * pointing at whoever is talking. Without an anchor it sits at the bottom of the screen.
 * Tap / Space / E to advance.
 */
export class DialogueBox {
  private frame: Phaser.GameObjects.NineSlice;
  private tail: Phaser.GameObjects.Graphics;
  private plate: Phaser.GameObjects.NineSlice;
  private nameText: Phaser.GameObjects.Text;
  private bodyText: Phaser.GameObjects.Text;
  private hint: Phaser.GameObjects.Text;
  private zone: Phaser.GameObjects.Zone;
  private lines: DialogueLine[] = [];
  private index = 0;
  private typing?: Phaser.Time.TimerEvent;
  private onDone: () => void = () => {};
  private anchor: Anchor | null = null;
  private boxW = MAX_W;
  private boxH = 80;

  constructor(private scene: Phaser.Scene) {
    this.frame = panel(scene, 0, 0, MAX_W, 80).setDepth(50);
    this.tail = scene.add.graphics().setDepth(50);
    this.plate = panel(scene, 0, 0, 120, 28, true).setDepth(51);
    this.nameText = scene.add.text(0, 0, '', text(15, COLORS.gold)).setOrigin(0, 0.5).setDepth(52);
    this.bodyText = scene.add.text(0, 0, '', { ...text(16), lineSpacing: 4 }).setDepth(51);
    this.hint = scene.add.text(0, 0, '▼', text(13, COLORS.dim)).setOrigin(1, 1).setDepth(51);
    scene.tweens.add({ targets: this.hint, alpha: 0.3, duration: 500, yoyo: true, repeat: -1 });
    this.zone = scene.add.zone(0, 0, 10, 10).setOrigin(0).setDepth(53).setInteractive();
    this.zone.on('pointerdown', () => this.advance());
    this.hide();
  }

  open(lines: DialogueLine[], onDone: () => void, anchor?: Anchor) {
    this.lines = lines;
    this.index = 0;
    this.onDone = onDone;
    this.anchor = anchor ?? null;
    [this.frame, this.tail, this.plate, this.nameText, this.bodyText, this.hint].forEach((o) => o.setVisible(true));
    this.zone.setVisible(true).setInteractive();
    this.show();
  }

  get isOpen() {
    return this.zone.visible;
  }

  advance() {
    if (!this.isOpen) return;
    const full = this.lines[this.index].text;
    if (this.typing && this.bodyText.text.length < full.length) {
      this.typing.remove();
      this.bodyText.setText(full);
      return;
    }
    this.index++;
    if (this.index >= this.lines.length) {
      this.hide();
      this.onDone();
      return;
    }
    this.show();
  }

  /** Re-places the bubble; called every frame so it follows the speaker as the camera moves. */
  layout() {
    if (!this.isOpen) return;
    const { width, height } = this.scene.scale;
    const w = this.boxW, h = this.boxH;
    const a = this.anchor?.() ?? null;
    let x: number, y: number;
    let tailDown = true;
    if (a) {
      x = Phaser.Math.Clamp(a.x - w / 2, 12, width - w - 12);
      y = a.y - TAIL - h;
      // No room above the head: put the bubble under it instead.
      if (y < 40) {
        y = a.y + 70 + TAIL;
        tailDown = false;
      }
      y = Phaser.Math.Clamp(y, 40, height - h - 12);
    } else {
      x = (width - w) / 2;
      y = height - h - 16;
    }
    this.frame.setPosition(x, y);
    resizePanel(this.frame, w, h);

    // Tail: a small triangle from the bubble edge toward the speaker.
    const g = this.tail.clear();
    if (a) {
      const tx = Phaser.Math.Clamp(a.x, x + 20, x + w - 20);
      const baseY = tailDown ? y + h - 4 : y + 4;
      const tipY = tailDown ? baseY + TAIL + 2 : baseY - TAIL - 2;
      g.fillStyle(FILL).fillTriangle(tx - 9, baseY, tx + 9, baseY, tx, tipY);
      g.lineStyle(2, RIM).lineBetween(tx - 9, baseY + (tailDown ? 2 : -2), tx, tipY).lineBetween(tx + 9, baseY + (tailDown ? 2 : -2), tx, tipY);
    }

    // Name plate sits on the top-left corner of the bubble.
    const pw = Math.max(80, this.nameText.width + 24);
    resizePanel(this.plate, pw, 28);
    this.plate.setPosition(x + 10, y - 16);
    this.nameText.setPosition(x + 22, y - 2);
    this.bodyText.setPosition(x + PAD, y + PAD + 6);
    this.hint.setPosition(x + w - 10, y + h - 6);
    this.zone.setPosition(0, 0).setSize(width, height);
  }

  private show() {
    const line = this.lines[this.index];
    const { width } = this.scene.scale;
    this.nameText.setText(line.speaker);
    // Size the bubble to the whole line first, so it doesn't grow while typing.
    this.boxW = Math.min(MAX_W, width - 24);
    this.bodyText.setWordWrapWidth(this.boxW - PAD * 2).setText(line.text);
    this.boxW = Math.min(this.boxW, Math.max(200, this.bodyText.width + PAD * 2 + 10));
    this.bodyText.setWordWrapWidth(this.boxW - PAD * 2);
    this.boxH = this.bodyText.height + PAD * 2 + 10;
    this.bodyText.setText('');
    this.layout();
    this.typing?.remove();
    let i = 0;
    this.typing = this.scene.time.addEvent({
      delay: 18,
      repeat: line.text.length - 1,
      callback: () => this.bodyText.setText(line.text.slice(0, ++i)),
    });
  }

  private hide() {
    this.typing?.remove();
    [this.frame, this.tail, this.plate, this.nameText, this.bodyText, this.hint].forEach((o) => o.setVisible(false));
    this.zone.setVisible(false).disableInteractive();
  }
}
