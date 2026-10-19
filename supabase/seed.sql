-- Starter catalog data (game design data, not player data).
-- Every insert is an upsert, so this file can be re-run after edits.

insert into factions (id, name, description, hidden_lore, reveal_flag, color_hex, passive_buffs) values
  ('order_of_dawn', 'Order of Dawn', 'Knights sworn to protect the Ancient Core.',
   'The Order knows the Core feeds on the land. They hide it to keep their power.', 'core_is_draining', '#e8c15a',
   '{"wall_hp":0.10}'),
  ('sylvan_circle', 'Sylvan Circle', 'Forest wardens who hear the voice of the land.',
   'The Circle once tried to shut down the Core and was branded traitors.', 'circle_was_right', '#5fae5a',
   '{"generator_rate":0.10}'),
  ('ashen_remnant', 'Ashen Remnant', 'Exiles living in the mountain ruins.',
   'The "monsters" attacking the towns were once Remnant villagers, twisted by the Core.', 'monsters_were_human', '#9a6bd1',
   '{"night_atk":0.15}')
on conflict (id) do update set name = excluded.name, description = excluded.description,
  hidden_lore = excluded.hidden_lore, reveal_flag = excluded.reveal_flag,
  color_hex = excluded.color_hex, passive_buffs = excluded.passive_buffs;

insert into faction_relations (faction_a, faction_b, base_standing) values
  ('ashen_remnant', 'order_of_dawn', -60),
  ('ashen_remnant', 'sylvan_circle',  10),
  ('order_of_dawn', 'sylvan_circle', -20)
on conflict (faction_a, faction_b) do update set base_standing = excluded.base_standing;

insert into races (id, name, description, base_stats, passive_buffs) values
  ('human',    'Human',    'Adaptable and ambitious.',       '{"hp":100,"mp":30,"atk":10,"def":10,"spd":10}', '{"exp_gain":0.10}'),
  ('beastkin', 'Beastkin', 'Fierce hunters of the wilds.',   '{"hp":110,"mp":15,"atk":13,"def":9,"spd":12}',  '{"crit_rate":0.08}'),
  ('elf',      'Elf',      'Long-lived forest folk.',        '{"hp":85,"mp":50,"atk":8,"def":8,"spd":13}',    '{"mp_regen":0.20}'),
  ('dwarf',    'Dwarf',    'Mountain builders.',             '{"hp":120,"mp":20,"atk":11,"def":14,"spd":7}',  '{"build_speed":0.15}'),
  ('demonkin', 'Demonkin', 'Touched by the Abyss''s fire.',  '{"hp":95,"mp":40,"atk":13,"def":8,"spd":11}',   '{"lifesteal":0.05}')
on conflict (id) do update set name = excluded.name, description = excluded.description,
  base_stats = excluded.base_stats, passive_buffs = excluded.passive_buffs;

-- Base jobs (tier 1) first, then sub-classes (tier 2).
insert into jobs (id, name, tier, parent_job_id, unlock_parent_level, stat_modifiers, allowed_weapons, skills) values
  ('warrior', 'Warrior', 1, null, 0, '{"hp":1.2,"atk":1.1}',   '{sword,axe,spear}', '[{"id":"slash","level":1,"mp":0}]'),
  ('mage',    'Mage',    1, null, 0, '{"mp":1.4,"def":0.9}',   '{staff}',           '[{"id":"firebolt","level":1,"mp":5}]'),
  ('rogue',   'Rogue',   1, null, 0, '{"spd":1.25,"atk":1.05}','{dagger,bow}',      '[{"id":"backstab","level":1,"mp":3}]'),
  ('builder', 'Builder', 1, null, 0, '{"def":1.1}',            '{hammer}',          '[{"id":"quick_repair","level":1,"mp":3}]')
on conflict (id) do update set name = excluded.name, stat_modifiers = excluded.stat_modifiers,
  allowed_weapons = excluded.allowed_weapons, skills = excluded.skills;

insert into jobs (id, name, tier, parent_job_id, unlock_parent_level, stat_modifiers, allowed_weapons, skills) values
  ('warrior_knight',       'Knight',       2, 'warrior', 10, '{"def":1.3,"hp":1.2}',  '{sword,spear}', '[{"id":"charge","level":1,"mp":6}]'),
  ('warrior_paladin',      'Paladin',      2, 'warrior', 15, '{"def":1.2,"mp":1.3}',  '{sword}',       '[{"id":"holy_strike","level":1,"mp":8}]'),
  ('warrior_berserker',    'Berserker',    2, 'warrior', 10, '{"atk":1.4,"def":0.8}', '{axe}',         '[{"id":"rage","level":1,"mp":8}]'),
  ('warrior_shield_master','Shield Master',2, 'warrior', 20, '{"hp":1.4,"def":1.5}',  '{sword}',       '[{"id":"shield_wall","level":1,"mp":10}]'),
  ('mage_elementalist',    'Elementalist', 2, 'mage',    10, '{"atk":1.3}',           '{staff}',       '[{"id":"chain_lightning","level":1,"mp":12}]'),
  ('mage_corebinder',      'Corebinder',   2, 'mage',    15, '{"mp":1.8}',            '{staff}',       '[{"id":"core_drain","level":1,"mp":12}]'),
  ('rogue_assassin',       'Assassin',     2, 'rogue',   10, '{"atk":1.3,"spd":1.3}', '{dagger}',      '[{"id":"shadow_step","level":1,"mp":6}]'),
  ('rogue_trapper',        'Trapper',      2, 'rogue',   10, '{"spd":1.2}',           '{bow,dagger}',  '[{"id":"snare","level":1,"mp":6}]'),
  ('builder_engineer',     'Engineer',     2, 'builder', 10, '{"def":1.2}',           '{hammer}',      '[{"id":"deploy_turret","level":1,"mp":10}]')
on conflict (id) do update set name = excluded.name, parent_job_id = excluded.parent_job_id,
  unlock_parent_level = excluded.unlock_parent_level, stat_modifiers = excluded.stat_modifiers,
  allowed_weapons = excluded.allowed_weapons, skills = excluded.skills;

insert into hero_templates (id, name, race_id, faction_id, default_job_id, backstory, is_starter) values
  ('kael',  'Kael',  'human',    'order_of_dawn', 'warrior', 'A young squire who believes every word the Order says.', true),
  ('lyra',  'Lyra',  'elf',      'sylvan_circle', 'mage',    'A wardens'' apprentice who hears the forest crying at night.', true),
  ('rook',  'Rook',  'beastkin', 'ashen_remnant', 'rogue',   'Raised among exiles. Remembers a village no map shows anymore.', true),
  ('brann', 'Brann', 'dwarf',    'order_of_dawn', 'builder', 'Built the town walls. Never asked what they keep out.', false),
  ('vesh',  'Vesh',  'demonkin', 'ashen_remnant', 'mage',    'Wears the face of the monsters the Order hunts.', false)
on conflict (id) do update set name = excluded.name, race_id = excluded.race_id, faction_id = excluded.faction_id,
  default_job_id = excluded.default_job_id, backstory = excluded.backstory, is_starter = excluded.is_starter;

insert into items (id, name, type, rarity, weapon_type, stats, effect, max_stack, buy_price, sell_price) values
  ('rusty_sword',   'Rusty Sword',   'weapon',     'common',   'sword',  '{"atk":4}',  '{}', 1, 30,  5),
  ('iron_sword',    'Iron Sword',    'weapon',     'common',   'sword',  '{"atk":9}',  '{}', 1, 120, 30),
  ('oak_staff',     'Oak Staff',     'weapon',     'common',   'staff',  '{"atk":3,"mp":15}', '{}', 1, 60, 10),
  ('hunter_dagger', 'Hunter Dagger', 'weapon',     'common',   'dagger', '{"atk":6,"spd":2}', '{}', 1, 80, 15),
  ('leather_armor', 'Leather Armor', 'armor',      'common',   null,     '{"def":5}',  '{}', 1, 70, 15),
  ('core_shard',    'Core Shard',    'accessory',  'rare',     null,     '{"mp":20}',  '{}', 1, null, 100),
  ('health_potion', 'Health Potion', 'consumable', 'common',   null,     '{}', '{"heal_hp":50}', 99, 25, 5),
  ('mana_potion',   'Mana Potion',   'consumable', 'common',   null,     '{}', '{"heal_mp":30}', 99, 30, 6),
  ('slime_gel',     'Slime Gel',     'material',   'common',   null,     '{}', '{}', 999, null, 2),
  ('wolf_pelt',     'Wolf Pelt',     'material',   'common',   null,     '{}', '{}', 999, null, 6)
on conflict (id) do update set name = excluded.name, type = excluded.type, rarity = excluded.rarity,
  weapon_type = excluded.weapon_type, stats = excluded.stats, effect = excluded.effect,
  max_stack = excluded.max_stack, buy_price = excluded.buy_price, sell_price = excluded.sell_price;

-- levels: one entry per level (max_level entries).
insert into building_types (id, name, category, max_level, footprint_w, footprint_h, required_town_level, levels) values
  ('ancient_core', 'Ancient Core', 'utility', 3, 2, 2, 1, '[
     {"cost":{"gold":0},"build_seconds":0,"hp":2000},
     {"cost":{"gold":800,"stone":400,"mana":100},"build_seconds":1800,"hp":3000},
     {"cost":{"gold":2000,"stone":1000,"mana":400},"build_seconds":7200,"hp":4500}]'),
  ('wooden_wall', 'Wooden Wall', 'wall', 3, 1, 1, 1, '[
     {"cost":{"wood":10},"build_seconds":5,"hp":150},
     {"cost":{"wood":25,"stone":10},"build_seconds":30,"hp":300},
     {"cost":{"stone":60},"build_seconds":120,"hp":600}]'),
  ('arrow_tower', 'Arrow Tower', 'tower', 3, 1, 1, 1, '[
     {"cost":{"gold":50,"wood":40},"build_seconds":30,"hp":200,"attack":{"dmg":8,"range":4,"rate":1.0}},
     {"cost":{"gold":120,"wood":80},"build_seconds":180,"hp":300,"attack":{"dmg":14,"range":5,"rate":1.2}},
     {"cost":{"gold":300,"stone":150},"build_seconds":900,"hp":450,"attack":{"dmg":22,"range":5,"rate":1.5}}]'),
  ('spike_trap', 'Spike Trap', 'trap', 2, 1, 1, 1, '[
     {"cost":{"wood":20,"stone":10},"build_seconds":10,"hp":50,"attack":{"dmg":20,"range":0,"rate":0.5}},
     {"cost":{"stone":40},"build_seconds":120,"hp":80,"attack":{"dmg":35,"range":0,"rate":0.5}}]'),
  ('lumber_mill', 'Lumber Mill', 'generator', 3, 2, 2, 1, '[
     {"cost":{"gold":40},"build_seconds":20,"hp":200,"produces":{"wood":60},"per_seconds":3600,"storage_cap":300},
     {"cost":{"gold":120,"wood":50},"build_seconds":300,"hp":300,"produces":{"wood":120},"per_seconds":3600,"storage_cap":700},
     {"cost":{"gold":300,"stone":100},"build_seconds":1200,"hp":400,"produces":{"wood":220},"per_seconds":3600,"storage_cap":1500}]'),
  ('stone_mine', 'Stone Mine', 'generator', 3, 2, 2, 1, '[
     {"cost":{"gold":60,"wood":30},"build_seconds":30,"hp":250,"produces":{"stone":40},"per_seconds":3600,"storage_cap":200},
     {"cost":{"gold":150,"wood":80},"build_seconds":400,"hp":350,"produces":{"stone":90},"per_seconds":3600,"storage_cap":500},
     {"cost":{"gold":350,"wood":200},"build_seconds":1500,"hp":450,"produces":{"stone":160},"per_seconds":3600,"storage_cap":1100}]'),
  ('farm', 'Farm', 'generator', 3, 2, 2, 1, '[
     {"cost":{"wood":30},"build_seconds":20,"hp":150,"produces":{"gold":50},"per_seconds":3600,"storage_cap":250},
     {"cost":{"gold":80,"wood":80},"build_seconds":300,"hp":220,"produces":{"gold":110},"per_seconds":3600,"storage_cap":600},
     {"cost":{"gold":200,"wood":200},"build_seconds":1200,"hp":300,"produces":{"gold":200},"per_seconds":3600,"storage_cap":1200}]'),
  ('mana_extractor', 'Mana Extractor', 'generator', 2, 1, 1, 2, '[
     {"cost":{"gold":300,"stone":150},"build_seconds":600,"hp":200,"produces":{"mana":15},"per_seconds":3600,"storage_cap":80},
     {"cost":{"gold":700,"stone":350},"build_seconds":2400,"hp":300,"produces":{"mana":35},"per_seconds":3600,"storage_cap":200}]')
on conflict (id) do update set name = excluded.name, category = excluded.category, max_level = excluded.max_level,
  footprint_w = excluded.footprint_w, footprint_h = excluded.footprint_h,
  required_town_level = excluded.required_town_level, levels = excluded.levels;

insert into quests (id, type, chapter, sort_order, title, description, prerequisites, objectives, rewards, recruit_hero_id, repeat_interval) values
  ('main_01_slimes', 'main', 1, 1, 'Slimes at the Gate',
   'Martha asks you to clear the slimes near the village.', '{}',
   '[{"type":"kill","target":"slime","count":5}]',
   '{"gold":100,"exp":50,"items":[{"id":"health_potion","qty":2}]}', null, null),
  ('main_02_core', 'main', 1, 2, 'Light of the Core',
   'Visit the Ancient Core beneath the mountain.', '{main_01_slimes}',
   '[{"type":"reach","target":"core_chamber"}]',
   '{"gold":150,"exp":80,"story_flags":["saw_the_core"]}', null, null),
  ('recruit_vesh', 'recruitment', 1, 10, 'The Ash Stranger',
   'A hooded figure watches the village from the ridge.', '{main_02_core}',
   '[{"type":"talk","target":"vesh"},{"type":"kill","target":"ash_wolf","count":5}]',
   '{"exp":60,"story_flags":["monsters_were_human"],"standing":{"ashen_remnant":20,"order_of_dawn":-10}}', 'vesh', null),
  ('guild_wolves', 'guild', 1, 20, 'Wolf Bounty',
   'The guild pays for wolf pelts.', '{}',
   '[{"type":"collect","target":"wolf_pelt","count":5}]',
   '{"gold":80,"items":[{"id":"hunter_dagger","qty":1}]}', null, null),
  ('wave_nightly', 'wave_defense', 1, 30, 'Abyssal Nightfall',
   'Abyssal creatures surface every night.', '{}',
   '[{"type":"survive_wave","count":1}]', '{"gold":60,"stone":30}', null, interval '12 hours')
on conflict (id) do update set type = excluded.type, chapter = excluded.chapter, sort_order = excluded.sort_order,
  title = excluded.title, description = excluded.description, prerequisites = excluded.prerequisites,
  objectives = excluded.objectives, rewards = excluded.rewards, recruit_hero_id = excluded.recruit_hero_id,
  repeat_interval = excluded.repeat_interval;
