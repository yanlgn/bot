import * as ready from './ready.js';
import * as interactionCreate from './interactionCreate.js';
import * as messageCreate from './messageCreate.js';
import * as guildMemberAdd from './guildMemberAdd.js';
import * as guildMemberUpdate from './guildMemberUpdate.js';

export const events = [
  ready,
  interactionCreate,
  messageCreate,
  guildMemberAdd,
  guildMemberUpdate
];
