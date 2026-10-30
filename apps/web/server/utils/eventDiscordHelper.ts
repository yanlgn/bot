import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  TextChannel
} from 'discord.js';
import { db } from '../db.js';
import { discordClient } from '../botClient.js';

export async function buildEventMessagePayload(guildId: string, eventId: string) {
  const event = (await db.prepare('SELECT * FROM events WHERE id = ? AND guild_id = ?').get(eventId, guildId)) as any;
  if (!event) return null;

  const sessions = (await db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id = s.event_id AND ep.session_id = s.id AND ep.status = 'registered') as participant_count
    FROM event_sessions s
    WHERE s.event_id = ?
    ORDER BY s.scheduled_start_time ASC, s.created_at ASC
  `).all(eventId)) as any[];

  const totalRegisteredRow = (await db.prepare(`
    SELECT COUNT(*) as count FROM event_participants WHERE event_id = ? AND status = 'registered'
  `).get(eventId)) as any;
  const totalRegistered = totalRegisteredRow ? Number(totalRegisteredRow.count) : 0;

  const isRecurring = Boolean(event.is_recurring);
  const allowCancellation = event.allow_cancellation !== false && event.allow_cancellation !== 0;
  const maxTotal = event.max_participants ? Number(event.max_participants) : 0;
  const isGlobalFull = maxTotal > 0 && totalRegistered >= maxTotal;

  const embed = new EmbedBuilder()
    .setTitle(`🔬 ${event.title}`)
    .setDescription(event.description || 'Aucune description fournie.')
    .setColor(0xE5092E)
    .addFields(
      { name: '📍 Lieu', value: event.location || 'Discord / Non précisé', inline: true },
      { name: '🏷️ Type', value: event.type ? event.type.toUpperCase() : 'ÉVÉNEMENT', inline: true },
      {
        name: isRecurring ? '🔄 Périodicité' : '⏰ Date & Heure',
        value: isRecurring && event.recurrence_pattern
          ? `**${event.recurrence_pattern}**\n*(Prochaine : <t:${Math.floor(new Date(event.scheduled_start_time).getTime() / 1000)}:F>)*`
          : `<t:${Math.floor(new Date(event.scheduled_start_time).getTime() / 1000)}:F>`,
        inline: true
      }
    );

  if (event.speaker) {
    embed.addFields({ name: '🎙️ Intervenant(s)', value: event.speaker, inline: true });
  }

  if (event.target_audience) {
    embed.addFields({ name: '🎯 Public visé', value: event.target_audience, inline: true });
  }

  if (sessions.length > 0) {
    const sessionsList = sessions.map((s, idx) => {
      const maxS = s.max_participants ? Number(s.max_participants) : 0;
      const countS = Number(s.participant_count) || 0;
      const isFull = maxS > 0 && countS >= maxS;
      const remaining = maxS > 0 ? Math.max(0, maxS - countS) : null;

      let statusBadge = '🟢 Places disponibles';
      if (isFull) {
        statusBadge = '🔴 COMPLET';
      } else if (remaining !== null) {
        statusBadge = `🟡 ${remaining} place(s) restante(s)`;
      }

      let timeInfo = '';
      if (s.day_of_week && s.start_time) {
        timeInfo = ` • 🗓️ **Tous les ${s.day_of_week}s à ${s.start_time}${s.end_time ? ` - ${s.end_time}` : ''}**`;
      } else if (s.scheduled_start_time) {
        const sTs = Math.floor(new Date(s.scheduled_start_time).getTime() / 1000);
        timeInfo = ` • <t:${sTs}:t>`;
      }

      return `**${idx + 1}. ${s.name}**${timeInfo}\n` +
        `└ Quota : **${countS}${maxS > 0 ? ` / ${maxS}` : ' (illimité)'}** inscrits • ${statusBadge}`;
    }).join('\n\n');

    embed.addFields({
      name: '📋 Sessions Disponibles',
      value: sessionsList,
      inline: false
    });
  } else {
    let quotaText = '*Places illimitées*';
    if (maxTotal > 0) {
      const remaining = Math.max(0, maxTotal - totalRegistered);
      quotaText = `**${totalRegistered} / ${maxTotal}** réservées (${remaining > 0 ? `${remaining} restante(s)` : '🔴 COMPLET'})`;
    } else {
      quotaText = `**${totalRegistered}** participant(s) inscrit(s)`;
    }

    embed.addFields({
      name: '🎟️ Places & Jauge',
      value: quotaText,
      inline: true
    });
  }

  embed.addFields({
    name: '⚙️ Modalités d\'inscription',
    value: allowCancellation
      ? '✅ Les réservations peuvent être annulées en cas d\'imprévu pour libérer la place.'
      : '⚠️ Les réservations sont fermes et définitives (places fixes non libérables).',
    inline: false
  });

  embed.setFooter({ text: 'CORTEX Scientific Club • Remplissez le formulaire (Nom, Prénom, Email) pour valider votre place' });
  embed.setTimestamp();

  const components: ActionRowBuilder<any>[] = [];

  if (sessions.length > 1) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`cortex_ev_sess_select:${event.id}`)
      .setPlaceholder('🎯 Sélectionnez votre session pour réserver...')
      .addOptions(
        sessions.slice(0, 25).map(s => {
          const maxS = s.max_participants ? Number(s.max_participants) : 0;
          const countS = Number(s.participant_count) || 0;
          const isFull = maxS > 0 && countS >= maxS;
          const remaining = maxS > 0 ? Math.max(0, maxS - countS) : null;
          const scheduleDesc = s.day_of_week && s.start_time
            ? `${s.day_of_week} ${s.start_time} • `
            : '';
          const quotaDesc = isFull
            ? 'Session complète'
            : (remaining !== null ? `${remaining} place(s) disponible(s)` : 'Places illimitées');

          return {
            label: `${isFull ? '⛔ ' : ''}${s.name}`.slice(0, 100),
            value: s.id,
            description: `${scheduleDesc}${quotaDesc}`.slice(0, 100),
            emoji: isFull ? '🔴' : '🎟️'
          };
        })
      );

    components.push(new ActionRowBuilder().addComponents(selectMenu));
  }

  const buttonRow = new ActionRowBuilder<ButtonBuilder>();

  if (sessions.length > 0 && sessions.length <= 5) {
    for (const s of sessions) {
      const maxS = s.max_participants ? Number(s.max_participants) : 0;
      const countS = Number(s.participant_count) || 0;
      const isFull = maxS > 0 && countS >= maxS;
      const scheduleShort = s.day_of_week && s.start_time
        ? ` (${s.day_of_week.slice(0, 3)}. ${s.start_time})`
        : '';

      buttonRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`cortex_ev_join:${event.id}:${s.id}`)
          .setLabel(`Réserver : ${s.name}${scheduleShort}`.slice(0, 80))
          .setEmoji(isFull ? '🔴' : '🎟️')
          .setStyle(isFull ? ButtonStyle.Secondary : ButtonStyle.Primary)
          .setDisabled(isFull)
      );
    }
  } else if (sessions.length === 0) {
    buttonRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`cortex_ev_join:${event.id}:main`)
        .setLabel('Réserver ma place')
        .setEmoji(isGlobalFull ? '🔴' : '🎟️')
        .setStyle(isGlobalFull ? ButtonStyle.Secondary : ButtonStyle.Success)
        .setDisabled(isGlobalFull)
    );
  }

  if (allowCancellation) {
    buttonRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`cortex_ev_leave:${event.id}`)
        .setLabel('Annuler ma réservation')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger)
    );
  }

  if (buttonRow.components.length > 0) {
    components.push(buttonRow);
  }

  return { embed, components };
}

export async function syncEventDiscordMessage(guildId: string, eventId: string) {
  try {
    const event = (await db.prepare('SELECT * FROM events WHERE id = ? AND guild_id = ?').get(eventId, guildId)) as any;
    if (!event || !event.channel_id || !event.discord_message_id) return;

    const guild = discordClient.guilds.cache.get(guildId) || await discordClient.guilds.fetch(guildId).catch(() => null);
    if (!guild) return;

    const channel = await guild.channels.fetch(event.channel_id).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const msg = await (channel as TextChannel).messages.fetch(event.discord_message_id).catch(() => null);
    if (!msg) return;

    const payload = await buildEventMessagePayload(guildId, eventId);
    if (!payload) return;

    await msg.edit({
      embeds: [payload.embed],
      components: payload.components
    });
  } catch (err) {
    console.error('Erreur lors de la mise à jour du message Discord de l\'événement:', err);
  }
}
