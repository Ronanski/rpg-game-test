import Phaser from 'phaser';

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
  private readonly radius = 56;

  constructor(private scene: Phaser.Scene) {
    this.base = scene.add.circle(0, 0, this.radius, 0xffffff, 0.12).setStrokeStyle(3, 0xffffff, 0.35).setDepth(10);
    this.knob = scene.add.circle(0, 0, 26, 0xffffff, 0.35).setDepth(11);
    this.resetPosition();

    scene.input.on('pointerdown', (p: Phaser.Input.Pointer, over: unknown[]) => {
      if (!this.enabled || this.pointerId !== null || over.length > 0) return;
      if (p.x > scene.scale.width * 0.45) return;
      this.pointerId = p.id;
      this.origin.set(p.x, p.y);
      this.base.setPosition(p.x, p.y).setAlpha(1);
      this.knob.setPosition(p.x, p.y).setAlpha(1);
    });
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.id !== this.pointerId) return;
      const d = new Phaser.Math.Vector2(p.x - this.origin.x, p.y - this.origin.y);
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
    const x = 110, y = this.scene.scale.height - 110;
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
