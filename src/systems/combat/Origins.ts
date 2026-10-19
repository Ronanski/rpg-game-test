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
  /** Starting weapon per gender, matching what the art holds. */
  weapon: Partial<Record<Gender, string>>;
  names: Record<Gender, string[]>;
}

export const RACES_INFO: RaceDef[] = [
  {
    id: 'human', name: 'Human', passive: '+10% EXP', blurb: 'Adaptable and ambitious.',
    sprite: { male: 'hero', female: 'npc_healer' },
    weapon: { male: 'rusty_sword', female: 'hunter_dagger' },
    names: { male: ['Kael', 'Aren', 'Dain', 'Rowan', 'Cale'], female: ['Mira', 'Tessa', 'Elin', 'Rhea', 'Nora'] },
  },
  {
    id: 'elf', name: 'Elf', passive: '+20% MP regen', blurb: 'Long-lived forest folk.',
    sprite: { male: 'hero_rook', female: 'hero_lyra' },
    weapon: { male: 'hunter_bow', female: 'oak_staff' },
    names: { male: ['Elric', 'Faen', 'Sylas', 'Thal', 'Ivo'], female: ['Aelin', 'Nyla', 'Siri', 'Lira', 'Lyse'] },
  },
  {
    id: 'beastkin', name: 'Beastkin', passive: '+8% critical hits', blurb: 'Fierce hunters of the wilds.',
    sprite: {},
    weapon: {},
    names: { male: ['Rook', 'Fang', 'Brak', 'Tor', 'Grey'], female: ['Kira', 'Sasha', 'Rin', 'Tala', 'Vex'] },
  },
  {
    id: 'dwarf', name: 'Dwarf', passive: '+15% build speed', blurb: 'Mountain builders.',
    sprite: {},
    weapon: {},
    names: { male: ['Durin', 'Brom', 'Gunn', 'Thane', 'Rurik'], female: ['Helga', 'Brynn', 'Dagny', 'Inga', 'Sigra'] },
  },
  {
    id: 'demonkin', name: 'Demonkin', passive: '5% lifesteal', blurb: "Touched by the Abyss's fire.",
    sprite: {},
    weapon: {},
    names: { male: ['Vesh', 'Malik', 'Zane', 'Korr', 'Azar'], female: ['Lilit', 'Nyx', 'Sable', 'Vira', 'Ember'] },
  },
];

export const START_JOB = 'adventurer';

/**
 * What the hero wears in each job (by gender). The Adventurer keeps the race's own look.
 * Changing job changes the outfit, so the art always matches the job and weapon.
 */
export const JOB_OUTFIT: Record<string, Partial<Record<Gender, string>>> = {
  warrior: { male: 'npc_knight', female: 'npc_hilda' },
  rogue: { male: 'hero_rook', female: 'npc_kaelah' },
  mage: { male: 'npc_valerius', female: 'hero_lyra' },
  builder: { male: 'npc_borgan', female: 'npc_healer' },
};

export function outfitFor(raceId: string, gender: Gender, jobId: string): string {
  return JOB_OUTFIT[jobId]?.[gender] ?? RACES_INFO.find((r) => r.id === raceId)?.sprite[gender] ?? 'hero';
}
