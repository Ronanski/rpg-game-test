-- Starter catalog data. Safe to edit: this is game design data, not player data.

insert into factions (id, name, description, hidden_lore, reveal_flag, color_hex) values
  ('order_of_dawn', 'Order of Dawn', 'Knights sworn to protect the Ancient Core.',
   'The Order knows the Core feeds on the land. They hide it to keep their power.', 'core_is_draining', '#e8c15a'),
  ('sylvan_circle', 'Sylvan Circle', 'Forest wardens who hear the voice of the land.',
   'The Circle once tried to shut down the Core and was branded traitors.', 'circle_was_right', '#5fae5a'),
  ('ashen_remnant', 'Ashen Remnant', 'Exiles living in the mountain ruins.',
   'The "monsters" attacking the towns were once Remnant villagers, twisted by the Core.', 'monsters_were_human', '#9a6bd1');

insert into races (id, name, description, base_stats) values
  ('human',  'Human',  'Adaptable and ambitious.',   '{"hp":100,"mp":30,"atk":10,"def":10,"spd":10}'),
  ('sylvan', 'Sylvan', 'Long-lived forest folk.',    '{"hp":85,"mp":50,"atk":8,"def":8,"spd":13}'),
  ('dwarf',  'Dwarf',  'Mountain builders.',         '{"hp":120,"mp":20,"atk":11,"def":14,"spd":7}'),
  ('ashborn','Ashborn','Touched by the Core''s fire.','{"hp":95,"mp":40,"atk":13,"def":8,"spd":11}');

-- Base jobs (tier 1), then sub-classes (tier 2).
insert into jobs (id, name, tier, parent_job_id, unlock_parent_level, stat_modifiers, allowed_weapons, skills) values
  ('warrior', 'Warrior', 1, null, 0, '{"hp":1.2,"atk":1.1}', '{sword,axe}',  '[{"id":"slash","level":1,"mp":0}]'),
  ('ranger',  'Ranger',  1, null, 0, '{"spd":1.2,"atk":1.05}','{bow,dagger}','[{"id":"quick_shot","level":1,"mp":2}]'),
  ('mage',    'Mage',    1, null, 0, '{"mp":1.4,"def":0.9}', '{staff}',      '[{"id":"firebolt","level":1,"mp":5}]'),
  ('builder', 'Builder', 1, null, 0, '{"def":1.1}',          '{hammer}',     '[{"id":"quick_repair","level":1,"mp":3}]'),
  ('warrior_berserker', 'Berserker', 2, 'warrior', 10, '{"atk":1.4,"def":0.8}', '{axe}',   '[{"id":"rage","level":1,"mp":8}]'),
  ('warrior_guardian',  'Guardian',  2, 'warrior', 10, '{"hp":1.4,"def":1.3}',  '{sword}', '[{"id":"shield_wall","level":1,"mp":8}]'),
  ('ranger_trapper',    'Trapper',   2, 'ranger',  10, '{"spd":1.3}',           '{dagger}','[{"id":"snare","level":1,"mp":6}]'),
  ('mage_corebinder',   'Corebinder',2, 'mage',    10, '{"mp":1.8}',            '{staff}', '[{"id":"core_drain","level":1,"mp":12}]'),
  ('builder_engineer',  'Engineer',  2, 'builder', 10, '{"def":1.2}',           '{hammer}','[{"id":"deploy_turret","level":1,"mp":10}]');

insert into hero_templates (id, name, race_id, faction_id, default_job_id, backstory, is_starter) values
  ('kael',  'Kael',  'human',  'order_of_dawn', 'warrior', 'A young squire who believes every word the Order says.', true),
  ('lyra',  'Lyra',  'sylvan', 'sylvan_circle', 'ranger',  'A scout who hears the forest crying at night.', true),
  ('brann', 'Brann', 'dwarf',  'order_of_dawn', 'builder', 'Built the town walls. Never asked what they keep out.', true),
  ('vesh',  'Vesh',  'ashborn','ashen_remnant', 'mage',    'Remembers a village that no map shows anymore.', false),
  ('mira',  'Mira',  'human',  'sylvan_circle', 'mage',    'A healer who stopped trusting the Core''s light.', false);

-- levels: one entry per level (max_level entries).
insert into building_types (id, name, category, max_level, footprint_w, footprint_h, required_town_level, levels) values
  ('town_hall', 'Town Hall', 'utility', 3, 3, 3, 1, '[
     {"cost":{"gold":0},"build_seconds":0,"hp":1000},
     {"cost":{"gold":500,"wood":300,"stone":200},"build_seconds":600,"hp":1500},
     {"cost":{"gold":1500,"wood":800,"stone":600},"build_seconds":3600,"hp":2200}]'),
  ('wooden_wall', 'Wooden Wall', 'wall', 3, 1, 1, 1, '[
     {"cost":{"wood":10},"build_seconds":5,"hp":150},
     {"cost":{"wood":25,"stone":10},"build_seconds":30,"hp":300},
     {"cost":{"stone":60},"build_seconds":120,"hp":600}]'),
  ('arrow_tower', 'Arrow Tower', 'tower', 3, 1, 1, 1, '[
     {"cost":{"gold":50,"wood":40},"build_seconds":30,"hp":200,"attack":{"dmg":8,"range":4,"rate":1.0}},
     {"cost":{"gold":120,"wood":80},"build_seconds":180,"hp":300,"attack":{"dmg":14,"range":5,"rate":1.2}},
     {"cost":{"gold":300,"stone":150},"build_seconds":900,"hp":450,"attack":{"dmg":22,"range":5,"rate":1.5}}]'),
  ('lumber_mill', 'Lumber Mill', 'generator', 3, 2, 2, 1, '[
     {"cost":{"gold":40},"build_seconds":20,"hp":200,"produces":{"wood":60},"per_seconds":3600,"storage_cap":300},
     {"cost":{"gold":120,"wood":50},"build_seconds":300,"hp":300,"produces":{"wood":120},"per_seconds":3600,"storage_cap":700},
     {"cost":{"gold":300,"stone":100},"build_seconds":1200,"hp":400,"produces":{"wood":220},"per_seconds":3600,"storage_cap":1500}]'),
  ('spike_trap', 'Spike Trap', 'trap', 2, 1, 1, 1, '[
     {"cost":{"wood":20,"stone":10},"build_seconds":10,"hp":50,"attack":{"dmg":20,"range":0,"rate":0.5}},
     {"cost":{"stone":40},"build_seconds":120,"hp":80,"attack":{"dmg":35,"range":0,"rate":0.5}}]');

insert into quests (id, type, chapter, sort_order, title, description, prerequisites, objectives, rewards, recruit_hero_id, repeat_interval) values
  ('main_01_defend', 'main', 1, 1, 'The First Wall',
   'The Order asks you to fortify the town before the slimes arrive.', '{}',
   '[{"type":"build","target":"wooden_wall","count":5}]', '{"gold":100,"exp":50}', null, null),
  ('main_02_core', 'main', 1, 2, 'Light of the Core',
   'Visit the Ancient Core beneath the mountain.', '{main_01_defend}',
   '[{"type":"reach","target":"core_chamber"}]', '{"gold":150,"exp":80,"story_flags":["saw_the_core"]}', null, null),
  ('recruit_vesh', 'recruitment', 1, 10, 'The Ash Stranger',
   'A hooded figure watches your walls from the ridge.', '{main_02_core}',
   '[{"type":"talk","target":"vesh"},{"type":"kill","target":"ash_wolf","count":5}]',
   '{"exp":60,"story_flags":["monsters_were_human"]}', 'vesh', null),
  ('guild_wolves', 'guild', 1, 20, 'Wolf Bounty',
   'The guild pays for wolf pelts.', '{}',
   '[{"type":"kill","target":"wolf","count":8}]', '{"gold":80}', null, null),
  ('wave_nightly', 'wave_defense', 1, 30, 'Nightfall Raid',
   'Slimes surface from the ground every night.', '{}',
   '[{"type":"survive_wave","count":1}]', '{"gold":60,"stone":30}', null, interval '12 hours');
