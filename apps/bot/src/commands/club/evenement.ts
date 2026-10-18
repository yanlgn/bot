import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { EventService } from '../../services/eventService.js';

export const data = new SlashCommandBuilder()
  .setName('evenement')
  .setDescription('Gestion des conférences, ateliers et concours scientifiques CORTEX')
  .addSubcommand(sub =>
    sub.setName('creer')
      .setDescription('Planifier un nouvel événement scientifique (Staff)')
      .addStringOption(opt => opt.setName('titre').setDescription('Titre de l\'événement').setRequired(true))
      .addStringOption(opt =>
        opt.setName('type')
          .setDescription('Catégorie d\'événement')
          .setRequired(true)
          .addChoices(
            { name: '🎙️ Conférence', value: 'conference' },
            { name: '🛠️ Atelier / Workshop', value: 'workshop' },
            { name: '🏆 Hackathon / Compétition', value: 'competition' },
            { name: '🪐 Sortie scientifique / Visite', value: 'field_trip' },
            { name: '📖 Séance de formation / Masterclass', value: 'training' }
          )
      )
      .addStringOption(opt => opt.setName('description').setDescription('Détails et programme').setRequired(true))
      .addStringOption(opt => opt.setName('date').setDescription('Date et heure (format AAAA-MM-JJ HH:mm, ex: 2026-11-05 18:00)').setRequired(true))
      .addStringOption(opt => opt.setName('lieu').setDescription('Lieu physique ou salon vocal / lien Visio').setRequired(true))
      .addIntegerOption(opt => opt.setName('places').setDescription('Nombre limite de places').setRequired(false))
      .addStringOption(opt => opt.setName('intervenant').setDescription('Nom de l\'intervenant ou conférencier').setRequired(false))
  )
  .addSubcommand(sub =>
    sub.setName('liste')
      .setDescription('Consulter la liste des prochains événements CORTEX')
  )
  .addSubcommand(sub =>
    sub.setName('inscrire')
      .setDescription('Réserver sa place pour un atelier ou événement')
      .addStringOption(opt => opt.setName('id').setDescription('Identifiant de l\'événement').setRequired(true))
  );

const TYPE_ICONS: Record<string, string> = {
  conference: '🎙️ Conférence',
  workshop: '🛠️ Workshop / Atelier',
  competition: '🏆 Hackathon & Compétition',
  field_trip: '🪐 Sortie Scientifique',
  training: '📖 Formation & Masterclass'
};

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'creer') {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (!member.permissions.has(PermissionFlagsBits.ManageEvents) && !member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: '⛔ Vous devez disposer de la permission de gestion des événements pour planifier un atelier.', ephemeral: true });
      return;
    }

    await interaction.deferReply();
    const title = interaction.options.getString('titre', true);
    const type = interaction.options.getString('type', true) as any;
    const description = interaction.options.getString('description', true);
    const dateStr = interaction.options.getString('date', true);
    const location = interaction.options.getString('lieu', true);
    const places = interaction.options.getInteger('places');
    const speaker = interaction.options.getString('intervenant');

    const parsedDate = new Date(dateStr.replace(' ', 'T'));
    if (isNaN(parsedDate.getTime())) {
      await interaction.editReply({ content: '❌ Format de date invalide. Utilisez le format `AAAA-MM-JJ HH:mm` (ex: 2026-11-10 14:30).' });
      return;
    }

    try {
      const event = await EventService.createEvent(
        interaction.guild,
        {
          title,
          type,
          description,
          scheduledStartTime: parsedDate.toISOString(),
          location,
          maxParticipants: places,
          speaker,
          createParticipantRole: true
        },
        { id: interaction.user.id, username: interaction.user.username }
      );

      const timestampSeconds = Math.floor(parsedDate.getTime() / 1000);

      const embed = new EmbedBuilder()
        .setTitle(`📅 Événement Planifié : ${event.title}`)
        .setDescription(event.description)
        .setColor(0xE5092E)
        .addFields(
          { name: '🏷️ Type', value: TYPE_ICONS[event.type] || event.type, inline: true },
          { name: '📍 Lieu', value: event.location, inline: true },
          { name: '🎤 Intervenant', value: event.speaker || '*Non spécifié*', inline: true },
          { name: '⏰ Date & Heure', value: `<t:${timestampSeconds}:F> (<t:${timestampSeconds}:R>)`, inline: false },
          { name: '🎟️ Places disponibles', value: event.maxParticipants ? `**${event.maxParticipants}** places` : '*Illimité*', inline: true }
        )
        .setFooter({ text: `ID Événement : ${event.id} • Pour vous inscrire : /evenement inscrire id:${event.id}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err: any) {
      await interaction.editReply({ content: `❌ Erreur lors de la création : ${err.message}` });
    }
  } else if (subcommand === 'liste') {
    const events = await EventService.getEvents(interaction.guild.id);

    if (events.length === 0) {
      await interaction.reply({ content: 'ℹ️ Aucun événement n\'est actuellement programmé. Consultez le salon d\'annonces pour les prochaines dates !', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('📅 CORTEX Scientific Club — Agenda des Événements')
      .setColor(0xE5092E)
      .setDescription('Voici les prochaines conférences, workshops et hackathons programmés :\n');

    for (const ev of events.slice(0, 8)) {
      const ts = Math.floor(new Date(ev.scheduledStartTime).getTime() / 1000);
      const icon = TYPE_ICONS[ev.type] || '📅 Événement';
      embed.addFields({
        name: `${icon} : ${ev.title}`,
        value:
          `⏰ <t:${ts}:F> (<t:${ts}:R>)\n` +
          `📍 **Lieu :** ${ev.location} • 👥 **Inscrits :** ${(ev as any).participantCount ?? 0}${ev.maxParticipants ? ` / ${ev.maxParticipants}` : ''}\n` +
          `👉 *S'inscrire :* \`/evenement inscrire id:${ev.id}\``,
        inline: false
      });
    }

    embed.setFooter({ text: 'CORTEX Scientific Club • Participer aux ateliers rapporte des points CORTEX' });
    await interaction.reply({ embeds: [embed] });
  } else if (subcommand === 'inscrire') {
    const eventId = interaction.options.getString('id', true);

    try {
      await EventService.registerParticipant(interaction.guild, eventId, interaction.user.id);
      const events = await EventService.getEvents(interaction.guild.id);
      const ev = events.find(e => e.id === eventId);

      const embed = new EmbedBuilder()
        .setTitle('🎟️ Inscription Confirmée !')
        .setColor(0x10B981)
        .setDescription(`Votre place pour **${ev?.title || 'cet événement'}** a été validée avec succès !${ev?.participantRoleId ? ` Le rôle de participant vous a été attribué sur Discord.` : ''}`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error: any) {
      await interaction.reply({ content: `❌ Impossible de s'inscrire : ${error.message}`, ephemeral: true });
    }
  }
}
