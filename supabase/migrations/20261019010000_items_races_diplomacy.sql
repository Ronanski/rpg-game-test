-- =====================================================================
-- GDD v2 additions
--   * items catalog + inventory_items (player inventory and equipment)
--   * race / faction passive buffs, faction diplomacy and player standing
--   * sub-hero assignments (party member, town commander, tower buffer)
--   * jobs_and_subclasses view
-- =====================================================================

-- ---------------------------------------------------------------------
-- Passive buffs and diplomacy
-- ---------------------------------------------------------------------
alter table races    add column passive_buffs jsonb not null default '{}';  -- {"build_speed":0.1}
alter table factions add column passive_buffs jsonb not null default '{}';

-- Base relationship between two factions (-100 hostile .. 100 allied).
create table faction_relations (
  faction_a     text not null references factions(id),
  faction_b     text not null references factions(id),
  base_standing smallint not null default 0 check (base_standing between -100 and 100),
  primary key (faction_a, faction_b),
  check (faction_a < faction_b)            -- store each pair once
);

-- How each faction currently sees this player.
create table player_faction_standing (
  player_id   uuid not null references players(id) on delete cascade,
  faction_id  text not null references factions(id),
  standing    smallint not null default 0 check (standing between -100 and 100),
  primary key (player_id, faction_id)
);

alter table faction_relations       enable row level security;
alter table player_faction_standing enable row level security;
create policy "catalog read" on faction_relations for select using (true);
create policy "own rows" on player_faction_standing for select using (player_id = auth.uid());

-- ---------------------------------------------------------------------
-- Jobs: readable alias matching the design doc naming
-- ---------------------------------------------------------------------
create view jobs_and_subclasses with (security_invoker = true) as
  select j.*, p.name as parent_job_name
  from jobs j left join jobs p on p.id = j.parent_job_id;

-- ---------------------------------------------------------------------
-- Sub-hero assignments
-- ---------------------------------------------------------------------
create type hero_assignment as enum ('party', 'commander', 'tower_buffer', 'idle');

alter table heroes add column assignment hero_assignment not null default 'party';
alter table heroes add column assigned_building_id uuid references town_buildings(id) on delete set null;
alter table heroes drop column in_party;
alter table heroes add constraint tower_buffer_needs_building
  check ((assignment = 'tower_buffer') = (assigned_building_id is not null));
-- One commander per town.
create unique index heroes_one_commander on heroes(player_id) where assignment = 'commander';

-- ---------------------------------------------------------------------
-- Items and inventory
-- ---------------------------------------------------------------------
create type item_type   as enum ('weapon', 'armor', 'accessory', 'consumable', 'material', 'key');
create type item_rarity as enum ('common', 'uncommon', 'rare', 'epic', 'legendary');
create type equip_slot  as enum ('weapon', 'armor', 'accessory');

create table items (
  id            text primary key,              -- e.g. 'iron_sword', 'health_potion'
  name          text not null,
  description   text not null default '',
  type          item_type not null,
  rarity        item_rarity not null default 'common',
  weapon_type   text,                          -- matches jobs.allowed_weapons ('sword', 'staff', ...)
  stats         jsonb not null default '{}',   -- {"atk":12,"spd":-1}
  effect        jsonb not null default '{}',   -- consumables: {"heal_hp":50}
  max_stack     integer not null default 1 check (max_stack >= 1),
  buy_price     integer,                       -- null = not sold in shops
  sell_price    integer not null default 0,
  icon_key      text not null default '',
  check ((type = 'weapon') = (weapon_type is not null))
);

-- One row per stack. Equipped gear is split into its own row with equipped_by_hero set.
create table inventory_items (
  id                uuid primary key default gen_random_uuid(),
  player_id         uuid not null references players(id) on delete cascade,
  item_id           text not null references items(id),
  quantity          integer not null default 1 check (quantity >= 1),
  equipped_by_hero  uuid references heroes(id) on delete set null,
  equipped_slot     equip_slot,
  acquired_at       timestamptz not null default now(),
  check ((equipped_by_hero is null) = (equipped_slot is null)),
  check (equipped_by_hero is null or quantity = 1)
);
create index on inventory_items(player_id);
-- At most one unequipped stack per item per player.
create unique index inventory_one_stack on inventory_items(player_id, item_id) where equipped_by_hero is null;
-- One item per slot per hero.
create unique index inventory_one_per_slot on inventory_items(equipped_by_hero, equipped_slot) where equipped_by_hero is not null;

alter table items           enable row level security;
alter table inventory_items enable row level security;
create policy "catalog read" on items for select using (true);
create policy "own rows" on inventory_items for select using (player_id = auth.uid());

-- The old free-form equipment column is replaced by inventory_items.
alter table heroes drop column equipment;

-- =====================================================================
-- RPC functions
-- =====================================================================

-- Add items to a player's inventory (internal helper).
create function _grant_item(p_player uuid, p_item text, p_qty integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_qty <= 0 then return; end if;
  insert into inventory_items (player_id, item_id, quantity)
    values (p_player, p_item, p_qty)
  on conflict (player_id, item_id) where equipped_by_hero is null
    do update set quantity = inventory_items.quantity + excluded.quantity;
end $$;

-- Change standing with a faction, clamped to [-100, 100] (internal helper).
create function _adjust_standing(p_player uuid, p_faction text, p_delta integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into player_faction_standing (player_id, faction_id, standing)
    values (p_player, p_faction, greatest(-100, least(100, p_delta)))
  on conflict (player_id, faction_id)
    do update set standing = greatest(-100, least(100, player_faction_standing.standing + p_delta));
end $$;

-- Equip one item from an unequipped stack onto a hero.
create function equip_item(p_hero uuid, p_item text) returns void
language plpgsql security definer set search_path = public as $$
declare
  it items;
  stack inventory_items;
  v_slot equip_slot;
  hero_job jobs;
begin
  if not exists (select 1 from heroes where id = p_hero and player_id = auth.uid()) then
    raise exception 'NOT_FOUND';
  end if;
  select * into it from items where id = p_item;
  if not found or it.type not in ('weapon', 'armor', 'accessory') then raise exception 'NOT_EQUIPPABLE'; end if;
  v_slot := it.type::text::equip_slot;

  if it.type = 'weapon' then
    select j.* into hero_job from heroes h join jobs j on j.id = h.current_job_id where h.id = p_hero;
    if not (it.weapon_type = any(hero_job.allowed_weapons)) then raise exception 'WEAPON_NOT_ALLOWED_FOR_JOB'; end if;
  end if;

  select * into stack from inventory_items
    where player_id = auth.uid() and item_id = p_item and equipped_by_hero is null for update;
  if not found then raise exception 'ITEM_NOT_OWNED'; end if;

  perform unequip_item(p_hero, v_slot);

  if stack.quantity = 1 then
    delete from inventory_items where id = stack.id;
  else
    update inventory_items set quantity = quantity - 1 where id = stack.id;
  end if;
  insert into inventory_items (player_id, item_id, quantity, equipped_by_hero, equipped_slot)
    values (auth.uid(), p_item, 1, p_hero, v_slot);
end $$;

-- Return whatever is in the slot back to the stack.
create function unequip_item(p_hero uuid, p_slot equip_slot) returns void
language plpgsql security definer set search_path = public as $$
declare cur inventory_items;
begin
  select * into cur from inventory_items
    where player_id = auth.uid() and equipped_by_hero = p_hero and equipped_slot = p_slot for update;
  if not found then return; end if;
  delete from inventory_items where id = cur.id;
  perform _grant_item(auth.uid(), cur.item_id, 1);
end $$;

-- Assign a hero to the party, as town commander, or as a tower buffer.
create function assign_hero(p_hero uuid, p_assignment hero_assignment, p_building uuid default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from heroes where id = p_hero and player_id = auth.uid()) then
    raise exception 'NOT_FOUND';
  end if;
  if p_assignment = 'tower_buffer' then
    if not exists (
      select 1 from town_buildings b join building_types t on t.id = b.building_type_id
      where b.id = p_building and b.player_id = auth.uid() and t.category = 'tower'
    ) then
      raise exception 'NOT_A_TOWER';
    end if;
  else
    p_building := null;
  end if;
  -- Demote the current commander if a new one is appointed.
  if p_assignment = 'commander' then
    update heroes set assignment = 'party'
      where player_id = auth.uid() and assignment = 'commander' and id <> p_hero;
  end if;
  update heroes set assignment = p_assignment, assigned_building_id = p_building where id = p_hero;
end $$;

-- Starting a game now also seeds faction standings from the chosen faction's relations.
create or replace function choose_starter(p_template_id text) returns uuid
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

  insert into player_faction_standing (player_id, faction_id, standing)
    select auth.uid(), f.id,
      case when f.id = t.faction_id then 50
           else coalesce((select r.base_standing from faction_relations r
                          where (r.faction_a, r.faction_b) in ((f.id, t.faction_id), (t.faction_id, f.id))), 0)
      end
    from factions f;

  perform _grant_item(auth.uid(), 'health_potion', 3);

  insert into player_quests (player_id, quest_id, status)
    select auth.uid(), q.id, 'available' from quests q
    where q.chapter = 1 and cardinality(q.prerequisites) = 0
    on conflict do nothing;
  return v_hero;
end $$;

-- Quest rewards can now include items and faction standing changes:
--   {"gold":100, "items":[{"id":"iron_sword","qty":1}], "standing":{"ashen_remnant":20}}
create or replace function complete_quest(p_quest text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  q quests;
  t hero_templates;
  v_hero uuid;
  f text;
  it jsonb;
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

  for it in select * from jsonb_array_elements(coalesce(q.rewards->'items', '[]')) loop
    perform _grant_item(auth.uid(), it->>'id', coalesce((it->>'qty')::int, 1));
  end loop;

  for f in select jsonb_object_keys(coalesce(q.rewards->'standing', '{}')) loop
    perform _adjust_standing(auth.uid(), f, (q.rewards->'standing'->>f)::int);
  end loop;

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

-- Supabase grants EXECUTE on new functions to anon and authenticated by default.
-- Revoke everything (this also closes the internal _spend/_grant_item/_adjust_standing
-- helpers, which must never be callable by players), then allow only the game RPCs.
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
grant execute on function
  choose_starter(text), place_building(text, smallint, smallint, smallint),
  start_upgrade(uuid), finish_timers(), collect_resources(uuid),
  change_job(uuid, text), accept_quest(text), complete_quest(text),
  equip_item(uuid, text), unequip_item(uuid, equip_slot),
  assign_hero(uuid, hero_assignment, uuid)
to authenticated;
