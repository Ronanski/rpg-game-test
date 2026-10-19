import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

declare const __BUILD_ID__: string;

/** Where the newest web build lives (GitHub Pages publishes version.json and bundle.zip next to the game). */
const SITE = 'https://ronanski.github.io/rpg-game-test/';

export const BUILD_ID = __BUILD_ID__;

/** Set when a newer version has been downloaded; applying it restarts the game. */
export let readyUpdate: { id: string } | null = null;
/** What the updater is doing, shown on the title screen (empty in the browser). */
export let updateStatus = '';
let busy = false;

const listeners: (() => void)[] = [];
/** Called whenever the update status changes (and right away). */
export function onUpdateReady(fn: () => void): () => void {
  listeners.push(fn);
  fn();
  return () => listeners.splice(listeners.indexOf(fn), 1);
}

function status(s: string) {
  updateStatus = s;
  listeners.forEach((fn) => fn());
}

/**
 * Phone app only: tell the updater this version started fine, then look for a newer one online.
 * - Already downloaded earlier (but not switched to yet): switch to it now (the game restarts).
 * - Newer one online: download it; it is used when the app is next opened, or right away when
 *   the player taps UPDATE READY.
 * - No internet: the game plays as is.
 * Every step is shown on the title screen, so a failure can be seen and reported.
 */
export async function checkForUpdate() {
  if (!Capacitor.isNativePlatform() || busy) return;
  busy = true;
  try {
    status('Checking for updates…');
    await CapacitorUpdater.notifyAppReady();
    let version = '';
    try {
      const res = await fetch(`${SITE}version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`server said ${res.status}`);
      version = ((await res.json()) as { version: string }).version;
    } catch (e) {
      return status(`Could not check for updates (${errText(e)}). Playing this version.`);
    }
    if (!version || version === BUILD_ID) return status('Game is up to date.');
    // Downloaded before but never switched to: use it now.
    const { bundles } = await CapacitorUpdater.list();
    const have = bundles.find((b) => b.version === version && b.status === 'success');
    if (have) {
      status('Installing update…');
      await CapacitorUpdater.set({ id: have.id });
      return;
    }
    status('Downloading update…');
    const bundle = await CapacitorUpdater.download({ url: `${SITE}bundle.zip?v=${version}`, version });
    await CapacitorUpdater.next({ id: bundle.id });
    readyUpdate = { id: bundle.id };
    status('Update ready! Tap UPDATE READY, or reopen the game.');
  } catch (e) {
    console.warn('Update check failed', e);
    status(`Update failed: ${errText(e)}`);
  } finally {
    busy = false;
  }
}

function errText(e: unknown) {
  return (e instanceof Error ? e.message : String(e)).slice(0, 80);
}

export async function applyUpdate() {
  if (readyUpdate) await CapacitorUpdater.set({ id: readyUpdate.id });
}

export const isPhoneApp = () => Capacitor.isNativePlatform();
