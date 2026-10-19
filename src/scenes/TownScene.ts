import Phaser from 'phaser';
import { gridToScreen, screenToGrid, isoDepth, TILE_H } from '../lib/iso';
import { api, type TownBuilding } from '../lib/api';

const GRID = 16;

/** The player's town: isometric grid, pan/zoom camera, tap to place buildings. */
export class TownScene extends Phaser.Scene {
  private cursor!: Phaser.GameObjects.Image;
  private occupied = new Set<string>();
  private dragStart: { x: number; y: number; scrollX: number; scrollY: number } | null = null;
  private moved = false;

  constructor() {
    super('Town');
  }

  async create() {
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const p = gridToScreen(x, y);
        this.add.image(p.x, p.y, 'tile_grass').setOrigin(0.5, 0).setDepth(-1);
      }
    }
    this.cursor = this.add.image(0, 0, 'tile_grass').setOrigin(0.5, 0).setTint(0xffff66).setAlpha(0.6).setDepth(-0.5);

    const center = gridToScreen(GRID / 2, GRID / 2);
    this.cameras.main.centerOn(center.x, center.y);
    this.setupCameraControls();

    if (this.registry.get('online')) {
      try {
        await api.finishTimers();
        (await api.buildings()).forEach((b) => this.drawBuilding(b));
      } catch (e) {
        this.events.emit('toast', String(e));
      }
    }
  }

  private drawBuilding(b: Pick<TownBuilding, 'building_type_id' | 'grid_x' | 'grid_y'>) {
    const p = gridToScreen(b.grid_x, b.grid_y);
    this.add
      .image(p.x, p.y + TILE_H, `b_${b.building_type_id}`)
      .setOrigin(0.5, 1)
      .setDepth(isoDepth(b.grid_x, b.grid_y));
    this.occupied.add(`${b.grid_x},${b.grid_y}`);
  }

  private async placeAt(gx: number, gy: number) {
    const type = this.registry.get('selectedBuilding') as string | undefined;
    if (!type || gx < 0 || gy < 0 || gx >= GRID || gy >= GRID) return;
    if (this.occupied.has(`${gx},${gy}`)) return;

    if (this.registry.get('online')) {
      try {
        await api.placeBuilding(type, gx, gy);
        this.game.events.emit('refreshPlayer');
      } catch (e) {
        this.game.events.emit('toast', (e as Error).message);
        return;
      }
    }
    this.drawBuilding({ building_type_id: type, grid_x: gx, grid_y: gy });
  }

  private setupCameraControls() {
    const cam = this.cameras.main;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragStart = { x: p.x, y: p.y, scrollX: cam.scrollX, scrollY: cam.scrollY };
      this.moved = false;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const world = cam.getWorldPoint(p.x, p.y);
      const g = screenToGrid(world.x, world.y - TILE_H / 2);
      const s = gridToScreen(g.x, g.y);
      this.cursor.setPosition(s.x, s.y);

      // Two-finger pinch zoom (mobile).
      const p1 = this.input.pointer1, p2 = this.input.pointer2;
      if (p1.isDown && p2.isDown) {
        const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        const prev = Phaser.Math.Distance.Between(p1.prevPosition.x, p1.prevPosition.y, p2.prevPosition.x, p2.prevPosition.y);
        cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dist / prev || 1), 0.5, 3));
        this.moved = true;
        return;
      }
      if (this.dragStart && p.isDown) {
        const dx = p.x - this.dragStart.x, dy = p.y - this.dragStart.y;
        if (Math.abs(dx) + Math.abs(dy) > 8) this.moved = true;
        cam.scrollX = this.dragStart.scrollX - dx / cam.zoom;
        cam.scrollY = this.dragStart.scrollY - dy / cam.zoom;
      }
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      // Ignore taps that landed on a HUD button.
      const uiTap = (this.registry.get('uiTapAt') as number | undefined) ?? -Infinity;
      if (!this.moved && this.time.now - uiTap > 300) {
        const world = cam.getWorldPoint(p.x, p.y);
        const g = screenToGrid(world.x, world.y - TILE_H / 2);
        void this.placeAt(g.x, g.y);
      }
      this.dragStart = null;
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), 0.5, 3));
    });
  }
}
