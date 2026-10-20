import { state, emitStats } from '../../core/GameState';
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

const REST_COST = 10;

/** What the person you were sent to says when you arrive (finishes a "talk" quest). */
const TALK_LINES: Record<string, string[]> = {
  main_02_stranger: [
    'Martha sent you to spy on me? Ha. Of course she did.',
    'Listen. The slimes, the wolves running toward the light, the goblins stealing crystals... it all leads to the Old Cave.',
    'Ask the ranger, Wren. She has seen the goblins at work. Then decide whose side you are on.',
  ],
  main_05_locket: [
    'That locket... where did you get it? That is Rowan\'s. My brother\'s.',
    'He went to the mountain last spring to look for work. He never came back.',
    'Inside a slime? No. No, that can\'t be... can it?',
  ],
  main_06_sylvan: [
    'An archer of Oakhaven, in our wood? And an elf, at that. You have been away from your people a long time.',
    'The Core is waking, you say. We know. Its blight already creeps under our roots.',
    'Help us cleanse the wood, and I will tell you what Oakhaven has chosen to forget.',
  ],
  main_10_martha: [
    'So. The elves told you.',
    'Do you know what Oakhaven was before the Core? A village of graves. Wolves at every door, orcs every winter.',
    'The Core keeps the night away. It only asks for one of us, now and then. One, to save hundreds.',
    'Rowan understood. In the end.',
    '...Go, then. Tell them all. And see how long the Core keeps its light without me.',
  ],
};

/** Picks what an NPC says based on quest state and story flags. */
export class DialogueSystem {
  constructor(private quests: QuestTracker) {}

  talk(npcId: string, npcName: string): Conversation {
    const say = (...texts: string[]) => texts.map((text) => ({ speaker: npcName, text }));
    // "Go and talk to ..." quests finish when you reach that person.
    const tq = this.quests.talkQuestFor(npcId);
    if (tq) return { lines: say(...TALK_LINES[tq.id]), onEnd: () => this.finishTalk(tq.id) };
    switch (npcId) {
      case 'elder':
        if (state.storyFlags.has('chapter2_done')) {
          return { lines: say('Do not look at me like that.', 'Every night the Core shines, you are alive because of what I did.') };
        }
        if (this.quests.statusOf('main_01_slimes') === 'completed') {
          return this.chain([
            {
              id: 'main_02_stranger',
              offer: say(
                'There is something else. A hooded stranger has made camp east of the river.',
                'He asks questions about the Core. Too many questions. Go and see what he wants.',
              ),
              busy: say('The stranger camps east of the river, past the bridge.'),
            },
            {
              id: 'main_04_cave',
              offer: say(
                'Goblins, carrying Core crystals into the Old Cave? That cave was sealed when I was a girl.',
                'Something down there is calling them. Go up the north road and end it, whatever it is.',
                'And... if you find anything that belongs to the village, bring it back to me first.',
              ),
              busy: say('The Old Cave is at the end of the north road. Be careful in the dark.'),
              finish: say(
                'You killed it? Then the cave is quiet again. Good. Good.',
                'Take this Core Shard as thanks. Now, that locket you found... give it to me. It is nothing. Just old junk.',
                '...No? Then keep it. But do not go showing it around the village.',
              ),
            },
          ], say('Wren the ranger has been watching the goblins. Ask her what she has seen.'), say('Rest now. The Core watches over us all.'));
        }
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
        if (this.quests.statusOf('main_04_cave') === 'completed') {
          return this.chain([
            {
              id: 'main_05_locket',
              offer: say(
                'You went down into the dark and came back. Few do.',
                'That locket. Look at the name on the back. Then show it to the girl with the bow. Hana.',
              ),
              busy: say('Show the locket to Hana. She is in the village, by the south houses.'),
            },
            {
              id: 'main_06_sylvan',
              offer: say(
                'Hana will be safer with you than in that village.',
                'The Core was not made by Oakhaven. The elves of the Sylvan Wood sealed it long ago, and they still keep watch.',
                'Take the south road to its end. Find their Warden, Vaelen. Tell him the Core is waking.',
              ),
              busy: say('The Sylvan Wood is at the end of the south road. Find Vaelen.'),
            },
          ], say('...'), say(
            'Now you know. The Core does not protect Oakhaven. It feeds on it.',
            'Every slime you cut down was someone, once. Your Elder knows. She has always known.',
          ));
        }
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
      case 'warden':
        if (this.quests.statusOf('main_06_sylvan') !== 'completed') {
          return { lines: say('Turn back, traveller. The wood is not safe, and we do not know you.') };
        }
        return this.chain([
          {
            id: 'main_07_blight',
            offer: say(
              'The Blight Slimes in the Glen, west of our camp, were creatures of this wood once. The Core\'s light twists all it touches.',
              'Cut down eight of them. It is a mercy.',
            ),
            busy: (n: number, max: number) => say(`${n} of ${max}. The Glen lies west of the camp.`),
            finish: say(
              'The Glen breathes again. Thank you.',
              'Now hear the truth. Three hundred years ago my people sealed the Core under your mountain.',
              'The seal needed a guardian. And the Core needed... feeding.',
            ),
          },
          {
            id: 'main_08_husks',
            offer: say(
              'In the Hollow, to the south-west, the dead walk. Rotwood Husks, we call them.',
              'Defeat five. Then look closely at their clothes. They are not elves.',
            ),
            busy: (n: number, max: number) => say(`${n} of ${max} husks. The Hollow is south-west, past the Glen.`),
            finish: say(
              'Oakhaven cloth. Oakhaven boots.',
              'Your Elder has been sending people into this wood for years. "Lost on the road," she tells their families.',
            ),
          },
          {
            id: 'main_09_vyrnax',
            offer: say(
              'Vyrnax was the seal\'s guardian, a great wyrm bound to the Heart Grove. The blight has taken his mind.',
              'Free him. Go south, past the Moonwell, to the Heart Grove.',
            ),
            busy: say('The Heart Grove is south, past the Moonwell. Vyrnax waits there.'),
            finish: say(
              'It is done. Vyrnax is at rest... and the Core has no guardian now.',
              'Take my bow. You have earned it, and you will need it.',
            ),
          },
          {
            id: 'main_10_martha',
            offer: say('Go back to Oakhaven. Ask your Elder what she traded, and for how long.'),
            busy: say('Martha waits in Oakhaven. She knows you are coming. She always knows.'),
          },
        ], say('Rest by the fire. The wood is quieter while you are here.'), say(
          'The Core stirs, unguarded. When you are ready, we will speak of the seal again.',
          '(Chapter 3 is coming.)',
        ));
      case 'herbalist':
        return {
          lines: say('Moss, bark and spider silk. Elven goods, for those the Warden trusts.'),
          onEnd: () => bus.emit('open-shop', { name: "Lyra's Goods", sells: ['elven_bow', 'leaf_mail', 'health_potion', 'mana_potion'] }),
        };
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
          lines: say('Swords, bows, daggers, staves and armor! Take a look, friend.', 'I buy pelts and gel too.'),
          onEnd: () => bus.emit('open-shop', { name: 'Gus\'s Goods', sells: ['iron_sword', 'hunter_dagger', 'hunter_bow', 'oak_staff', 'leather_armor', 'rusty_sword'] }),
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
        if (this.quests.statusOf('main_02_stranger') === 'completed') {
          return this.chain([
            {
              id: 'main_03_goblins',
              offer: say(
                'Martha sent you? Good. I need a sword arm.',
                'The goblins at the north-west ruins dig up Core crystals and carry them to the Old Cave. Every night.',
                'Thin them out. Six should make them think twice.',
              ),
              busy: (n: number, max: number) => say(`${n} of ${max} goblins. The ruins are north-west, past the stable.`),
              finish: say('Six fewer thieves. But the crystals still vanish into that cave.', 'Tell Martha. Someone has to go down there.'),
            },
          ], say('...'), say('The goblins stay away from the ruins now. The cave still hums, though.'));
        }
        return { lines: say('Goblins have taken the old ruins to the north-west.', 'And blue slimes in the southern woods. They hit harder than the green ones.') };
      case 'innkeeper':
        return state.player!.gold >= REST_COST
          ? {
              lines: say('Welcome to the Sleeping Fox! A warm bed and a hot meal, 10 gold.', 'Sleep well, dear.'),
              onEnd: () => {
                const ps = state.player!;
                ps.gold -= REST_COST;
                ps.hp = ps.maxHp;
                ps.mp = ps.maxMp;
                emitStats();
                bus.emit('toast', `Rested at the Sleeping Fox. HP and MP restored (-${REST_COST} gold)`);
              },
            }
          : { lines: say('A bed is 10 gold, love. Come back when your purse is heavier.') };
      case 'apprentice':
        return {
          lines: say('Grom does the big jobs. I do the fine work. Steel, yew and crystal, the best in Oakhaven.'),
          onEnd: () => bus.emit('open-shop', { name: "Bree's Forge", sells: ['steel_sword', 'steel_dagger', 'yew_bow', 'crystal_staff', 'chain_mail'] }),
        };
      case 'farmer':
        return { lines: say('Slimes ate half my cabbages again!', 'They only come at night now. And there are more of them every week.') };
      case 'drunk':
        return { lines: say('*hic* The cave up north... it sings at night, you know.', 'My cousin went in to listen. Came out green and wobbly. *hic*', '...I am not joking.') };
      case 'towns1':
        return { lines: say('The bakery smells wonderful today. Have you tried the honey bread?') };
      case 'towns2':
        return { lines: say('Grom has been hammering since dawn. Something big is coming, he says.') };
      case 'towns3':
        return { lines: say('Turnips, carrots, cabbages... the slimes leave nothing for the market!') };
      case 'towns4':
        return { lines: say('I sit by the fountain every evening. The Core hums like a lullaby.', 'Creepy, if you think about it.') };
      case 'villager3':
        return { lines: say('The windmill west of here has been creaking all night.', 'Nobody has been inside it for years.') };
      case 'villager2':
        if (this.quests.statusOf('main_05_locket') === 'completed' && !state.storyFlags.has('hana_joined')) {
          return {
            lines: say(
              'I can\'t stay here. Not after this. Not with Martha smiling at me every morning.',
              'Rowan taught me to shoot. Let me come with you. Whatever the Core is, I want to see it end.',
            ),
            onEnd: () => {
              state.storyFlags.add('hana_joined');
              bus.emit('toast', 'Hana joined you! She follows you and shoots at monsters.');
              bus.emit('ally-joined');
            },
          };
        }
        return { lines: say('My brother went to the mountain ruins last spring.', 'He never wrote back.') };
      default:
        return { lines: say('...') };
    }
  }

  private finishTalk(id: string) {
    this.quests.complete(id);
    if (id === 'main_05_locket') {
      state.storyFlags.add('chapter1_done');
      bus.emit('toast', 'Chapter 1 complete: Echoes of the Core. The Sylvan Wood is open (end of the south road).');
    }
    if (id === 'main_10_martha') {
      state.storyFlags.add('chapter2_done');
      bus.emit('toast', 'Chapter 2 complete: The Sylvan Seal. To be continued...');
    }
  }

  /**
   * An NPC who gives several quests in story order: the first unfinished one decides what they
   * say. `waiting` while the next quest isn't unlocked yet, `done` once every one is finished.
   */
  private chain(
    steps: { id: string; offer: DialogueLine[]; busy: DialogueLine[] | ((n: number, max: number) => DialogueLine[]); finish?: DialogueLine[] }[],
    waiting: DialogueLine[],
    done: DialogueLine[],
  ): Conversation {
    const q = this.quests;
    for (const st of steps) {
      const status = q.statusOf(st.id);
      if (status === 'completed') continue;
      if (status === 'available') return q.canOffer(st.id) ? { lines: st.offer, onEnd: () => q.accept(st.id) } : { lines: waiting };
      if (st.finish && q.isDone(st.id)) return { lines: st.finish, onEnd: () => q.complete(st.id) };
      return { lines: typeof st.busy === 'function' ? st.busy(q.progress(st.id), q.get(st.id).objective.count) : st.busy };
    }
    return { lines: done };
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
