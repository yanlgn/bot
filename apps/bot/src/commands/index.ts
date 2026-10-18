import * as help from './general/help.js';
import * as profil from './general/profil.js';
import * as classement from './general/classement.js';

import * as projet from './club/projet.js';
import * as evenement from './club/evenement.js';
import * as ressource from './club/ressource.js';
import * as candidature from './club/candidature.js';
import * as sondage from './club/sondage.js';
import * as departement from './club/departement.js';

import * as config from './admin/config.js';
import * as role from './admin/role.js';
import * as canal from './admin/canal.js';
import * as permission from './admin/permission.js';
import * as sync from './admin/sync.js';
import * as backup from './admin/backup.js';

export const commands = [
  help,
  profil,
  classement,
  projet,
  evenement,
  ressource,
  candidature,
  sondage,
  departement,
  config,
  role,
  canal,
  permission,
  sync,
  backup
];

export const commandMap = new Map(commands.map(cmd => [cmd.data.name, cmd]));
