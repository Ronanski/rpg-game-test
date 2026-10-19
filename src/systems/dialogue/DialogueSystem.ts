import { state } from '../../core/GameState';
import { isUnlocked, unlockJob } from '../combat/JobSystem';
import { bus } from '../../core/EventBus';
import type { QuestTracker } from '../quest/QuestTracker';

export interface DialogueLine {
  speaker: string;
  text: string;
}

export interface Conversation {
  lines: DialogueLine[];
  /** Screen position of the speaker's head, for the speech bubble. */
  anchor?: () => { x: number; y: number } | null;
  onEnd?: () => void;
}

/** Picks what an NPC says based on quest state and story flags. */
export class DialogueSystem {
  constructor(private quests: QuestTracker) {}

  talk(npcId: string, npcName: string): Conversation {
    const say = (...texts: string[]) => texts.map((text) => ({ speaker: npcName, text }));
    switch (npcId) {
      case 'elder':
        return this.questTalk('main_01_slimes', {
          offer: say(
            'Ah, a new face. Welcome to Oakhaven. I am Martha.',
            'For a hundred years the Ancient Core beneath the mountain has kept us safe.',
            'But lately, slimes crawl out of the ground near the fields. Please, defeat 5 of them.',
          ),
          busy: (n, max) => say(`${n} of ${max} slimes so far. The fields lie north-east and south-west of the village.`),
          finish: say(
            'You did it! Take these potions, and this gold.',
            'Strange... the slimes never came this close before the Core began to glow brighter.',
          ),
          after: say('The Core hums louder every night. That must be a good sign... right?'),
        });
      case 'smith':
        return this.questTalk('guild_wolves', {
          offer: say(
            'Name\'s Grom. I keep Oakhaven\'s forge burning.',
            'Wolves prowl across the river to the east. Bring me 5 wolf pelts and I\'ll make you a dagger.',
          ),
          busy: (n, max) => say(`${n} of ${max} pelts. Cross the bridge east of the village.`),
          finish: say('Fine pelts! Here, a Hunter Dagger. Sharp enough to cut a shadow.'),
          after: say('Funny thing. The wolves used to keep away from the Core\'s light. Now they run toward it.'),
        });
      case 'stranger': {
        if (state.storyFlags.has('met_stranger')) {
          return { lines: say('When the Core sings, someone, somewhere, stops breathing.') };
        }
        return {
          lines: say(
            'You carry the Order\'s light. I can smell it on you.',
            'Those slimes you cut down... have you ever wondered where they come from?',
            'Ask your Elder why the graves outside the village are empty.',
          ),
          onEnd: () => state.storyFlags.add('met_stranger'),
        };
      }
      case 'guard':
        return { lines: say('Stay on the roads after dark.', 'Wolves east of the river. Slimes in the fields. And worse things, they say.') };
      case 'wizard': {
        // Old Ezra teaches the Mage job once the player has some experience.
        if (isUnlocked('mage')) return { lines: say('Keep your flame small and your mind sharp.', 'The Core\'s light is beautiful. Beautiful things are often hungry.') };
        if (state.player!.level < 3) {
          return { lines: say('I am Ezra. Once, I taught magic to the Order.', 'Come back when you have seen a little more of the world. Level 3, perhaps.') };
        }
        return {
          lines: say('You have grown. I can feel it.', 'Hold out your hand. Picture a spark... now let it burn.', 'There. You can now become a Mage. Open JOBS when you are ready.'),
          onEnd: () => unlockJob('mage'),
        };
      }
      case 'villager':
        return { lines: say('Fresh bread at the stall! Well... fresh yesterday.') };
      case 'merchant':
        return {
          lines: say('Swords, daggers, staves and armor! Take a look, friend.', 'I buy pelts and gel too.'),
          onEnd: () => bus.emit('open-shop', { name: 'Gus\'s Goods', sells: ['iron_sword', 'hunter_dagger', 'oak_staff', 'leather_armor', 'rusty_sword'] }),
        };
      case 'healer':
        return {
          lines: say('Serena\'s remedies! Potions for cuts, bites and slime burns.'),
          onEnd: () => bus.emit('open-shop', { name: 'Serena\'s Remedies', sells: ['health_potion', 'mana_potion'] }),
        };
      case 'child':
        return { lines: say('Are you an adventurer? I saw a purple slime once!', 'Mom says the cave up north eats people.') };
      case 'bard':
        return { lines: say('♪ Oh the Core it glows, and the river flows... ♪', 'Need a song? I take tips. And gossip.') };
      case 'ranger':
        return { lines: say('Goblins have taken the old ruins to the north-west.', 'And blue slimes in the southern woods. They hit harder than the green ones.') };
      case 'villager3':
        return { lines: say('The windmill west of here has been creaking all night.', 'Nobody has been inside it for years.') };
      case 'villager2':
        return { lines: say('My brother went to the mountain ruins last spring.', 'He never wrote back.') };
      default:
        return { lines: say('...') };
    }
  }

  private questTalk(
    questId: string,
    t: { offer: DialogueLine[]; busy: (n: number, max: number) => DialogueLine[]; finish: DialogueLine[]; after: DialogueLine[] },
  ): Conversation {
    const q = this.quests;
    switch (q.statusOf(questId)) {
      case 'available':
        return { lines: t.offer, onEnd: () => q.accept(questId) };
      case 'active':
        if (q.isDone(questId)) return { lines: t.finish, onEnd: () => q.complete(questId) };
        return { lines: t.busy(q.progress(questId), q.get(questId).objective.count) };
      case 'completed':
        return { lines: t.after };
    }
  }
}
