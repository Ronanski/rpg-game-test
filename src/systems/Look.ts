import Phaser from 'phaser';

/**
 * "HD-2D" finish for the world camera (the owner's reference: a sunny pixel-art village seen like a
 * miniature): a light warm grade, a soft tilt-shift blur at the top and bottom of the screen, and a
 * faint vignette. Screen-space filters, so the art itself doesn't change.
 * By default only the grade is on: the tilt-shift blur cut the frame rate about 5x in testing, too
 * slow for phones. `?look=full` adds it (for screenshots and fast PCs); `?look=off` turns all off.
 */
export function applyLook(cam: Phaser.Cameras.Scene2D.Camera) {
  const mode = new URLSearchParams(location.search).get('look');
  if (mode === 'off') return;
  const f = cam.filters.external;
  // Sunny grade: a touch more color and warmth, nothing heavy.
  const grade = f.addColorMatrix().colorMatrix;
  grade.saturate(0.08);
  grade.multiply([
    1.03, 0, 0, 0, 0.01,
    0, 1.01, 0, 0, 0.005,
    0, 0, 0.97, 0, 0,
    0, 0, 0, 1, 0,
  ], true);
  if (mode !== 'full') return;
  // Miniature look: only the far top and bottom edges go soft.
  f.addTiltShift(0.5, 0.6, 0.1, 1, 1, 0.3);
  f.addVignette(0.5, 0.5, 0.9, 0.18, 0x2a1a0a);
}
