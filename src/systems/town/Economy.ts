import { state, emitStats } from '../../core/GameState';
import { bus } from '../../core/EventBus';
import type { Cost, Resource } from './Buildings';

// Gold lives on the player; wood, stone and mana live in the town.

export function amount(r: Resource): number {
  return r === 'gold' ? state.player!.gold : state.town[r];
}

export function canAfford(c: Cost): boolean {
  return (Object.entries(c) as [Resource, number][]).every(([r, n]) => amount(r) >= n);
}

export function pay(c: Cost): boolean {
  if (!canAfford(c)) return false;
  for (const [r, n] of Object.entries(c) as [Resource, number][]) give(r, -n, false);
  changed();
  return true;
}

export function give(r: Resource, n: number, notify = true) {
  if (r === 'gold') state.player!.gold += n;
  else state.town[r] += n;
  if (notify) changed();
}

function changed() {
  emitStats();
  bus.emit('resources-changed');
}
