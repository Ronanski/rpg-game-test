import Phaser from 'phaser';
import type { DialogueLine } from '../systems/dialogue/DialogueSystem';

/** Bottom-of-screen dialogue panel with a typewriter effect. Tap / Space / E to advance. */
export class DialogueBox {
  private panel: Phaser.GameObjects.Graphics;
  private nameText: Phaser.GameObjects.Text;
  private bodyText: Phaser.GameObjects.Text;
  private hint: Phaser.GameObjects.Text;
  private zone: Phaser.GameObjects.Zone;
  private lines: DialogueLine[] = [];
  private index = 0;
  private typing?: Phaser.Time.TimerEvent;
  private onDone: () => void = () => {};

  constructor(private scene: Phaser.Scene) {
    this.panel = scene.add.graphics().setDepth(50);
    const font = { fontFamily: 'monospace', color: '#f4e9c8' };
    this.nameText = scene.add.text(0, 0, '', { ...font, fontSize: '16px', fontStyle: 'bold', color: '#ffd75e' }).setDepth(51);
    this.bodyText = scene.add.text(0, 0, '', { ...font, fontSize: '17px', lineSpacing: 4 }).setDepth(51);
    this.hint = scene.add.text(0, 0, '▼ tap', { ...font, fontSize: '12px', color: '#c9bfa0' }).setOrigin(1, 1).setDepth(51);
    this.zone = scene.add.zone(0, 0, 10, 10).setOrigin(0).setDepth(52).setInteractive();
    this.zone.on('pointerdown', () => this.advance());
    this.hide();
  }

  open(lines: DialogueLine[], onDone: () => void) {
    this.lines = lines;
    this.index = 0;
    this.onDone = onDone;
    this.layout();
    [this.panel, this.nameText, this.bodyText, this.hint].forEach((o) => o.setVisible(true));
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

  layout() {
    const { width, height } = this.scene.scale;
    const w = Math.min(width - 40, 900), h = 130, x = (width - w) / 2, y = height - h - 16;
    this.panel.clear().fillStyle(0x15122a, 0.94).fillRoundedRect(x, y, w, h, 10).lineStyle(3, 0xc9a14a).strokeRoundedRect(x, y, w, h, 10);
    this.nameText.setPosition(x + 18, y + 12);
    this.bodyText.setPosition(x + 18, y + 40).setWordWrapWidth(w - 36);
    this.hint.setPosition(x + w - 12, y + h - 8);
    this.zone.setPosition(0, 0).setSize(width, height);
  }

  private show() {
    const line = this.lines[this.index];
    this.nameText.setText(line.speaker);
    this.bodyText.setText('');
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
    [this.panel, this.nameText, this.bodyText, this.hint].forEach((o) => o.setVisible(false));
    this.zone.setVisible(false).disableInteractive();
  }
}
