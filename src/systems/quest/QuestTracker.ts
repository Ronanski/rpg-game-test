import { state, addItem, emitStats } from '../../core/GameState';
import { bus } from '../../core/EventBus';
import { api } from '../../services/api';

export type QuestStatus = 'available' | 'active' | 'completed';

/** What a save file stores about quests. */
export interface QuestState {
  status: [string, QuestStatus][];
  kills: [string, number][];
}

export interface QuestDef {
  id: string; // matches quests.id in supabase/seed.sql
  title: string;
  giver: string; // npc id
  objective: { type: 'kill' | 'collect'; target: string; count: number; label: string };
  rewards: { gold: number; exp: number; items: { id: string; qty: number }[] };
}

export const QUESTS: QuestDef[] = [
  {
    id: 'main_01_slimes',
    title: 'Slimes at the Gate',
    giver: 'elder',
    objective: { type: 'kill', target: 'slime', count: 5, label: 'Slimes defeated' },
    rewards: { gold: 100, exp: 50, items: [{ id: 'health_potion', qty: 2 }] },
  },
  {
    id: 'guild_wolves',
    title: 'Wolf Bounty',
    giver: 'smith',
    objective: { type: 'collect', target: 'wolf_pelt', count: 5, label: 'Wolf pelts' },
    rewards: { gold: 80, exp: 40, items: [{ id: 'hunter_dagger', qty: 1 }] },
  },
];

/** Tracks quest status and progress locally; mirrors accept/complete to Supabase when online. */
export class QuestTracker {
  private status = new Map<string, QuestStatus>(QUESTS.map((q) => [q.id, 'available']));
  private kills = new Map<string, number>();

  private gainExp: (n: number) => void = () => {};

  /** Quest EXP goes through the combat system so level-ups are handled in one place. */
  setExpHandler(fn: (n: number) => void) {
    this.gainExp = fn;
  }

  exportState(): QuestState {
    return { status: [...this.status.entries()], kills: [...this.kills.entries()] };
  }

  /** Restores from a save; quests added to the game after the save start as available. */
  importState(s: QuestState) {
    for (const [id, st] of s.status) if (this.status.has(id)) this.status.set(id, st);
    this.kills = new Map(s.kills);
    bus.emit('quest-updated');
  }

  get(id: string) {
    return QUESTS.find((q) => q.id === id)!;
  }

  statusOf(id: string): QuestStatus {
    return this.status.get(id)!;
  }

  progress(id: string): number {
    const q = this.get(id);
    const n = q.objective.type === 'kill' ? this.kills.get(q.id) ?? 0 : state.inventory.get(q.objective.target) ?? 0;
    return Math.min(n, q.objective.count);
  }

  isDone(id: string) {
    return this.progress(id) >= this.get(id).objective.count;
  }

  active(): QuestDef[] {
    return QUESTS.filter((q) => this.status.get(q.id) === 'active');
  }

  accept(id: string) {
    this.status.set(id, 'active');
    this.kills.set(id, 0);
    bus.emit('toast', `Quest started: ${this.get(id).title}`);
    bus.emit('quest-updated');
    if (state.online) api.acceptQuest(id).catch((e) => console.warn('acceptQuest', e));
  }

  complete(id: string) {
    const q = this.get(id);
    if (q.objective.type === 'collect') {
      addItem(q.objective.target, -q.objective.count);
    }
    this.status.set(id, 'completed');
    state.player!.gold += q.rewards.gold;
    q.rewards.items.forEach((it) => addItem(it.id, it.qty));
    this.gainExp(q.rewards.exp);
    emitStats();
    bus.emit('toast', `Quest complete! +${q.rewards.gold} gold`);
    bus.emit('quest-updated');
    if (state.online) api.completeQuest(id).catch((e) => console.warn('completeQuest', e));
  }

  onKill(monsterId: string) {
    for (const q of this.active()) {
      if (q.objective.type === 'kill' && q.objective.target === monsterId) {
        this.kills.set(q.id, (this.kills.get(q.id) ?? 0) + 1);
      }
    }
    // Collect quests depend on inventory, which may have just changed too.
    bus.emit('quest-updated');
  }
}
