import Phaser from 'phaser';

/**
 * Global event bus between scenes and systems.
 * Events:
 *   'player-stats'   (stats: PlayerStats)        HP / MP / EXP / level changed
 *   'quest-updated'  ()                           quest log changed
 *   'npc-nearby'     (npcName: string | null)     a talkable NPC is in range
 *   'dialogue-open'  (lines: DialogueLine[])      show dialogue box
 *   'dialogue-closed'()
 *   'toast'          (msg: string)
 *   'inventory-changed' ()                        item counts changed
 */
export const bus = new Phaser.Events.EventEmitter();
