import { randomUUID } from 'crypto';
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, TextChannel } from 'discord.js';
import { db } from '../../database/db.js';
import { PointsService } from '../../services/pointsService.js';
import { ConfigService } from '../../services/configService.js';

export const data = new SlashCommandBuilder()
  .setName('ressource')
  .setDescription('Partage et recherche de ressources scientifiques')
  .addSubcommand(sub =>
    sub.setName('ajouter')
      .setDescription('Partager une ressource, un cours ou un lien scientifique')
      .addStringOption(opt => opt.setName('titre').setDescription('Titre de la ressource').setRequired(true))
      .addStringOption(opt => opt.setName('url').setDescription('Lien URL (HTTPS)').setRequired(true))
      .addStringOption(opt =>
        opt.setName('matiere')
          .setDescription('Domaine scientifique')
          .setRequired(true)
          .addChoices(
            { name: 'Intelligence Artificielle', value: 'ia' },
            { name: 'Robotique', value: 'robotique' },
            { name: 'Programmation', value: 'programmation' },
            { name: 'Physique', value: 'physique' },
            { name: 'Chimie', value: 'chimie' },
            { name: 'Biologie', value: 'biologie' },
            { name: 'Mathématiques', value: 'mathematiques' },
            { name: 'Astronomie', value: 'astronomie' }
          )
      )
      .addStringOption(opt => opt.setName('description').setDescription('Description ou résumé').setRequired(true))
      .addStringOption(opt => opt.setName('tags').setDescription('Tags séparés par des virgules (ex: python, ros, ml)').setRequired(false))
  )
  .addSubcommand(sub =>
    sub.setName('rechercher')
      .setDescription('Rechercher des ressources scientifiques')
      .addStringOption(opt =>
        opt.setName('matiere')
          .setDescription('Filtrer par matière')
          .setRequired(false)
          .addChoices(
            { name: 'IA', value: 'ia' },
            { name: 'Robotique', value: 'robotique' },
            { name: 'Programmation', value: 'programmation' },
            { name: 'Physique', value: 'physique' },
            { name: 'Chimie', value: 'chimie' },
            { name: 'Biologie', value: 'biologie' },
            { name: 'Mathématiques', value: 'mathematiques' },
            { name: 'Astronomie', value: 'astronomie' }
          )
      )
      .addStringOption(opt => opt.setName('motcle').setDescription('Mot-clé dans le titre ou description').setRequired(false))
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'ajouter') {
    const title = interaction.options.getString('titre', true);
    const url = interaction.options.getString('url', true);
    const category = interaction.options.getString('matiere', true);
    const description = interaction.options.getString('description', true);
    const tagsRaw = interaction.options.getString('tags') || '';
    const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);

    const resourceId = randomUUID();

    db.prepare(`
      INSERT INTO resources (id, guild_id, title, description, url, category, tags, author_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(resourceId, interaction.guild.id, title, description, url, category, JSON.stringify(tags), interaction.user.id);

    // Points de récompense
    const config = ConfigService.getGuildConfig(interaction.guild.id);
    const pts = config?.points?.resourceSharingPoints ?? 5;
    if (config?.points?.enabled) {
      PointsService.addPoints(interaction.guild.id, interaction.user.id, pts);
    }

    // Publication dans le salon ressources configuré si trouvé
    try {
      if (config?.channels?.resources) {
        const channelName = config.channels.resources.name;
        const channel = interaction.guild.channels.cache.find(c => c.name === channelName && c.isTextBased()) as TextChannel | undefined;
        if (channel) {
          const embed = new EmbedBuilder()
            .setTitle(`📚 Nouvelle Ressource : ${title}`)
            .setURL(url)
            .setDescription(description)
            .setColor(0x10B981)
            .addFields(
              { name: 'Matière', value: category.toUpperCase(), inline: true },
              { name: 'Partagé par', value: `<@${interaction.user.id}>`, inline: true },
              { name: 'Tags', value: tags.join(', ') || 'Aucun', inline: true }
            )
            .setTimestamp();
          await channel.send({ embeds: [embed] });
        }
      }
    } catch {
      // Ignorer si pas d'accès
    }

    await interaction.reply({
      content: `✅ Ressource scientifique partagée avec succès ! (+${pts} points de participation)`,
      ephemeral: true
    });
  } else if (subcommand === 'rechercher') {
    const category = interaction.options.getString('matiere');
    const keyword = interaction.options.getString('motcle');

    let query = 'SELECT * FROM resources WHERE guild_id = ?';
    const params: any[] = [interaction.guild.id];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    if (keyword) {
      query += ' AND (title LIKE ? OR description LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    query += ' ORDER BY created_at DESC LIMIT 10';

    const results = db.prepare(query).all(...params) as any[];

    if (results.length === 0) {
      await interaction.reply({ content: 'Aucune ressource trouvée correspondant à vos critères.', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('📚 Résultats de la Bibliothèque Scientifique')
      .setColor(0x06B6D4)
      .setDescription(`${results.length} ressource(s) trouvée(s) :`);

    for (const r of results) {
      embed.addFields({
        name: `[${r.category.toUpperCase()}] ${r.title}`,
        value: `${r.description.slice(0, 140)}...\n🔗 [Consulter la ressource](${r.url}) • Partagé par <@${r.author_id}>`
      });
    }

    await interaction.reply({ embeds: [embed] });
  }
}
