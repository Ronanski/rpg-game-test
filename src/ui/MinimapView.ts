import Phaser from 'phaser';
import { state } from '../core/GameState';
import { toMap } from '../world/Minimap';
import { text, COLORS } from './theme';

/** What the world scene sends a few times a second (see WorldScene.emitMinimap). */
export interface MapData {
  key: string;
  h: number;
  area: string;
  px: number;
  py: number;
  fx: number;
  fy: number;
  marks: { x: number; y: number; kind: string; label?: string }[];
}

const R = 50; // radius of the map inside the ring (the ring art's opening at its 132 px size)
const ZOOM = 1.1; // mini-map pixels per map-picture pixel (higher = closer view)
const PIN_SIZE = 13;

const DOT: Record<string, string> = { monster: '#ff5a4a', boss: '#ff2a2a', npc: '#f4ead0', shop: '#ffd75e', ally: '#9fe3ff' };
const PIN: Record<string, string> = { quest: 'pin_quest', turnin: 'pin_turnin', goal: 'pin_star', door: 'pin_side', core: 'pin_location' };

function source(scene: Phaser.Scene, key: string) {
  return scene.textures.get(key).getSourceImage() as CanvasImageSource;
}

/** Draws the area picture, the markers and the hero onto a 2D canvas, centred on (cx, cy) map px. */
function paint(scene: Phaser.Scene, ctx: CanvasRenderingContext2D, d: MapData, size: number, zoom: number, cx: number, cy: number, pinSize: number) {
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-cx, -cy);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source(scene, d.key), 0, 0);
  ctx.restore();
  const at = (x: number, y: number) => {
    const m = toMap(x, y, d.h);
    return { x: size / 2 + (m.x - cx) * zoom, y: size / 2 + (m.y - cy) * zoom };
  };
  for (const mk of d.marks) {
    const p = at(mk.x, mk.y);
    const pin = PIN[mk.kind];
    if (pin) {
      const img = source(scene, pin) as HTMLImageElement;
      const h = pinSize, w = (img.width / img.height) * h;
      ctx.drawImage(img, p.x - w / 2, p.y - h, w, h);
    } else {
      ctx.fillStyle = DOT[mk.kind] ?? '#ffffff';
      ctx.strokeStyle = '#07080e';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, mk.kind === 'boss' ? 3.5 : 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  // The hero: an orange arrow pointing the way they face.
  const h = at(d.px, d.py);
  const a = Math.atan2(d.fy, d.fx);
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(a);
  ctx.fillStyle = '#ffae2a';
  ctx.strokeStyle = '#07080e';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-2, 0);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Round mini-map in the owner's compass ring; tap it for the big map. */
export class MinimapView {
  readonly root: Phaser.GameObjects.Container;
  private tex: Phaser.Textures.CanvasTexture;
  private last: MapData | null = null;

  constructor(private scene: Phaser.Scene, onOpen: () => void) {
    const key = 'minimap_live';
    if (scene.textures.exists(key)) scene.textures.remove(key);
    this.tex = scene.textures.createCanvas(key, R * 2, R * 2)!;
    const img = scene.add.image(0, 0, key);
    const ring = scene.add.image(0, 0, 'ui_minimap_ring');
    const hit = scene.add.circle(0, 0, R + 10, 0x000000, 0.001).setInteractive({ useHandCursor: true }).on('pointerdown', onOpen);
    this.root = scene.add.container(0, 0, [img, ring, hit]);
  }

  update(d: MapData) {
    this.last = d;
    const ctx = this.tex.getContext();
    ctx.clearRect(0, 0, R * 2, R * 2);
    ctx.save();
    ctx.beginPath();
    ctx.arc(R, R, R, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#0b0a12';
    ctx.fillRect(0, 0, R * 2, R * 2);
    const c = toMap(d.px, d.py, d.h);
    paint(this.scene, ctx, d, R * 2, ZOOM, c.x, c.y, PIN_SIZE);
    ctx.restore();
    this.tex.refresh();
  }

  get data() {
    return this.last;
  }
}

/** Full-screen map of the whole area, with place names. Tap anywhere to close. */
export class BigMap {
  private root: Phaser.GameObjects.Container;
  private tex: Phaser.Textures.CanvasTexture | null = null;
  isOpen = false;

  constructor(private scene: Phaser.Scene, private onClose: () => void) {
    this.root = scene.add.container(0, 0).setDepth(80).setVisible(false);
  }

  open(d: MapData) {
    this.isOpen = true;
    state.inMenu = true;
    const s = this.scene, { width, height } = s.scale;
    this.root.removeAll(true).setVisible(true);
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => (this.root.add(o), o);
    add(s.add.rectangle(0, 0, width, height, 0x07060c, 0.82).setOrigin(0).setInteractive().on('pointerdown', () => this.close()));
    const pic = s.textures.get(d.key).getSourceImage() as HTMLCanvasElement;
    const box = Math.min(width - 60, (height - 90) * (pic.width / pic.height));
    const zoom = box / pic.width;
    const tw = Math.round(pic.width * zoom), th = Math.round(pic.height * zoom);
    if (s.textures.exists('bigmap_live')) s.textures.remove('bigmap_live');
    this.tex = s.textures.createCanvas('bigmap_live', tw, th)!;
    const ctx = this.tex.getContext();
    // paint() works on a square centred on a point: paint the whole picture, then copy it in.
    ctx.clearRect(0, 0, tw, th);
    const square = document.createElement('canvas');
    square.width = square.height = Math.max(tw, th);
    paint(s, square.getContext('2d')!, d, square.width, zoom, pic.width / 2, pic.height / 2, 22);
    ctx.drawImage(square, (tw - square.width) / 2, (th - square.height) / 2);
    this.tex.refresh();
    const top = 64;
    add(s.add.image(width / 2, top, 'bigmap_live').setOrigin(0.5, 0));
    add(s.add.text(width / 2, 14, AREA_TITLES[d.area] ?? 'MAP', text(24, COLORS.gold)).setOrigin(0.5, 0));
    // Place names over the map.
    for (const mk of d.marks) {
      // Places only (doors, the Core, a boss); people already have pins and would crowd the village.
      if (!mk.label || !['door', 'core', 'boss'].includes(mk.kind)) continue;
      const m = toMap(mk.x, mk.y, d.h);
      add(s.add.text(width / 2 - tw / 2 + m.x * zoom, top + m.y * zoom - 26, mk.label, text(12)).setOrigin(0.5, 1));
    }
    add(s.add.text(width / 2, height - 12, 'Tap anywhere to close', text(12, COLORS.dim)).setOrigin(0.5, 1));
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    state.inMenu = false;
    this.root.removeAll(true).setVisible(false);
    this.onClose();
  }
}

const AREA_TITLES: Record<string, string> = { overworld: 'OAKHAVEN', cave: 'THE OLD CAVE', tavern: 'THE SLEEPING FOX', smithy: "GROM'S SMITHY" };
