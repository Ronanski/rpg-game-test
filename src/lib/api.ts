import { supabase } from './supabase';

// Typed wrappers around the RPC functions in supabase/migrations.
// All game-state writes go through these; tables are read-only for the client.

export interface Player {
  id: string;
  display_name: string;
  faction_id: string | null;
  town_level: number;
  gold: number;
  wood: number;
  stone: number;
  mana: number;
  town_grid_w: number;
  town_grid_h: number;
}

export interface TownBuilding {
  id: string;
  building_type_id: string;
  level: number;
  grid_x: number;
  grid_y: number;
  status: 'idle' | 'constructing' | 'upgrading' | 'destroyed';
  timer_ends_at: string | null;
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!supabase) throw new Error('OFFLINE');
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const api = {
  async player(): Promise<Player | null> {
    if (!supabase) return null;
    const { data } = await supabase.from('players').select('*').single();
    return data as Player | null;
  },
  async buildings(): Promise<TownBuilding[]> {
    if (!supabase) return [];
    const { data } = await supabase.from('town_buildings').select('*');
    return (data ?? []) as TownBuilding[];
  },
  chooseStarter: (templateId: string) => rpc<string>('choose_starter', { p_template_id: templateId }),
  placeBuilding: (type: string, x: number, y: number, rotation = 0) =>
    rpc<string>('place_building', { p_type: type, p_x: x, p_y: y, p_rotation: rotation }),
  startUpgrade: (buildingId: string) => rpc<string>('start_upgrade', { p_building: buildingId }),
  finishTimers: () => rpc<number>('finish_timers'),
  collectResources: (buildingId: string) =>
    rpc<Record<string, number>>('collect_resources', { p_building: buildingId }),
  changeJob: (heroId: string, jobId: string) => rpc<void>('change_job', { p_hero: heroId, p_job: jobId }),
  acceptQuest: (questId: string) => rpc<void>('accept_quest', { p_quest: questId }),
  completeQuest: (questId: string) => rpc<Record<string, unknown>>('complete_quest', { p_quest: questId }),
};
