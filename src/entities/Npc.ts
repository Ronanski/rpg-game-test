import Phaser from 'phaser';
import { Actor } from './Actor';
import { text, worldText } from '../ui/theme';
import type { NpcDef } from '../world/worldData';
import type { IsoMap } from '../iso/IsoMap';
import { frameCount, isNpcAnim } from '../assets/sprites';

const NAME_RANGE = 170; // villagers' names only show when you're close
const WANDER = 40; // px villagers stroll from their spot
const WALK_SPEED = 32;

/**
 * A townsperson. Key characters (with a role) stand at their post and show their name, role and a
 * marker (! quest, ? hand in, $ shop, ✦ teacher). Villagers stroll around their spot and show their
 * name only when you come close. Everyone breathes and glances around.
 */
export class Npc extends Actor {
  readonly label: Phaser.GameObjects.Text;
  private roleText: Phaser.GameObjects.Text | null = null;
  private marker: Phaser.GameObjects.Text;
  private home: { x: number; y: number };
  private target: { x: number; y: number } | null = null;
  private nextThink = 0;
  private walking = false;
  /** Set by the world: true while the hero is close (villagers stop to face them). */
  near = false;

  constructor(scene: Phaser.Scene, x: number, y: number, readonly def: NpcDef) {
    super(scene, x, y, def.texture);
    this.home = { x, y };
    const key = !!def.role;
    this.label = scene.add
      .text(x, 0, def.name, worldText('small', key ? '#ffd75e' : '#e8e0c8'))
      .setOrigin(0.5, 1)
      .setDepth(100000);
    if (def.role) {
      this.roleText = scene.add
        .text(x, 0, def.role, worldText('small', '#d9d2b8'))
        .setOrigin(0.5, 1)
        .setDepth(100000);
    }
    this.marker = scene.add
      .text(x, 0, '', text(20, '#ffd75e'))
      .setOrigin(0.5, 1)
      .setDepth(100001);
    scene.tweens.add({ targets: this.marker, scale: 1.15, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // Idle breathing.
    scene.tweens.add({ targets: this.sprite, scaleY: this.baseScale * 1.03, duration: 900 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.nextThink = scene.time.now + Math.random() * 3000;
    this.place();
  }

  /** '!' quest available, '?' ready to hand in, '' nothing; shops and teachers have fixed marks. */
  setMarker(m: string) {
    this.marker.setText(m).setColor(m === '?' ? '#9fe3ff' : '#ffd75e');
  }

  update(now: number, dtMs: number, map: IsoMap, heroDist: number) {
    // Names of villagers show only up close, so the plaza isn't a wall of text.
    if (!this.def.role) this.label.setVisible(heroDist < NAME_RANGE);
    if (now > this.nextThink) {
      this.nextThink = now + 2000 + Math.random() * 3500;
      if (this.def.role || this.near) {
        // Posts: glance left and right now and then.
        if (!this.near && Math.random() < 0.5) this.sprite.setFlipX(!this.sprite.flipX);
        this.target = null;
      } else {
        this.target = Math.random() < 0.6
          ? { x: this.home.x + Phaser.Math.Between(-WANDER, WANDER), y: this.home.y + Phaser.Math.Between(-WANDER / 2, WANDER / 2) }
          : null;
      }
    }
    this.walking = false;
    if (this.target && !this.near) {
      const dx = this.target.x - this.x, dy = this.target.y - this.y, d = Math.hypot(dx, dy);
      if (d < 3) this.target = null;
      else {
        const step = (WALK_SPEED * dtMs) / 1000;
        const nx = this.x + (dx / d) * step, ny = this.y + (dy / d) * step;
        if (map.walkable(nx, ny)) {
          this.x = nx;
          this.y = ny;
          this.walking = true;
          if (Math.abs(dx) > 1) this.sprite.setFlipX(dx < 0);
        } else this.target = null;
      }
    }
    const drawn = isNpcAnim(this.sprite.texture.key);
    if (this.walking) {
      this.bob += dtMs / 90;
      // Drawn townsfolk step through their 3 walk frames; others alternate two step poses.
      if (drawn) this.sprite.setFrame(1 + (Math.floor(this.bob / 1.6) % 3));
      else if (frameCount(this.sprite.texture.key) >= 3) this.sprite.setFrame([0, 1, 0, 2][Math.floor(this.bob / 2) % 4]);
    } else {
      this.bob = 0;
      // Drawn townsfolk gesture while you stand and talk with them.
      const f = drawn && this.near ? 4 : 0;
      if (Number(this.sprite.frame.name) !== f) this.sprite.setFrame(f);
    }
    this.place();
  }

  private place() {
    this.sync();
    const top = this.y - this.sprite.displayHeight - 2;
    this.label.setPosition(this.x, top - (this.roleText ? 11 : 0));
    this.roleText?.setPosition(this.x, top);
    this.marker.setPosition(this.x, this.label.y - 13);
  }

  destroy() {
    super.destroy();
    this.label.destroy();
    this.roleText?.destroy();
    this.marker.destroy();
  }

  face(x: number) {
    this.sprite.setFlipX(x < this.x);
  }
}
