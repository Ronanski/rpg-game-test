-- =====================================================================
-- Initial schema
--
-- Two kinds of tables:
--   * CATALOG tables (factions, races, jobs, hero_templates, building_types,
--     quests): static game design data. Readable by everyone, editable only
--     via migrations/seed (service role).
--   * PLAYER tables (players, heroes, hero_jobs, town_buildings,
--     player_quests, wave_events, story_flags): per-player state.
--     Readable by the owner only. NEVER written directly by the client:
--     all writes go through the SECURITY DEFINER RPC functions at the bottom,
--     so gold, timers and unlocks are server-authoritative (no cheating by
--     editing requests).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type building_category as enum ('wall', 'tower', 'generator', 'trap', 'utility');
create type building_status   as enum ('idle', 'constructing', 'upgrading', 'destroyed');
create type quest_type        as enum ('main', 'recruitment', 'guild', 'wave_defense');
create type quest_status      as enum ('locked', 'available', 'active', 'completed', 'failed');
create type wave_status       as enum ('scheduled', 'in_progress', 'won', 'lost', 'missed');
create type resource_kind     as enum ('gold', 'wood', 'stone', 'mana');

-- =====================================================================
-- CATALOG TABLES
-- =====================================================================

create table factions (
  id            text primary key,              -- e.g. 'order_of_dawn'
  name          text not null,
  description   text not null default '',
  -- Revealed only after the matching story flag is set (mystery/twist).
  hidden_lore   text not null default '',
  reveal_flag   text,
  color_hex     text not null default '#ffffff'
);

create table races (
  id            text primary key,              -- e.g. 'human', 'sylvan'
  name          text not null,
  description   text not null default '',
  base_stats    jsonb not null default '{}'    -- {"hp":100,"mp":30,"atk":10,...}
);

-- Jobs and sub-classes in one tree (Octopath style).
-- tier 1 = base job (Warrior), tier 2+ = sub-class (Berserker) with parent_job_id.
create table jobs (
  id              text primary key,            -- e.g. 'warrior', 'warrior_berserker'
  name            text not null,
  description     text not null default '',
  tier            smallint not null default 1 check (tier between 1 and 3),
  parent_job_id   text references jobs(id),
  -- Job level of the parent job required to unlock this sub-class.
  unlock_parent_level smallint not null default 0,
  stat_modifiers  jsonb not null default '{}', -- multipliers {"atk":1.2,"def":0.9}
  allowed_weapons text[] not null default '{}',-- {'sword','axe'}
  skills          jsonb not null default '[]', -- [{"id":"cleave","level":1,"mp":5}, ...]
  check ((tier = 1) = (parent_job_id is null))
);
create index on jobs(parent_job_id);

-- Every hero that can exist: starters and recruitable sub-heroes.
create table hero_templates (
  id              text primary key,            -- e.g. 'kael'
  name            text not null,
  race_id         text not null references races(id),
  faction_id      text not null references factions(id),
  default_job_id  text not null references jobs(id),
  backstory       text not null default '',
  is_starter      boolean not null default false,  -- selectable at new game
  portrait_key    text not null default '',        -- asset key in the client
  sprite_key      text not null default ''
);

create table building_types (
  id              text primary key,            -- e.g. 'stone_wall', 'arrow_tower'
  name            text not null,
  category        building_category not null,
  description     text not null default '',
  max_level       smallint not null default 5,
  footprint_w     smallint not null default 1, -- tiles on the iso grid
  footprint_h     smallint not null default 1,
  -- One entry per level (index 0 = level 1). Each entry:
  -- {"cost":{"gold":50,"wood":20},"build_seconds":60,"hp":200,
  --  "produces":{"wood":10}, "per_seconds":3600, "storage_cap":500,
  --  "attack":{"dmg":12,"range":4,"rate":1.0}}
  levels          jsonb not null,
  -- Minimum town hall level needed to build this type.
  required_town_level smallint not null default 1,
  check (jsonb_typeof(levels) = 'array' and jsonb_array_length(levels) = max_level)
);

create table quests (
  id              text primary key,            -- e.g. 'main_01_the_core'
  type            quest_type not null,
  chapter         smallint not null default 1,
  sort_order      smallint not null default 0,
  title           text not null,
  description     text not null default '',
  -- Quest ids that must be completed first.
  prerequisites   text[] not null default '{}',
  -- [{"type":"kill","target":"slime","count":10}, {"type":"build","target":"arrow_tower","level":2}]
  objectives      jsonb not null default '[]',
  -- {"gold":100,"exp":50,"items":[...],"story_flags":["core_is_draining"]}
  rewards         jsonb not null default '{}',
  -- Only for type = 'recruitment'.
  recruit_hero_id text references hero_templates(id),
  -- Only for type = 'wave_defense': how often a wave repeats (null = one-off).
  repeat_interval interval,
  check ((type = 'recruitment') = (recruit_hero_id is not null))
);
create index on quests(type, chapter, sort_order);

-- =====================================================================
-- PLAYER TABLES
-- =====================================================================

create table players (
  id              uuid primary key references auth.users(id) on delete cascade,
  display_name    text not null default 'Wanderer'
                    check (char_length(display_name) between 1 and 24),
  faction_id      text references factions(id),      -- set when the starter is chosen
  town_level      smallint not null default 1,
  story_chapter   smallint not null default 1,
  gold            bigint not null default 200 check (gold  >= 0),
  wood            bigint not null default 100 check (wood  >= 0),
  stone           bigint not null default 50  check (stone >= 0),
  mana            bigint not null default 0   check (mana  >= 0),
  -- Town grid size (grows with town_level).
  town_grid_w     smallint not null default 16,
  town_grid_h     smallint not null default 16,
  created_at      timestamptz not null default now(),
  last_seen_at    timestamptz not null default now()
);

create table heroes (
  id              uuid primary key default gen_random_uuid(),
  player_id       uuid not null references players(id) on delete cascade,
  template_id     text not null references hero_templates(id),
  is_leader       boolean not null default false,   -- the chosen starter
  in_party        boolean not null default true,
  level           smallint not null default 1,
  exp             integer not null default 0,
  current_job_id  text not null references jobs(id),
  -- Currently equipped gear: {"weapon":"iron_sword","armor":"leather"}
  equipment       jsonb not null default '{}',
  recruited_at    timestamptz not null default now(),
  unique (player_id, template_id)
);
create index on heroes(player_id);
-- At most one leader per player.
create unique index heroes_one_leader on heroes(player_id) where is_leader;

-- Per-hero progress in each job, so switching jobs never loses progress.
create table hero_jobs (
  hero_id         uuid not null references heroes(id) on delete cascade,
  job_id          text not null references jobs(id),
  job_level       smallint not null default 1,
  job_exp         integer not null default 0,
  unlocked_at     timestamptz not null default now(),
  primary key (hero_id, job_id)
);

create table town_buildings (
  id              uuid primary key default gen_random_uuid(),
  player_id       uuid not null references players(id) on delete cascade,
  building_type_id text not null references building_types(id),
  level           smallint not null default 1,
  grid_x          smallint not null,
  grid_y          smallint not null,
  rotation        smallint not null default 0 check (rotation in (0, 90, 180, 270)),
  status          building_status not null default 'constructing',
  hp              integer not null default 0,
  -- Time-based building: the client shows a countdown to timer_ends_at.
  timer_started_at timestamptz,
  timer_ends_at    timestamptz,
  -- Generators: resources accumulate from this moment.
  last_collected_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (player_id, grid_x, grid_y)
);
create index on town_buildings(player_id);

create table player_quests (
  player_id       uuid not null references players(id) on delete cascade,
  quest_id        text not null references quests(id),
  status          quest_status not null default 'available',
  -- Mirrors quests.objectives: {"0":7,"1":1} = progress per objective index.
  progress        jsonb not null default '{}',
  started_at      timestamptz,
  completed_at    timestamptz,
  primary key (player_id, quest_id)
);

-- Scheduled wave attacks on the player's town.
create table wave_events (
  id              uuid primary key default gen_random_uuid(),
  player_id       uuid not null references players(id) on delete cascade,
  quest_id        text references quests(id),
  wave_number     integer not null default 1,
  difficulty      smallint not null default 1,
  -- [{"enemy":"slime","count":20,"delay_ms":0}, ...] generated server-side
  composition     jsonb not null default '[]',
  status          wave_status not null default 'scheduled',
  scheduled_at    timestamptz not null,
  resolved_at     timestamptz,
  result          jsonb                         -- {"kills":40,"buildings_lost":2}
);
create index on wave_events(player_id, status, scheduled_at);

-- Mystery / twist state. Flags like 'core_is_draining', 'monsters_were_human'.
create table story_flags (
  player_id       uuid not null references players(id) on delete cascade,
  flag            text not null,
  value           jsonb not null default 'true',
  set_at          timestamptz not null default now(),
  primary key (player_id, flag)
);

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================

-- Catalog: anyone (even logged-out) can read, nobody can write via API.
alter table factions       enable row level security;
alter table races          enable row level security;
alter table jobs           enable row level security;
alter table hero_templates enable row level security;
alter table building_types enable row level security;
alter table quests         enable row level security;

create policy "catalog read" on factions       for select using (true);
create policy "catalog read" on races          for select using (true);
create policy "catalog read" on jobs           for select using (true);
create policy "catalog read" on hero_templates for select using (true);
create policy "catalog read" on building_types for select using (true);
create policy "catalog read" on quests         for select using (true);

-- Player data: owner can read. Writes only through RPC functions below.
alter table players        enable row level security;
alter table heroes         enable row level security;
alter table hero_jobs      enable row level security;
alter table town_buildings enable row level security;
alter table player_quests  enable row level security;
alter table wave_events    enable row level security;
alter table story_flags    enable row level security;

create policy "own row"  on players        for select using (id = auth.uid());
create policy "own rows" on heroes         for select using (player_id = auth.uid());
create policy "own rows" on hero_jobs      for select using (
  exists (select 1 from heroes h where h.id = hero_id and h.player_id = auth.uid()));
create policy "own rows" on town_buildings for select using (player_id = auth.uid());
create policy "own rows" on player_quests  for select using (player_id = auth.uid());
create policy "own rows" on wave_events    for select using (player_id = auth.uid());
create policy "own rows" on story_flags    for select using (player_id = auth.uid());

-- The only direct write: renaming yourself.
create policy "rename self" on players for update
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on players from anon, authenticated;
grant update (display_name) on players to authenticated;

-- =====================================================================
-- AUTO-CREATE PLAYER ON SIGN-UP
-- =====================================================================

create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into players (id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =====================================================================
-- GAME RPC FUNCTIONS (server-authoritative)
-- Call from the client with: supabase.rpc('fn_name', { args })
-- =====================================================================

-- Helper: charge a cost like {"gold":50,"wood":20}. Raises if not enough.
create function _spend(p_player uuid, p_cost jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  update players set
    gold  = gold  - coalesce((p_cost->>'gold')::bigint,  0),
    wood  = wood  - coalesce((p_cost->>'wood')::bigint,  0),
    stone = stone - coalesce((p_cost->>'stone')::bigint, 0),
    mana  = mana  - coalesce((p_cost->>'mana')::bigint,  0)
  where id = p_player;
exception when check_violation then
  raise exception 'NOT_ENOUGH_RESOURCES';
end $$;

-- 1) New game: pick a starter hero. Sets faction, creates leader hero.
create function choose_starter(p_template_id text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  t hero_templates;
  v_hero uuid;
begin
  if exists (select 1 from heroes where player_id = auth.uid()) then
    raise exception 'ALREADY_STARTED';
  end if;
  select * into t from hero_templates where id = p_template_id and is_starter;
  if not found then raise exception 'INVALID_STARTER'; end if;

  update players set faction_id = t.faction_id where id = auth.uid();
  insert into heroes (player_id, template_id, is_leader, current_job_id)
    values (auth.uid(), t.id, true, t.default_job_id)
    returning id into v_hero;
  insert into hero_jobs (hero_id, job_id) values (v_hero, t.default_job_id);
  -- Unlock chapter 1 main quests and starter wave.
  insert into player_quests (player_id, quest_id, status)
    select auth.uid(), q.id, 'available' from quests q
    where q.chapter = 1 and cardinality(q.prerequisites) = 0
    on conflict do nothing;
  return v_hero;
end $$;

-- 2) Place a new building (starts construction timer).
create function place_building(p_type text, p_x smallint, p_y smallint, p_rotation smallint default 0)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  bt building_types;
  p  players;
  lvl jsonb;
  v_id uuid;
begin
  select * into p  from players where id = auth.uid() for update;
  select * into bt from building_types where id = p_type;
  if not found then raise exception 'INVALID_BUILDING'; end if;
  if p.town_level < bt.required_town_level then raise exception 'TOWN_LEVEL_TOO_LOW'; end if;
  if p_x < 0 or p_y < 0 or p_x + bt.footprint_w > p.town_grid_w
     or p_y + bt.footprint_h > p.town_grid_h then
    raise exception 'OUT_OF_BOUNDS';
  end if;
  -- Footprint overlap check against existing buildings.
  if exists (
    select 1 from town_buildings b join building_types t on t.id = b.building_type_id
    where b.player_id = auth.uid()
      and p_x < b.grid_x + t.footprint_w and b.grid_x < p_x + bt.footprint_w
      and p_y < b.grid_y + t.footprint_h and b.grid_y < p_y + bt.footprint_h
  ) then
    raise exception 'TILE_OCCUPIED';
  end if;

  lvl := bt.levels->0;
  perform _spend(auth.uid(), lvl->'cost');
  insert into town_buildings (player_id, building_type_id, grid_x, grid_y, rotation,
                              status, hp, timer_started_at, timer_ends_at)
  values (auth.uid(), p_type, p_x, p_y, p_rotation, 'constructing',
          coalesce((lvl->>'hp')::int, 100), now(),
          now() + make_interval(secs => coalesce((lvl->>'build_seconds')::int, 0)))
  returning id into v_id;
  return v_id;
end $$;

-- 3) Start upgrading a building to the next level.
create function start_upgrade(p_building uuid) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  b  town_buildings;
  bt building_types;
  lvl jsonb;
begin
  select * into b from town_buildings
    where id = p_building and player_id = auth.uid() for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if b.status <> 'idle' then raise exception 'BUSY'; end if;
  select * into bt from building_types where id = b.building_type_id;
  if b.level >= bt.max_level then raise exception 'MAX_LEVEL'; end if;

  lvl := bt.levels->(b.level);        -- next level (0-based index = current level)
  perform _spend(auth.uid(), lvl->'cost');
  update town_buildings set
    status = 'upgrading',
    timer_started_at = now(),
    timer_ends_at = now() + make_interval(secs => coalesce((lvl->>'build_seconds')::int, 0))
  where id = p_building
  returning timer_ends_at into b.timer_ends_at;
  return b.timer_ends_at;
end $$;

-- 4) Finish any timers that have elapsed. Call on login / when a countdown hits 0.
create function finish_timers() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with done as (
    update town_buildings b set
      level  = case when b.status = 'upgrading' then b.level + 1 else b.level end,
      status = 'idle',
      hp = coalesce((t.levels->(case when b.status = 'upgrading' then b.level else b.level - 1 end)->>'hp')::int, b.hp),
      timer_started_at = null,
      timer_ends_at = null,
      last_collected_at = now()
    from building_types t
    where t.id = b.building_type_id
      and b.player_id = auth.uid()
      and b.status in ('constructing', 'upgrading')
      and b.timer_ends_at <= now()
    returning 1)
  select count(*) into n from done;
  update players set last_seen_at = now() where id = auth.uid();
  return n;
end $$;

-- 5) Collect resources from a generator (production is computed from elapsed time).
create function collect_resources(p_building uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  b  town_buildings;
  lvl jsonb;
  elapsed numeric;
  per_seconds numeric;
  cap numeric;
  k text;
  amount bigint;
  gained jsonb := '{}';
begin
  select * into b from town_buildings
    where id = p_building and player_id = auth.uid() for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if b.status <> 'idle' then raise exception 'BUSY'; end if;

  select t.levels->(b.level - 1) into lvl from building_types t where t.id = b.building_type_id;
  if lvl->'produces' is null then raise exception 'NOT_A_GENERATOR'; end if;

  elapsed     := extract(epoch from now() - b.last_collected_at);
  per_seconds := coalesce((lvl->>'per_seconds')::numeric, 3600);
  cap         := coalesce((lvl->>'storage_cap')::numeric, 1e12);

  for k in select jsonb_object_keys(lvl->'produces') loop
    amount := floor(least(cap, (lvl->'produces'->>k)::numeric * elapsed / per_seconds));
    gained := gained || jsonb_build_object(k, amount);
  end loop;

  update players set
    gold  = gold  + coalesce((gained->>'gold')::bigint,  0),
    wood  = wood  + coalesce((gained->>'wood')::bigint,  0),
    stone = stone + coalesce((gained->>'stone')::bigint, 0),
    mana  = mana  + coalesce((gained->>'mana')::bigint,  0)
  where id = auth.uid();
  update town_buildings set last_collected_at = now() where id = p_building;
  return gained;
end $$;

-- 6) Change a hero's job (free, anytime in town). Unlocks the job entry if allowed.
create function change_job(p_hero uuid, p_job text) returns void
language plpgsql security definer set search_path = public as $$
declare
  j jobs;
  parent_level smallint;
begin
  if not exists (select 1 from heroes where id = p_hero and player_id = auth.uid()) then
    raise exception 'NOT_FOUND';
  end if;
  select * into j from jobs where id = p_job;
  if not found then raise exception 'INVALID_JOB'; end if;

  if not exists (select 1 from hero_jobs where hero_id = p_hero and job_id = p_job) then
    if j.parent_job_id is not null then
      select job_level into parent_level from hero_jobs
        where hero_id = p_hero and job_id = j.parent_job_id;
      if parent_level is null or parent_level < j.unlock_parent_level then
        raise exception 'JOB_LOCKED';
      end if;
    end if;
    insert into hero_jobs (hero_id, job_id) values (p_hero, p_job);
  end if;
  update heroes set current_job_id = p_job where id = p_hero;
end $$;

-- 7) Accept an available quest.
create function accept_quest(p_quest text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update player_quests set status = 'active', started_at = now()
  where player_id = auth.uid() and quest_id = p_quest and status = 'available';
  if not found then raise exception 'QUEST_NOT_AVAILABLE'; end if;
end $$;

-- 8) Complete a quest: grant rewards, recruit hero, set story flags,
--    unlock follow-up quests.
--    NOTE: objective progress is currently trusted from the client.
--    Later, validate kill/build objectives server-side (Edge Function).
create function complete_quest(p_quest text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  q quests;
  t hero_templates;
  v_hero uuid;
  f text;
begin
  select * into q from quests where id = p_quest;
  update player_quests set status = 'completed', completed_at = now()
  where player_id = auth.uid() and quest_id = p_quest and status = 'active';
  if not found then raise exception 'QUEST_NOT_ACTIVE'; end if;

  update players set
    gold  = gold  + coalesce((q.rewards->>'gold')::bigint,  0),
    wood  = wood  + coalesce((q.rewards->>'wood')::bigint,  0),
    stone = stone + coalesce((q.rewards->>'stone')::bigint, 0),
    mana  = mana  + coalesce((q.rewards->>'mana')::bigint,  0)
  where id = auth.uid();

  if q.recruit_hero_id is not null then
    select * into t from hero_templates where id = q.recruit_hero_id;
    insert into heroes (player_id, template_id, current_job_id)
      values (auth.uid(), t.id, t.default_job_id)
      on conflict (player_id, template_id) do nothing
      returning id into v_hero;
    if v_hero is not null then
      insert into hero_jobs (hero_id, job_id) values (v_hero, t.default_job_id);
    end if;
  end if;

  for f in select jsonb_array_elements_text(coalesce(q.rewards->'story_flags', '[]')) loop
    insert into story_flags (player_id, flag) values (auth.uid(), f)
      on conflict (player_id, flag) do nothing;
  end loop;

  -- Unlock quests whose prerequisites are now all completed.
  insert into player_quests (player_id, quest_id, status)
    select auth.uid(), n.id, 'available' from quests n
    where p_quest = any(n.prerequisites)
      and not exists (
        select 1 from unnest(n.prerequisites) pre
        where not exists (select 1 from player_quests pq
          where pq.player_id = auth.uid() and pq.quest_id = pre and pq.status = 'completed'))
    on conflict do nothing;

  return q.rewards;
end $$;

-- Lock down RPCs: only logged-in users; internal helper not callable.
revoke execute on all functions in schema public from public, anon;
grant execute on function
  choose_starter(text), place_building(text, smallint, smallint, smallint),
  start_upgrade(uuid), finish_timers(), collect_resources(uuid),
  change_job(uuid, text), accept_quest(text), complete_quest(text)
to authenticated;
