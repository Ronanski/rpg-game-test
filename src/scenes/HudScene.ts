import Phaser from 'phaser';
import { api } from '../lib/api';

const BUILDABLE = [
  { id: 'wooden_wall', label: 'Wall' },
  { id: 'arrow_tower', label: 'Tower' },
  { id: 'lumber_mill', label: 'Mill' },
  { id: 'spike_trap', label: 'Trap' },
];

/** Overlay UI: resources bar, build menu, toasts. Scales with the screen for phones. */
export class HudScene extends Phaser.Scene {
  private resText!: Phaser.GameObjects.Text;
  private buttons: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('Hud');
  }

  create() {
    const style = { fontFamily: 'monospace', fontSize: '16px', color: '#f4e9c8', backgroundColor: '#1c1830cc', padding: { x: 10, y: 6 } };
    this.resText = this.add.text(12, 12, '', style).setScrollFactor(0);

    BUILDABLE.forEach((b, i) => {
      const btn = this.add.text(0, 0, b.label, { ...style, fontSize: '18px' }).setInteractive({ useHandCursor: true });
      btn.on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation();
        this.registry.set('uiTapAt', this.time.now);
        const same = this.registry.get('selectedBuilding') === b.id;
        this.registry.set('selectedBuilding', same ? undefined : b.id);
        this.buttons.forEach((o, j) => o.setColor(!same && j === i ? '#ffd75e' : '#f4e9c8'));
      });
      this.buttons.push(btn);
    });
    this.layout();
    this.scale.on('resize', () => this.layout());

    this.game.events.on('refreshPlayer', () => void this.refresh());
    this.game.events.on('toast', (msg: string) => this.toast(msg));
    void this.refresh();
  }

  private layout() {
    const { width, height } = this.scale;
    let x = 12;
    for (const b of this.buttons) {
      b.setPosition(x, height - b.height - 12);
      x += b.width + 8;
    }
    if (x > width) this.buttons.forEach((b) => b.setScale(width / x));
  }

  private async refresh() {
    if (!this.registry.get('online')) {
      this.resText.setText('OFFLINE MODE (progress not saved)');
      return;
    }
    const p = await api.player();
    if (p) this.resText.setText(`Gold ${p.gold}   Wood ${p.wood}   Stone ${p.stone}   Mana ${p.mana}`);
  }

  private toast(msg: string) {
    const t = this.add
      .text(this.scale.width / 2, 60, msg, { fontFamily: 'monospace', fontSize: '16px', color: '#fff', backgroundColor: '#8a2b2bdd', padding: { x: 10, y: 6 } })
      .setOrigin(0.5, 0);
    this.tweens.add({ targets: t, alpha: 0, delay: 1800, duration: 400, onComplete: () => t.destroy() });
  }
}
