import { randomUUID } from 'crypto';
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { db } from '../../database/db.js';

export const data = new SlashCommandBuilder()
  .setName('candidature')
  .setDescription('Gestion des candidatures d\'adhésion au club scientifique')
  .addSubcommand(sub =>
    sub.setName('envoyer')
      .setDescription('Déposer une candidature pour devenir membre officiel du club')
      .addStringOption(opt => opt.setName('filiere').setDescription('Votre cursus ou filière d\'études').setRequired(true))
      .addStringOption(opt => opt.setName('motivation').setDescription('Pourquoi souhaitez-vous rejoindre le club ?').setRequired(true))
      .addStringOption(opt => opt.setName('interets').setDescription('Domaines qui vous intéressent (IA, Robotique, Astro...)').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('statut')
      .setDescription('Consulter l\'état de traitement de votre candidature')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'envoyer') {
    const studyField = interaction.options.getString('filiere', true);
    const motivation = interaction.options.getString('motivation', true);
    const interestsRaw = interaction.options.getString('interets', true);
    const interests = interestsRaw.split(',').map(s => s.trim());

    // Vérifier si une candidature existe déjà en attente
    const existing = db.prepare('SELECT * FROM candidatures WHERE guild_id = ? AND user_id = ? AND status = \'pending\'')
      .get(interaction.guild.id, interaction.user.id);

    if (existing) {
      await interaction.reply({
        content: '⚠️ Vous avez déjà une candidature en attente d\'examen par le bureau du club.',
        ephemeral: true
      });
      return;
    }

    const candId = randomUUID();
    db.prepare(`
      INSERT INTO candidatures (id, guild_id, user_id, study_field, motivation, interests, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
    `).run(candId, interaction.guild.id, interaction.user.id, studyField, motivation, JSON.stringify(interests));

    const embed = new EmbedBuilder()
      .setTitle('📝 Candidature Enregistrée')
      .setColor(0x10B981)
      .setDescription('Votre demande d\'adhésion a été transmise aux responsables du club scientifique.')
      .addFields(
        { name: 'Filière / Niveau', value: studyField, inline: true },
        { name: 'Centres d\'intérêt', value: interests.join(', '), inline: true },
        { name: 'Motivation', value: motivation }
      )
      .setFooter({ text: 'Vous recevrez une notification lors du traitement de votre dossier.' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } else if (subcommand === 'statut') {
    const candidate = db.prepare(`
      SELECT * FROM candidatures WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(interaction.guild.id, interaction.user.id) as any;

    if (!candidate) {
      await interaction.reply({
        content: 'Vous n\'avez soumis aucune candidature. Utilisez `/candidature envoyer` pour postuler !',
        ephemeral: true
      });
      return;
    }

    const statusLabels: Record<string, string> = {
      pending: '⏳ En cours d\'examen par le bureau',
      accepted: '🎉 Acceptée ! Bienvenue parmi les membres officiels !',
      rejected: '❌ Non retenue pour cette session'
    };

    const embed = new EmbedBuilder()
      .setTitle('Statut de votre Candidature')
      .setColor(candidate.status === 'accepted' ? 0x10B981 : candidate.status === 'rejected' ? 0xEF4444 : 0xF59E0B)
      .addFields(
        { name: 'Statut actuel', value: statusLabels[candidate.status] || candidate.status },
        { name: 'Date de dépôt', value: new Date(candidate.created_at).toLocaleDateString('fr-FR') }
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
