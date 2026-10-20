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
  /** Only offered after this quest is completed (the story chain). */
  requires?: string;
  /** kill: monster id (or a boss tag); collect: item id; talk: npc id to go and speak to. */
  objective: { type: 'kill' | 'collect' | 'talk'; target: string; count: number; label: string };
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
  // Chapter 1: the Hooded Stranger, the goblins and the cave, and what the slimes really are.
  {
    id: 'main_02_stranger',
    title: 'The Hooded Stranger',
    giver: 'elder',
    requires: 'main_01_slimes',
    objective: { type: 'talk', target: 'stranger', count: 1, label: 'Speak with the stranger east of the river' },
    rewards: { gold: 30, exp: 40, items: [] },
  },
  {
    id: 'main_03_goblins',
    title: 'Crystal Thieves',
    giver: 'ranger',
    requires: 'main_02_stranger',
    objective: { type: 'kill', target: 'goblin', count: 6, label: 'Goblins defeated at the ruins' },
    rewards: { gold: 120, exp: 90, items: [{ id: 'health_potion', qty: 2 }] },
  },
  {
    id: 'main_04_cave',
    title: 'The Old Cave',
    giver: 'elder',
    requires: 'main_03_goblins',
    objective: { type: 'kill', target: 'gravemaw', count: 1, label: 'Gravemaw defeated (Old Cave, north road)' },
    rewards: { gold: 250, exp: 200, items: [{ id: 'core_shard', qty: 1 }] },
  },
  {
    id: 'main_05_locket',
    title: 'A Locket in the Dark',
    giver: 'stranger',
    requires: 'main_04_cave',
    objective: { type: 'talk', target: 'villager2', count: 1, label: 'Show the locket to Hana' },
    rewards: { gold: 100, exp: 150, items: [] },
  },
  // Chapter 2: the Sylvan Wood, where the elves who first sealed the Core still keep watch.
  {
    id: 'main_06_sylvan',
    title: 'The Ones Who Remember',
    giver: 'stranger',
    requires: 'main_05_locket',
    objective: { type: 'talk', target: 'warden', count: 1, label: 'Find the elf Warden (Sylvan Wood, end of the south road)' },
    rewards: { gold: 80, exp: 120, items: [] },
  },
  {
    id: 'main_07_blight',
    title: 'Blight in the Glen',
    giver: 'warden',
    requires: 'main_06_sylvan',
    objective: { type: 'kill', target: 'slime_purple', count: 8, label: 'Blight Slimes defeated (the Glen, west)' },
    rewards: { gold: 200, exp: 260, items: [{ id: 'health_potion', qty: 3 }] },
  },
  {
    id: 'main_08_husks',
    title: 'The Hollow Ones',
    giver: 'warden',
    requires: 'main_07_blight',
    objective: { type: 'kill', target: 'husk', count: 5, label: 'Rotwood Husks defeated (the Hollow, south-west)' },
    rewards: { gold: 260, exp: 340, items: [{ id: 'mana_potion', qty: 3 }] },
  },
  {
    id: 'main_09_vyrnax',
    title: 'Heart of the Wood',
    giver: 'warden',
    requires: 'main_08_husks',
    objective: { type: 'kill', target: 'vyrnax', count: 1, label: 'Vyrnax defeated (the Heart Grove, south; level 8+ advised)' },
    rewards: { gold: 500, exp: 800, items: [{ id: 'sylvan_longbow', qty: 1 }, { id: 'core_shard', qty: 1 }] },
  },
  {
    id: 'main_10_martha',
    title: 'What the Elder Knew',
    giver: 'warden',
    requires: 'main_09_vyrnax',
    objective: { type: 'talk', target: 'elder', count: 1, label: 'Confront Martha in Oakhaven' },
    rewards: { gold: 150, exp: 300, items: [] },
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
    const n = q.objective.type === 'collect' ? state.inventory.get(q.objective.target) ?? 0 : this.kills.get(q.id) ?? 0;
    return Math.min(n, q.objective.count);
  }

  isDone(id: string) {
    return this.progress(id) >= this.get(id).objective.count;
  }

  /** Available and its story requirement is met: the giver can offer it now. */
  canOffer(id: string) {
    const q = this.get(id);
    return this.status.get(id) === 'available' && (!q.requires || this.status.get(q.requires) === 'completed');
  }

  /** The active "go and talk to" quest that speaking with this NPC finishes, if any. */
  talkQuestFor(npcId: string): QuestDef | undefined {
    return this.active().find((q) => q.objective.type === 'talk' && q.objective.target === npcId);
  }

  /** Quest marker over an NPC: '?' something to hand in or say, '!' a new quest, '' nothing. */
  markerFor(npcId: string): '!' | '?' | '' {
    if (this.talkQuestFor(npcId)) return '?';
    const mine = QUESTS.filter((q) => q.giver === npcId);
    if (mine.some((q) => this.status.get(q.id) === 'active' && q.objective.type !== 'talk' && this.isDone(q.id))) return '?';
    return mine.some((q) => this.canOffer(q.id)) ? '!' : '';
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
