import Phaser from 'phaser';

/**
 * Sharp graphics on phones: the game draws at the screen's real pixel count (up to 2x, more costs
 * battery for little gain), not at the browser's "CSS" size that the phone then blows up.
 * Scenes keep working in CSS-size units: their camera is zoomed by DPR (see fitCamera), and
 * view() gives the screen size in those units.
 */
export const DPR = Math.min(2, Math.max(1, Math.round((window.devicePixelRatio || 1) * 4) / 4));

/** Screen size in layout units (what `scene.scale` gave before the sharp-graphics change). */
export function view(scene: Phaser.Scene) {
  return { width: scene.scale.width / DPR, height: scene.scale.height / DPR };
}

/** For menu and HUD scenes: layout units map to screen pixels from the top-left corner. */
export function fitCamera(scene: Phaser.Scene) {
  scene.cameras.main.setOrigin(0, 0).setZoom(DPR);
}

/** Canvas size in real pixels for a window size. */
export const pixels = (w: number, h: number) => ({ width: Math.round(w * DPR), height: Math.round(h * DPR) });

/**
 * Room to leave for a phone's notch, camera hole or rounded corners (CSS env(safe-area-inset-*);
 * the page uses viewport-fit=cover). All zero on screens without them.
 */
export function safeArea() {
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;' +
    'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const px = (v: string) => parseFloat(v) || 0;
  const r = { l: px(cs.paddingLeft), r: px(cs.paddingRight), t: px(cs.paddingTop), b: px(cs.paddingBottom) };
  probe.remove();
  return r;
}
