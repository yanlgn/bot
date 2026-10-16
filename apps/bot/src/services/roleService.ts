import {
  Guild,
  Role,
  PermissionFlagsBits,
  PermissionsBitField,
  GuildMember
} from 'discord.js';
import {
  DiscordRoleData,
  CreateRoleInput,
  UpdateRoleInput,
  hexToDecimalColor,
  decimalToHexColor
} from '@sciclub/shared';
import { AuditLogService } from './auditLogService.js';
import { ConfigService } from './configService.js';

export class RoleService {
  /**
   * Retourne tous les rôles d'un serveur avec des métadonnées de sécurité et d'édition
   */
  static async getRoles(guild: Guild): Promise<DiscordRoleData[]> {
    const roles = await guild.roles.fetch();
    const botMember = await guild.members.fetchMe();
    const botHighestRole = botMember.roles.highest;

    const list: DiscordRoleData[] = [];

    for (const [, role] of roles) {
      const isEveryone = role.id === guild.id;
      const isBotHigher = botHighestRole.comparePositionTo(role) > 0;
      const isEditable = !isEveryone && !role.managed && isBotHigher;

      const permsArray: string[] = role.permissions.toArray();

      list.push({
        id: role.id,
        name: role.name,
        color: role.color,
        hexColor: decimalToHexColor(role.color),
        position: role.position,
        hoist: role.hoist,
        managed: role.managed,
        mentionable: role.mentionable,
        permissions: permsArray,
        memberCount: role.members.size,
        isBotHighest: role.id === botHighestRole.id,
        isEditable
      });
    }

    // Trie par position décroissante (plus haute autorité en premier)
    return list.sort((a, b) => b.position - a.position);
  }

  /**
   * Crée un nouveau rôle
   */
  static async createRole(
    guild: Guild,
    input: CreateRoleInput,
    operator: { id: string; username: string; member: GuildMember }
  ): Promise<Role> {
    const botMember = await guild.members.fetchMe();
    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      throw new Error('Le bot ne possède pas la permission "Gérer les rôles" (ManageRoles).');
    }

    // Vérification anti-escalade : l'opérateur ne peut pas donner Administrator s'il ne l'est pas
    if (input.permissions.includes('Administrator') && !operator.member.permissions.has(PermissionFlagsBits.Administrator)) {
      throw new Error('Vous ne pouvez pas créer un rôle avec la permission Administrateur sans l\'avoir vous-même.');
    }

    const permissionsBitfield = new PermissionsBitField();
    for (const permName of input.permissions) {
      if (permName in PermissionFlagsBits) {
        permissionsBitfield.add(PermissionFlagsBits[permName as keyof typeof PermissionFlagsBits]);
      }
    }

    const createdRole = await guild.roles.create({
      name: input.name,
      color: hexToDecimalColor(input.color),
      hoist: input.hoist,
      mentionable: input.mentionable,
      permissions: permissionsBitfield,
      reason: `Créé par ${operator.username} depuis SciClub Manager`
    });

    AuditLogService.record({
      guildId: guild.id,
      userId: operator.id,
      username: operator.username,
      action: 'ROLE_CREATED',
      targetType: 'role',
      targetId: createdRole.id,
      details: `Rôle "${createdRole.name}" créé avec la couleur ${input.color}`
    });

    return createdRole;
  }

  /**
   * Modifie un rôle existant
   */
  static async updateRole(
    guild: Guild,
    roleId: string,
    input: UpdateRoleInput,
    operator: { id: string; username: string; member: GuildMember }
  ): Promise<Role> {
    if (roleId === guild.id) {
      throw new Error('Impossible de modifier directement le rôle @everyone via cette interface.');
    }

    const role = await guild.roles.fetch(roleId);
    if (!role) {
      throw new Error(`Rôle introuvable (ID: ${roleId}).`);
    }

    const botMember = await guild.members.fetchMe();
    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      throw new Error('Le bot ne possède pas la permission "Gérer les rôles".');
    }

    // Hiérarchie bot
    if (botMember.roles.highest.comparePositionTo(role) <= 0) {
      throw new Error('Ce rôle est situé plus haut ou au même niveau que le rôle le plus élevé du bot.');
    }

    // Hiérarchie opérateur (sauf si propriétaire du serveur)
    if (guild.ownerId !== operator.id && operator.member.roles.highest.comparePositionTo(role) <= 0) {
      throw new Error('Vous ne pouvez pas modifier un rôle supérieur ou égal à votre propre rôle le plus élevé.');
    }

    // Vérifie si le rôle est protégé dans la config
    const config = ConfigService.getGuildConfig(guild.id);
    if (config?.roles) {
      for (const [, roleDef] of Object.entries(config.roles)) {
        if (roleDef.name.toLowerCase() === role.name.toLowerCase() && roleDef.protected) {
          if (!operator.member.permissions.has(PermissionFlagsBits.Administrator)) {
            throw new Error(`Le rôle "${role.name}" est protégé par la configuration du club.`);
          }
        }
      }
    }

    // Calcul des permissions si fournies
    let permissionsBitfield: PermissionsBitField | undefined = undefined;
    if (input.permissions) {
      if (input.permissions.includes('Administrator') && !operator.member.permissions.has(PermissionFlagsBits.Administrator)) {
        throw new Error('Vous ne pouvez pas attribuer la permission Administrateur sans l\'avoir vous-même.');
      }
      permissionsBitfield = new PermissionsBitField();
      for (const permName of input.permissions) {
        if (permName in PermissionFlagsBits) {
          permissionsBitfield.add(PermissionFlagsBits[permName as keyof typeof PermissionFlagsBits]);
        }
      }
    }

    const updatedRole = await role.edit({
      name: input.name ?? role.name,
      color: input.color ? hexToDecimalColor(input.color) : role.color,
      hoist: input.hoist ?? role.hoist,
      mentionable: input.mentionable ?? role.mentionable,
      permissions: permissionsBitfield ?? role.permissions,
      reason: `Modifié par ${operator.username} depuis SciClub Manager`
    });

    AuditLogService.record({
      guildId: guild.id,
      userId: operator.id,
      username: operator.username,
      action: 'ROLE_UPDATED',
      targetType: 'role',
      targetId: updatedRole.id,
      details: `Rôle "${updatedRole.name}" mis à jour`
    });

    return updatedRole;
  }

  /**
   * Supprime un rôle
   */
  static async deleteRole(
    guild: Guild,
    roleId: string,
    operator: { id: string; username: string; member: GuildMember }
  ): Promise<void> {
    if (roleId === guild.id) {
      throw new Error('Le rôle @everyone ne peut pas être supprimé.');
    }

    const role = await guild.roles.fetch(roleId);
    if (!role) {
      throw new Error(`Rôle introuvable (ID: ${roleId}).`);
    }

    const botMember = await guild.members.fetchMe();
    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      throw new Error('Le bot ne possède pas la permission "Gérer les rôles".');
    }

    if (botMember.roles.highest.comparePositionTo(role) <= 0) {
      throw new Error('Le bot ne peut pas supprimer un rôle positionné au-dessus de lui.');
    }

    if (guild.ownerId !== operator.id && operator.member.roles.highest.comparePositionTo(role) <= 0) {
      throw new Error('Vous ne pouvez pas supprimer un rôle positionné au-dessus de votre rôle le plus élevé.');
    }

    const roleName = role.name;
    await role.delete(`Supprimé par ${operator.username} depuis SciClub Manager`);

    AuditLogService.record({
      guildId: guild.id,
      userId: operator.id,
      username: operator.username,
      action: 'ROLE_DELETED',
      targetType: 'role',
      targetId: roleId,
      details: `Rôle "${roleName}" (${roleId}) supprimé`
    });
  }

  /**
   * Assigne ou retire un rôle à un membre
   */
  static async toggleRoleMember(
    guild: Guild,
    memberId: string,
    roleId: string,
    action: 'add' | 'remove',
    operator: { id: string; username: string; member: GuildMember }
  ): Promise<void> {
    const member = await guild.members.fetch(memberId);
    if (!member) throw new Error('Membre introuvable.');

    const role = await guild.roles.fetch(roleId);
    if (!role) throw new Error('Rôle introuvable.');

    const botMember = await guild.members.fetchMe();
    if (botMember.roles.highest.comparePositionTo(role) <= 0) {
      throw new Error('Le rôle ciblé est supérieur ou égal au rôle le plus élevé du bot.');
    }

    if (guild.ownerId !== operator.id && operator.member.roles.highest.comparePositionTo(role) <= 0) {
      throw new Error('Vous ne pouvez pas attribuer ou retirer un rôle supérieur ou égal au vôtre.');
    }

    if (action === 'add') {
      await member.roles.add(role, `Attribué par ${operator.username}`);
    } else {
      await member.roles.remove(role, `Retiré par ${operator.username}`);
    }

    AuditLogService.record({
      guildId: guild.id,
      userId: operator.id,
      username: operator.username,
      action: action === 'add' ? 'ROLE_ASSIGNED' : 'ROLE_REMOVED',
      targetType: 'member',
      targetId: memberId,
      details: `${action === 'add' ? 'Attribution' : 'Retrait'} du rôle "${role.name}" pour ${member.user.tag}`
    });
  }
}
