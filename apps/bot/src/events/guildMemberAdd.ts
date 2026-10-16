import { Events, GuildMember, EmbedBuilder, TextChannel } from 'discord.js';
import { ConfigService } from '../services/configService.js';
import { logger } from '../utils/logger.js';

export const name = Events.GuildMemberAdd;
export const once = false;

export async function execute(member: GuildMember) {
  const config = ConfigService.getGuildConfig(member.guild.id);
  if (!config) return;

  // 1. Attribution automatique du rôle invité/guest s'il est configuré
  if (config.roles?.guest) {
    const guestRoleName = config.roles.guest.name;
    const role = member.guild.roles.cache.find(r => r.name.toLowerCase() === guestRoleName.toLowerCase());
    if (role) {
      await member.roles.add(role, 'Attribution automatique du rôle invité à l\'arrivée').catch(err => {
        logger.warn({ err }, 'Impossible d\'attribuer le rôle d\'arrivée');
      });
    }
  }

  // 2. Message de bienvenue dans le salon dédié
  if (config.channels?.welcome) {
    const welcomeChannelName = config.channels.welcome.name;
    const channel = member.guild.channels.cache.find(
      c => c.name === welcomeChannelName && c.isTextBased()
    ) as TextChannel | undefined;

    if (channel) {
      const embed = new EmbedBuilder()
        .setTitle(`🌟 Bienvenue au ${config.club.name} !`)
        .setDescription(`Bienvenue <@${member.id}> parmi nous ! Découvre les projets, conférences et ateliers scientifiques.`)
        .setColor(0x3B82F6)
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
          { name: '🚀 Présente-toi', value: 'Dis-nous ce qui t\'intéresse en sciences ou technologies !' },
          { name: '📜 Règlement & Rôles', value: 'Consulte les canaux d\'annonces et utilise `/help` pour explorer les commandes.' }
        )
        .setTimestamp();

      await channel.send({ content: `Bienvenue <@${member.id}> !`, embeds: [embed] }).catch(() => null);
    }
  }
}
