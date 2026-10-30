import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits
} from 'discord.js';
import { db } from '../../database/db.js';

export const data = new SlashCommandBuilder()
  .setName('liste')
  .setDescription('Consulter la liste confidentielle des inscrits à un événement (Réservé Staff)')
  .addStringOption(opt =>
    opt.setName('evenement')
      .setDescription('ID ou nom de l\'événement')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;

  const member = await interaction.guild.members.fetch(interaction.user.id);
  const isStaff = member.permissions.has(PermissionFlagsBits.ManageEvents) ||
                  member.permissions.has(PermissionFlagsBits.ManageGuild) ||
                  member.permissions.has(PermissionFlagsBits.Administrator) ||
                  member.permissions.has(PermissionFlagsBits.ManageRoles);

  if (!isStaff) {
    await interaction.reply({
      content: '⛔ Seul le staff et les responsables peuvent consulter la liste des participants.',
      ephemeral: true
    });
    return;
  }

  const query = interaction.options.getString('evenement')?.trim().toLowerCase();
  const guildId = interaction.guild.id;

  if (!query) {
    // Lister les événements actifs
    const events = (await db.prepare(`
      SELECT e.*,
        (SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id = e.id AND ep.status = 'registered') as participant_count
      FROM events e
      WHERE e.guild_id = ? AND e.status != 'cancelled'
      ORDER BY e.scheduled_start_time DESC
      LIMIT 10
    `).all(guildId)) as any[];

    if (events.length === 0) {
      await interaction.reply({
        content: 'ℹ️ Aucun événement actif n\'est enregistré sur ce serveur.',
        ephemeral: true
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('📋 Événements CORTEX — Choisissez un événement')
      .setColor(0xE5092E)
      .setDescription(
        'Pour voir les participants avec leurs coordonnées (Nom, Prénom, Email), précisez le nom ou l\'identifiant avec `/liste evenement:<nom/id>` :\n\n' +
        events.map(ev => `• **${ev.title}** (ID: \`${ev.id}\`)\n  Inscrits : **${ev.participant_count}${ev.max_participants ? `/${ev.max_participants}` : ''}** • Date : <t:${Math.floor(new Date(ev.scheduled_start_time).getTime() / 1000)}:d>`).join('\n\n')
      )
      .setFooter({ text: 'Accès restreint aux responsables CORTEX' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  // Chercher l'événement correspondant
  const event = (await db.prepare(`
    SELECT * FROM events 
    WHERE guild_id = ? AND (id = ? OR LOWER(title) LIKE ?)
    LIMIT 1
  `).get(guildId, query, `%${query}%`)) as any;

  if (!event) {
    await interaction.reply({
      content: `❌ Aucun événement trouvé avec le terme "${query}". Tapez \`/liste\` pour voir les événements.`,
      ephemeral: true
    });
    return;
  }

  const sessions = (await db.prepare(`
    SELECT * FROM event_sessions WHERE event_id = ? ORDER BY scheduled_start_time ASC, created_at ASC
  `).all(event.id)) as any[];

  const participants = (await db.prepare(`
    SELECT ep.*, u.username
    FROM event_participants ep
    LEFT JOIN users u ON u.id = ep.user_id
    WHERE ep.event_id = ? AND ep.status = 'registered'
    ORDER BY ep.registered_at ASC
  `).all(event.id)) as any[];

  const embed = new EmbedBuilder()
    .setTitle(`📋 Liste Officielle des Inscrits — ${event.title}`)
    .setColor(0x10B981)
    .setDescription(
      `📍 **Lieu :** ${event.location} • ⏰ **Date :** <t:${Math.floor(new Date(event.scheduled_start_time).getTime() / 1000)}:F>\n` +
      `👥 **Total inscrits :** ${participants.length}${event.max_participants ? ` / ${event.max_participants}` : ''}\n` +
      `*(Document confidentiel à usage exclusif du staff)*`
    )
    .setFooter({ text: `ID Événement : ${event.id} • CORTEX Scientific Club` })
    .setTimestamp();

  if (participants.length === 0) {
    embed.addFields({
      name: 'Aucun inscrit',
      value: 'Personne n\'est encore inscrit à cet événement.'
    });
  } else if (sessions.length > 0) {
    // Regrouper par session
    for (const s of sessions) {
      const sessParts = participants.filter(p => p.session_id === s.id);
      const lines = sessParts.map((p, i) =>
        `**${i + 1}.** ${p.first_name || ''} ${p.last_name || ''} (<@${p.user_id}>) — 📧 \`${p.email || 'non renseigné'}\`${p.notes ? `\n   *Note : ${p.notes}*` : ''}`
      );

      embed.addFields({
        name: `📌 ${s.name} (${sessParts.length}${s.max_participants ? `/${s.max_participants}` : ''})`,
        value: lines.length > 0 ? lines.join('\n') : '*Aucun participant pour cette session*',
        inline: false
      });
    }

    // Participants non assignés à une session spécifique
    const noSessParts = participants.filter(p => !p.session_id);
    if (noSessParts.length > 0) {
      const lines = noSessParts.map((p, i) =>
        `**${i + 1}.** ${p.first_name || ''} ${p.last_name || ''} (<@${p.user_id}>) — 📧 \`${p.email || 'non renseigné'}\``
      );
      embed.addFields({
        name: `📌 Inscrits généraux (${noSessParts.length})`,
        value: lines.join('\n'),
        inline: false
      });
    }
  } else {
    // Liste simple
    const lines = participants.map((p, i) =>
      `**${i + 1}.** ${p.first_name || ''} ${p.last_name || ''} (<@${p.user_id}>) — 📧 \`${p.email || 'non renseigné'}\`${p.notes ? `\n   *Note : ${p.notes}*` : ''}`
    );

    // Diviser si beaucoup d'inscrits
    const chunk = lines.slice(0, 25).join('\n');
    embed.addFields({
      name: `Participants (${participants.length})`,
      value: chunk,
      inline: false
    });
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
