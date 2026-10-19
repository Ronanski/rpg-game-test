import { Capacitor, CapacitorHttp } from '@capacitor/core';
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
  let step = 'starting';
  try {
    status('Checking for updates…');
    // Tell the updater this version started fine. Not waited on: if it never answers, the check
    // still goes on (this is where v0.3.0 got stuck on "Checking for updates…").
    withTimeout(CapacitorUpdater.notifyAppReady(), 8000, 'ready').catch((e) => console.warn('notifyAppReady', e));
    step = 'reading the version online';
    status('Checking for updates… (reading the version online)');
    const version = await latestVersion();
    if (!version || version === BUILD_ID) return status(`Game is up to date. (build ${BUILD_ID.slice(0, 7)})`);
    step = 'looking for an earlier download';
    const { bundles } = await withTimeout(CapacitorUpdater.list(), 8000, step);
    const have = bundles.find((b) => b.version === version && b.status === 'success');
    if (have) {
      status('Installing update…');
      await CapacitorUpdater.set({ id: have.id });
      return;
    }
    step = 'downloading';
    status('Downloading update…');
    const bundle = await withTimeout(CapacitorUpdater.download({ url: `${SITE}bundle.zip?v=${version}`, version }), 120_000, step);
    step = 'preparing the update';
    await withTimeout(CapacitorUpdater.next({ id: bundle.id }), 8000, step);
    readyUpdate = { id: bundle.id };
    status('Update ready! Tap UPDATE READY, or reopen the game.');
  } catch (e) {
    console.warn('Update check failed', e);
    status(`Update failed while ${step}: ${errText(e)}`);
  } finally {
    busy = false;
  }
}

/** The newest build id online: through the web view first, then the phone's own connection. */
async function latestVersion(): Promise<string> {
  const url = `${SITE}version.json?t=${Date.now()}`;
  try {
    const res = await withTimeout(fetch(url, { cache: 'no-store' }), 10_000, 'web request');
    if (!res.ok) throw new Error(`server said ${res.status}`);
    return ((await res.json()) as { version: string }).version;
  } catch (first) {
    console.warn('version via fetch failed, trying native', first);
    const res = await withTimeout(CapacitorHttp.get({ url, responseType: 'json' }), 10_000, 'phone request');
    if (res.status !== 200) throw new Error(`server said ${res.status}`);
    const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
    return (data as { version: string }).version;
  }
}

/** Rejects if `p` hasn't settled within `ms` (so a step that never answers can't hang the check). */
function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`no answer from ${what} after ${Math.round(ms / 1000)}s`)), ms);
    p.then((v) => (clearTimeout(t), resolve(v)), (e) => (clearTimeout(t), reject(e)));
  });
}

function errText(e: unknown) {
  return (e instanceof Error ? e.message : String(e)).slice(0, 80);
}

export async function applyUpdate() {
  if (readyUpdate) await CapacitorUpdater.set({ id: readyUpdate.id });
}

export const isPhoneApp = () => Capacitor.isNativePlatform();
