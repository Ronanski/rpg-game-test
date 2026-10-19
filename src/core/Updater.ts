import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

declare const __BUILD_ID__: string;

/** Where the newest web build lives (GitHub Pages publishes version.json and bundle.zip next to the game). */
const SITE = 'https://ronanski.github.io/rpg-game-test/';

export const BUILD_ID = __BUILD_ID__;

/** Set when a newer version has been downloaded; applying it restarts the game. */
export let readyUpdate: { id: string } | null = null;
const listeners: (() => void)[] = [];
export function onUpdateReady(fn: () => void) {
  listeners.push(fn);
  if (readyUpdate) fn();
}

/**
 * Phone app only: tell the updater this version started fine, then look for a newer one online.
 * If there is one, download it in the background. It is used on the next launch, or right away
 * when the player taps "restart to update". No internet: nothing happens, the game plays as is.
 */
export async function checkForUpdate() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await CapacitorUpdater.notifyAppReady();
    const res = await fetch(`${SITE}version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const { version } = (await res.json()) as { version: string };
    if (!version || version === BUILD_ID) return;
    const bundle = await CapacitorUpdater.download({ url: `${SITE}bundle.zip?v=${version}`, version });
    await CapacitorUpdater.next({ id: bundle.id });
    readyUpdate = { id: bundle.id };
    listeners.forEach((fn) => fn());
  } catch (e) {
    console.warn('Update check failed', e);
  }
}

export async function applyUpdate() {
  if (readyUpdate) await CapacitorUpdater.set({ id: readyUpdate.id });
}
