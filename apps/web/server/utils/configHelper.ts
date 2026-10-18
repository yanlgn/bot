import fs from 'fs';
import path from 'path';
import { GuildConfigFile, DepartmentConfigItem } from '@sciclub/shared';

export function getGuildConfigFilepath(guildId: string): string {
  const configDir = path.resolve(process.cwd(), process.env.CONFIG_PATH || './config/guilds');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  return path.join(configDir, `${guildId}.json`);
}

export function readGuildConfig(guildId: string): GuildConfigFile | null {
  const filepath = getGuildConfigFilepath(guildId);
  if (!fs.existsSync(filepath)) return null;
  try {
    const raw = fs.readFileSync(filepath, 'utf8');
    return JSON.parse(raw) as GuildConfigFile;
  } catch {
    return null;
  }
}

export function writeGuildConfig(guildId: string, config: GuildConfigFile): void {
  const filepath = getGuildConfigFilepath(guildId);
  fs.writeFileSync(filepath, JSON.stringify(config, null, 2), 'utf8');
}

/**
 * Ajoute ou met à jour un rôle dans le fichier de configuration JSON
 */
export function addRoleToConfig(guildId: string, roleKey: string, roleData: { name: string; color: string; permissions: string[] }): void {
  const config = readGuildConfig(guildId);
  if (!config) return;

  if (!config.roles) config.roles = {};
  config.roles[roleKey] = {
    name: roleData.name,
    color: roleData.color,
    permissions: roleData.permissions,
    protected: false
  };

  writeGuildConfig(guildId, config);
}

/**
 * Ajoute ou met à jour une catégorie dans le fichier de configuration JSON
 */
export function addCategoryToConfig(guildId: string, categoryKey: string, name: string): void {
  const config = readGuildConfig(guildId);
  if (!config) return;

  if (!config.categories) config.categories = [];
  const existingIdx = config.categories.findIndex(c => c.key === categoryKey);
  if (existingIdx >= 0) {
    config.categories[existingIdx].name = name;
  } else {
    config.categories.push({ key: categoryKey, name });
  }

  writeGuildConfig(guildId, config);
}

/**
 * Ajoute ou met à jour un salon dans le fichier de configuration JSON
 */
export function addChannelToConfig(guildId: string, channelKey: string, channelData: { name: string; type: 'text' | 'voice' | 'category' | 'forum'; categoryKey?: string | null; topic?: string }): void {
  const config = readGuildConfig(guildId);
  if (!config) return;

  if (!config.channels) config.channels = {};
  config.channels[channelKey] = {
    name: channelData.name,
    type: channelData.type,
    categoryKey: channelData.categoryKey,
    topic: channelData.topic
  };

  writeGuildConfig(guildId, config);
}

/**
 * Ajoute ou met à jour un département dans le fichier de configuration JSON
 */
export function addDepartmentToConfig(guildId: string, department: DepartmentConfigItem): void {
  const config = readGuildConfig(guildId);
  if (!config) return;

  if (!config.departments) config.departments = [];
  const existingIdx = config.departments.findIndex(d => d.id === department.id);
  if (existingIdx >= 0) {
    config.departments[existingIdx] = department;
  } else {
    config.departments.push(department);
  }

  writeGuildConfig(guildId, config);
}

/**
 * Supprime un département du fichier de configuration JSON
 */
export function removeDepartmentFromConfig(guildId: string, departmentId: string): void {
  const config = readGuildConfig(guildId);
  if (!config || !config.departments) return;

  config.departments = config.departments.filter(d => d.id !== departmentId);
  writeGuildConfig(guildId, config);
}
