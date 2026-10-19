import Phaser from 'phaser';
import type { DialogueLine } from '../systems/dialogue/DialogueSystem';
import { panel, resizePanel, text, applyPortrait, COLORS } from './theme';

const H = 132;
const PORTRAIT = 104;

/** Bottom-of-screen dialogue panel with the speaker's portrait and a typewriter effect. Tap / Space / E to advance. */
export class DialogueBox {
  private frame: Phaser.GameObjects.NineSlice;
  private portraitFrame: Phaser.GameObjects.NineSlice;
  private portrait: Phaser.GameObjects.Image;
  private nameText: Phaser.GameObjects.Text;
  private bodyText: Phaser.GameObjects.Text;
  private hint: Phaser.GameObjects.Text;
  private zone: Phaser.GameObjects.Zone;
  private lines: DialogueLine[] = [];
  private index = 0;
  private typing?: Phaser.Time.TimerEvent;
  private onDone: () => void = () => {};

  constructor(private scene: Phaser.Scene) {
    this.frame = panel(scene, 0, 0, 400, H, true).setDepth(50);
    this.portraitFrame = panel(scene, 0, 0, PORTRAIT, PORTRAIT).setDepth(51);
    this.portrait = scene.add.image(0, 0, 'portrait_hero').setDepth(52);
    this.nameText = scene.add.text(0, 0, '', text(18, COLORS.gold)).setDepth(51);
    this.bodyText = scene.add.text(0, 0, '', { ...text(17), lineSpacing: 5 }).setDepth(51);
    this.hint = scene.add.text(0, 0, '▼', text(14, COLORS.dim)).setOrigin(1, 1).setDepth(51);
    scene.tweens.add({ targets: this.hint, alpha: 0.3, duration: 500, yoyo: true, repeat: -1 });
    this.zone = scene.add.zone(0, 0, 10, 10).setOrigin(0).setDepth(53).setInteractive();
    this.zone.on('pointerdown', () => this.advance());
    this.hide();
  }

  open(lines: DialogueLine[], onDone: () => void, portrait?: string) {
    this.lines = lines;
    this.index = 0;
    this.onDone = onDone;
    this.setPortrait(portrait);
    [this.frame, this.portraitFrame, this.portrait, this.nameText, this.bodyText, this.hint].forEach((o) => o.setVisible(true));
    this.portrait.setVisible(!!portrait);
    this.portraitFrame.setVisible(!!portrait);
    this.layout();
    this.zone.setVisible(true).setInteractive();
    this.show();
  }

  private setPortrait(key?: string) {
    if (key) this.portrait.setData('h', applyPortrait(this.portrait, key, PORTRAIT - 16));
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
    const w = Math.min(width - 24, 900), x = (width - w) / 2, y = height - H - 12;
    resizePanel(this.frame, w, H);
    this.frame.setPosition(x, y);
    const hasPortrait = this.portraitFrame.visible;
    this.portraitFrame.setPosition(x + 14, y + (H - PORTRAIT) / 2);
    const ph = (this.portrait.getData('h') as number) ?? 0;
    this.portrait.setPosition(x + 14 + PORTRAIT / 2, y + (H - PORTRAIT) / 2 + (PORTRAIT - ph) / 2);
    const tx = x + (hasPortrait ? PORTRAIT + 30 : 22);
    this.nameText.setPosition(tx, y + 14);
    this.bodyText.setPosition(tx, y + 42).setWordWrapWidth(x + w - tx - 20);
    this.hint.setPosition(x + w - 14, y + H - 10);
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
    [this.frame, this.portraitFrame, this.portrait, this.nameText, this.bodyText, this.hint].forEach((o) => o.setVisible(false));
    this.zone.setVisible(false).disableInteractive();
  }
}
