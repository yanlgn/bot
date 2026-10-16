import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { EventService } from '../../services/eventService.js';

export const data = new SlashCommandBuilder()
  .setName('evenement')
  .setDescription('Gestion des conférences, ateliers et concours scientifiques')
  .addSubcommand(sub =>
    sub.setName('creer')
      .setDescription('Créer un nouvel événement scientifique')
      .addStringOption(opt => opt.setName('titre').setDescription('Titre de l\'événement').setRequired(true))
      .addStringOption(opt =>
        opt.setName('type')
          .setDescription('Type d\'événement')
          .setRequired(true)
          .addChoices(
            { name: 'Conférence', value: 'conference' },
            { name: 'Atelier / Workshop', value: 'workshop' },
            { name: 'Compétition / Hackathon', value: 'competition' },
            { name: 'Sortie scientifique', value: 'field_trip' },
            { name: 'Séance de formation', value: 'training' }
          )
      )
      .addStringOption(opt => opt.setName('description').setDescription('Détails de l\'événement').setRequired(true))
      .addStringOption(opt => opt.setName('date').setDescription('Date et heure (AAAA-MM-JJ HH:mm)').setRequired(true))
      .addStringOption(opt => opt.setName('lieu').setDescription('Lieu physique ou lien Discord/Visio').setRequired(true))
      .addIntegerOption(opt => opt.setName('places').setDescription('Nombre max de places').setRequired(false))
      .addStringOption(opt => opt.setName('intervenant').setDescription('Nom de l\'intervenant').setRequired(false))
  )
  .addSubcommand(sub =>
    sub.setName('liste')
      .setDescription('Consulter la liste des prochains événements du club')
  )
  .addSubcommand(sub =>
    sub.setName('inscrire')
      .setDescription('S\'inscrire à un événement scientifique')
      .addStringOption(opt => opt.setName('id').setDescription('ID de l\'événement').setRequired(true))
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'creer') {
    // Vérifier les permissions staff
    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (!member.permissions.has(PermissionFlagsBits.ManageEvents) && !member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: '❌ Vous n\'avez pas la permission de créer des événements.', ephemeral: true });
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

    const isoDate = new Date(dateStr.replace(' ', 'T')).toISOString();

    try {
      const event = await EventService.createEvent(
        interaction.guild,
        {
          title,
          type,
          description,
          scheduledStartTime: isoDate,
          location,
          maxParticipants: places,
          speaker,
          createParticipantRole: true
        },
        { id: interaction.user.id, username: interaction.user.username }
      );

      const embed = new EmbedBuilder()
        .setTitle(`📅 Événement Programmé : ${event.title}`)
        .setDescription(event.description)
        .setColor(0x3B82F6)
        .addFields(
          { name: 'Type', value: event.type.toUpperCase(), inline: true },
          { name: 'Lieu', value: event.location, inline: true },
          { name: 'Date', value: new Date(event.scheduledStartTime).toLocaleString('fr-FR'), inline: true },
          { name: 'Intervenant', value: event.speaker || 'Non spécifié', inline: true },
          { name: 'Capacité', value: event.maxParticipants ? `${event.maxParticipants} participants` : 'Illimité', inline: true }
        )
        .setFooter({ text: `ID Événement : ${event.id} • Inscrivez-vous avec /evenement inscrire id:${event.id}` });

      await interaction.editReply({ embeds: [embed] });
    } catch (err: any) {
      await interaction.editReply({ content: `❌ Erreur : ${err.message}` });
    }
  } else if (subcommand === 'liste') {
    const events = EventService.getEvents(interaction.guild.id);

    if (events.length === 0) {
      await interaction.reply({ content: 'Aucun événement à venir n\'est planifié pour le moment.', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('📅 Événements & Ateliers du SciClub')
      .setColor(0x8B5CF6)
      .setDescription('Inscrivez-vous pour obtenir votre rôle et gagner des points !');

    for (const e of events.slice(0, 10)) {
      embed.addFields({
        name: `🔬 ${e.title} (${e.type})`,
        value: `📍 **Lieu :** ${e.location}\n⏰ **Date :** ${new Date(e.scheduledStartTime).toLocaleString('fr-FR')}\n👥 **Inscrits :** ${e.participantCount || 0} / ${e.maxParticipants || '∞'}\n*S'inscrire :* \`/evenement inscrire id:${e.id}\``
      });
    }

    await interaction.reply({ embeds: [embed] });
  } else if (subcommand === 'inscrire') {
    const eventId = interaction.options.getString('id', true);

    try {
      const res = await EventService.registerParticipant(interaction.guild, eventId, interaction.user.id);
      await interaction.reply({ content: `🎉 ${res.message}`, ephemeral: true });
    } catch (err: any) {
      await interaction.reply({ content: `❌ Erreur : ${err.message}`, ephemeral: true });
    }
  }
}
