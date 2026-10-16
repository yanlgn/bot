import { Guild, GuildMember, PermissionFlagsBits } from 'discord.js';
import { DiscordMemberData } from '@sciclub/shared';
import { db } from '../database/db.js';
import { AuditLogService } from './auditLogService.js';

export class MemberService {
  /**
   * Récupère la liste des membres avec points et avertissements associés
   */
  static async getMembers(guild: Guild, query?: string): Promise<DiscordMemberData[]> {
    const fetched = await guild.members.fetch({ limit: 100 });
    const members: DiscordMemberData[] = [];

    // Récupération des points et avertissements depuis SQLite
    const pointsStmt = db.prepare('SELECT user_id, balance FROM points WHERE guild_id = ?');
    const pointsRows = pointsStmt.all(guild.id) as { user_id: string; balance: number }[];
    const pointsMap = new Map(pointsRows.map(r => [r.user_id, r.balance]));

    const warnStmt = db.prepare('SELECT user_id, COUNT(*) as count FROM warnings WHERE guild_id = ? GROUP BY user_id');
    const warnRows = warnStmt.all(guild.id) as { user_id: string; count: number }[];
    const warnMap = new Map(warnRows.map(r => [r.user_id, r.count]));

    for (const [, member] of fetched) {
      if (query) {
        const q = query.toLowerCase();
        const matchUser = member.user.username.toLowerCase().includes(q);
        const matchNick = member.nickname ? member.nickname.toLowerCase().includes(q) : false;
        if (!matchUser && !matchNick) continue;
      }

      members.push({
        id: member.id,
        username: member.user.username,
        discriminator: member.user.discriminator,
        globalName: member.user.globalName,
        nickname: member.nickname,
        avatarUrl: member.user.displayAvatarURL(),
        roles: Array.from(member.roles.cache.keys()).filter(id => id !== guild.id),
        joinedAt: member.joinedAt ? member.joinedAt.toISOString() : null,
        isBot: member.user.bot,
        points: pointsMap.get(member.id) ?? 0,
        warningsCount: warnMap.get(member.id) ?? 0
      });
    }

    return members;
  }

  /**
   * Sanction : Timeout (exclusion temporaire)
   */
  static async timeoutMember(
    guild: Guild,
    memberId: string,
    durationMinutes: number,
    reason: string,
    operator: { id: string; username: string; member: GuildMember }
  ): Promise<void> {
    const member = await guild.members.fetch(memberId);
    if (!member) throw new Error('Membre introuvable.');

    const botMember = await guild.members.fetchMe();
    if (!botMember.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      throw new Error('Le bot n\'a pas la permission d\'exclure temporairement des membres.');
    }

    if (!member.moderatable) {
      throw new Error('Impossible d\'appliquer un timeout à ce membre (hiérarchie ou permissions supérieures).');
    }

    if (guild.ownerId !== operator.id && operator.member.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
      throw new Error('Vous ne pouvez pas modérer un membre ayant un rôle supérieur ou égal au vôtre.');
    }

    const ms = durationMinutes * 60 * 1000;
    await member.timeout(ms, `${reason} (par ${operator.username})`);

    AuditLogService.record({
      guildId: guild.id,
      userId: operator.id,
      username: operator.username,
      action: 'MEMBER_TIMEOUT',
      targetType: 'member',
      targetId: memberId,
      details: `Timeout de ${durationMinutes} minutes pour ${member.user.tag}. Raison : ${reason}`
    });
  }

  /**
   * Sanction : Expulsion (Kick)
   */
  static async kickMember(
    guild: Guild,
    memberId: string,
    reason: string,
    operator: { id: string; username: string; member: GuildMember }
  ): Promise<void> {
    const member = await guild.members.fetch(memberId);
    if (!member) throw new Error('Membre introuvable.');

    if (!member.kickable) {
      throw new Error('Le bot ne peut pas expulser ce membre (hiérarchie de rôles).');
    }

    if (guild.ownerId !== operator.id && operator.member.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
      throw new Error('Vous ne pouvez pas expulser un membre supérieur ou égal dans la hiérarchie.');
    }

    await member.kick(`${reason} (par ${operator.username})`);

    AuditLogService.record({
      guildId: guild.id,
      userId: operator.id,
      username: operator.username,
      action: 'MEMBER_KICKED',
      targetType: 'member',
      targetId: memberId,
      details: `Expulsion de ${member.user.tag}. Raison : ${reason}`
    });
  }

  /**
   * Sanction : Bannissement (Ban)
   */
  static async banMember(
    guild: Guild,
    memberId: string,
    reason: string,
    operator: { id: string; username: string; member: GuildMember }
  ): Promise<void> {
    const member = await guild.members.fetch(memberId).catch(() => null);

    if (member) {
      if (!member.bannable) {
        throw new Error('Le bot ne peut pas bannir ce membre (hiérarchie de rôles).');
      }

      if (guild.ownerId !== operator.id && operator.member.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
        throw new Error('Vous ne pouvez pas bannir un membre supérieur ou égal dans la hiérarchie.');
      }
    }

    await guild.members.ban(memberId, { reason: `${reason} (par ${operator.username})` });

    AuditLogService.record({
      guildId: guild.id,
      userId: operator.id,
      username: operator.username,
      action: 'MEMBER_BANNED',
      targetType: 'member',
      targetId: memberId,
      details: `Bannissement du membre ${memberId}. Raison : ${reason}`
    });
  }
}
