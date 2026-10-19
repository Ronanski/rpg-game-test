// Character creation choices: race (with its passive), gender, and an easy-to-remember name.
// Everyone starts as a classless Adventurer; jobs are earned in play and can be changed anytime.
// Race stats and passives mirror the races table in supabase/seed.sql.

export type Gender = 'male' | 'female';

export interface RaceDef {
  id: string; // races.id
  name: string;
  passive: string; // races.passive_buffs, in words
  blurb: string;
  /** Sprite per gender; a race without art for both is shown as "coming soon". */
  sprite: Partial<Record<Gender, string>>;
  names: Record<Gender, string[]>;
}

export const RACES_INFO: RaceDef[] = [
  {
    id: 'human', name: 'Human', passive: '+10% EXP', blurb: 'Adaptable and ambitious.',
    sprite: { male: 'hero', female: 'npc_healer' },
    names: { male: ['Kael', 'Aren', 'Dain', 'Rowan', 'Cale'], female: ['Mira', 'Tessa', 'Elin', 'Rhea', 'Nora'] },
  },
  {
    id: 'elf', name: 'Elf', passive: '+20% MP regen', blurb: 'Long-lived forest folk.',
    sprite: { male: 'hero_rook', female: 'hero_lyra' },
    names: { male: ['Elric', 'Faen', 'Sylas', 'Thal', 'Ivo'], female: ['Aelin', 'Nyla', 'Siri', 'Lira', 'Lyse'] },
  },
  {
    id: 'beastkin', name: 'Beastkin', passive: '+8% critical hits', blurb: 'Fierce hunters of the wilds.',
    sprite: {},
    names: { male: ['Rook', 'Fang', 'Brak', 'Tor', 'Grey'], female: ['Kira', 'Sasha', 'Rin', 'Tala', 'Vex'] },
  },
  {
    id: 'dwarf', name: 'Dwarf', passive: '+15% build speed', blurb: 'Mountain builders.',
    sprite: {},
    names: { male: ['Durin', 'Brom', 'Gunn', 'Thane', 'Rurik'], female: ['Helga', 'Brynn', 'Dagny', 'Inga', 'Sigra'] },
  },
  {
    id: 'demonkin', name: 'Demonkin', passive: '5% lifesteal', blurb: "Touched by the Abyss's fire.",
    sprite: {},
    names: { male: ['Vesh', 'Malik', 'Zane', 'Korr', 'Azar'], female: ['Lilit', 'Nyx', 'Sable', 'Vira', 'Ember'] },
  },
];

export const START_JOB = 'adventurer';
