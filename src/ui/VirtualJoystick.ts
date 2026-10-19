import Phaser from 'phaser';
import { view } from '../core/Screen';

/**
 * Floating virtual stick for the left half of the screen. Touch anywhere on the left
 * side to place it; drag to move. Writes a normalized vector to `value`.
 */
export class VirtualJoystick {
  readonly value = new Phaser.Math.Vector2();
  private base: Phaser.GameObjects.Arc;
  private knob: Phaser.GameObjects.Arc;
  private pointerId: number | null = null;
  private origin = new Phaser.Math.Vector2();
  private enabled = true;
  private readonly radius = 48;

  constructor(private scene: Phaser.Scene) {
    this.base = scene.add.circle(0, 0, this.radius, 0xffffff, 0.12).setStrokeStyle(3, 0xffffff, 0.35).setDepth(10);
    this.knob = scene.add.circle(0, 0, 22, 0xffffff, 0.35).setDepth(11);
    this.resetPosition();

    scene.input.on('pointerdown', (p: Phaser.Input.Pointer, over: unknown[]) => {
      if (!this.enabled || this.pointerId !== null || over.length > 0) return;
      // worldX / worldY: the touch in layout units (the HUD camera is zoomed, see core/Screen.ts).
      if (p.worldX > view(scene).width * 0.45) return;
      this.pointerId = p.id;
      this.origin.set(p.worldX, p.worldY);
      this.base.setPosition(p.worldX, p.worldY).setAlpha(1);
      this.knob.setPosition(p.worldX, p.worldY).setAlpha(1);
    });
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.id !== this.pointerId) return;
      const d = new Phaser.Math.Vector2(p.worldX - this.origin.x, p.worldY - this.origin.y);
      if (d.length() > this.radius) d.setLength(this.radius);
      this.knob.setPosition(this.origin.x + d.x, this.origin.y + d.y);
      this.value.set(d.x / this.radius, d.y / this.radius);
    });
    const release = (p: Phaser.Input.Pointer) => {
      if (p.id !== this.pointerId) return;
      this.pointerId = null;
      this.value.set(0, 0);
      this.resetPosition();
    };
    scene.input.on('pointerup', release);
    scene.input.on('pointerupoutside', release);
  }

  resetPosition() {
    const x = 96, y = view(this.scene).height - 96;
    this.origin.set(x, y);
    this.base.setPosition(x, y).setAlpha(0.6);
    this.knob.setPosition(x, y).setAlpha(0.6);
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    this.base.setVisible(on);
    this.knob.setVisible(on);
    if (!on) {
      this.pointerId = null;
      this.value.set(0, 0);
    }
  }
}
