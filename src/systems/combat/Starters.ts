// Local mirror of the starter hero_templates in supabase/seed.sql (is_starter = true).

export interface StarterDef {
  id: string; // hero_templates.id
  name: string;
  raceId: string;
  jobId: string;
  faction: string;
  factionColor: number;
  backstory: string;
  texture: string;
}

export const STARTERS: StarterDef[] = [
  {
    id: 'kael', name: 'Kael', raceId: 'human', jobId: 'warrior',
    faction: 'Order of Dawn', factionColor: 0xe8c15a,
    backstory: 'A young squire who believes every word the Order says.',
    texture: 'hero',
  },
  {
    id: 'lyra', name: 'Lyra', raceId: 'elf', jobId: 'mage',
    faction: 'Sylvan Circle', factionColor: 0x5fae5a,
    backstory: 'A wardens\' apprentice who hears the forest crying at night.',
    texture: 'hero_lyra',
  },
  {
    id: 'rook', name: 'Rook', raceId: 'beastkin', jobId: 'rogue',
    faction: 'Ashen Remnant', factionColor: 0x9a6bd1,
    backstory: 'Raised among exiles. Remembers a village no map shows anymore.',
    texture: 'hero_rook',
  },
];
