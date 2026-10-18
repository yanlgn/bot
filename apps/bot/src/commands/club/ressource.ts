import { randomUUID } from 'crypto';
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, TextChannel } from 'discord.js';
import { db } from '../../database/db.js';
import { PointsService } from '../../services/pointsService.js';
import { ConfigService } from '../../services/configService.js';

export const data = new SlashCommandBuilder()
  .setName('ressource')
  .setDescription('Partage et exploration de la bibliothèque scientifique CORTEX')
  .addSubcommand(sub =>
    sub.setName('ajouter')
      .setDescription('Partager une ressource, article, cours ou repo scientifique')
      .addStringOption(opt => opt.setName('titre').setDescription('Titre de la ressource').setRequired(true))
      .addStringOption(opt => opt.setName('url').setDescription('Lien URL HTTPS valide').setRequired(true))
      .addStringOption(opt =>
        opt.setName('matiere')
          .setDescription('Discipline scientifique')
          .setRequired(true)
          .addChoices(
            { name: '🤖 Intelligence Artificielle & Data', value: 'ia' },
            { name: '🦾 Robotique & Systèmes Embarqués', value: 'robotique' },
            { name: '💻 Développement & Algorithmique', value: 'programmation' },
            { name: '⚛️ Physique & Mécanique', value: 'physique' },
            { name: '🧪 Chimie & Matériaux', value: 'chimie' },
            { name: '🧬 Biologie & Biotechnologies', value: 'biologie' },
            { name: '📐 Mathématiques & Cryptographie', value: 'mathematiques' },
            { name: '🔭 Astronomie & Espace', value: 'astronomie' }
          )
      )
      .addStringOption(opt => opt.setName('description').setDescription('Résumé ou points clés de la ressource').setRequired(true))
      .addStringOption(opt => opt.setName('tags').setDescription('Mots-clés séparés par des virgules (ex: pytorch, paper, github)').setRequired(false))
  )
  .addSubcommand(sub =>
    sub.setName('rechercher')
      .setDescription('Explorer les ressources scientifiques archivées')
      .addStringOption(opt =>
        opt.setName('matiere')
          .setDescription('Filtrer par discipline')
          .setRequired(false)
          .addChoices(
            { name: 'IA & Data', value: 'ia' },
            { name: 'Robotique', value: 'robotique' },
            { name: 'Programmation', value: 'programmation' },
            { name: 'Physique', value: 'physique' },
            { name: 'Chimie', value: 'chimie' },
            { name: 'Biologie', value: 'biologie' },
            { name: 'Mathématiques', value: 'mathematiques' },
            { name: 'Astronomie', value: 'astronomie' }
          )
      )
      .addStringOption(opt => opt.setName('motcle').setDescription('Mot-clé dans le titre ou résumé').setRequired(false))
  );

const CATEGORY_NAMES: Record<string, string> = {
  ia: '🤖 IA & Data',
  robotique: '🦾 Robotique',
  programmation: '💻 Programmation',
  physique: '⚛️ Physique',
  chimie: '🧪 Chimie',
  biologie: '🧬 Biologie',
  mathematiques: '📐 Mathématiques',
  astronomie: '🔭 Astronomie'
};

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

    // Validation basique de l'URL
    try {
      const parsedUrl = new URL(url);
      if (!parsedUrl.protocol.startsWith('http')) {
        throw new Error('Protocole invalide');
      }
    } catch {
      await interaction.reply({ content: '❌ URL invalide. Veuillez fournir une adresse web valide commençant par `http://` ou `https://`.', ephemeral: true });
      return;
    }

    const resourceId = randomUUID();

    db.prepare(`
      INSERT INTO resources (id, guild_id, title, description, url, category, tags, author_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(resourceId, interaction.guild.id, title, description, url, category, JSON.stringify(tags), interaction.user.id);

    const config = ConfigService.getGuildConfig(interaction.guild.id);
    const pts = config?.points?.resourceSharingPoints ?? 5;
    if (config?.points?.enabled) {
      PointsService.addPoints(interaction.guild.id, interaction.user.id, pts);
    }

    try {
      const channel = interaction.guild.channels.cache.find(c => 
        c.isTextBased() && (c.name.includes('ressource') || c.name.includes('veille') || c.name.includes('bibliotheque'))
      ) as TextChannel | undefined;

      if (channel) {
        const publicEmbed = new EmbedBuilder()
          .setTitle(`📚 Nouvelle Ressource : ${title}`)
          .setURL(url)
          .setDescription(description)
          .setColor(0xE5092E)
          .addFields(
            { name: '🏷️ Discipline', value: CATEGORY_NAMES[category] || category.toUpperCase(), inline: true },
            { name: '👤 Partagé par', value: `<@${interaction.user.id}>`, inline: true },
            { name: '🏷️ Tags', value: tags.map(t => `\`#${t}\``).join(' ') || '*Aucun*', inline: true }
          )
          .setFooter({ text: 'CORTEX Scientific Club • Bibliothèque partagée' })
          .setTimestamp();

        await channel.send({ embeds: [publicEmbed] });
      }
    } catch {}

    const confirmEmbed = new EmbedBuilder()
      .setTitle('✅ Ressource Enregistrée')
      .setColor(0x10B981)
      .setDescription(`Votre ressource **[${title}](${url})** a été indexée dans la bibliothèque scientifique.\nVous gagnez **+${pts}** points d'engagement !`)
      .setTimestamp();

    await interaction.reply({ embeds: [confirmEmbed], ephemeral: true });
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
      query += ' AND (title LIKE ? OR description LIKE ? OR tags LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    query += ' ORDER BY created_at DESC LIMIT 8';

    const results = db.prepare(query).all(...params) as any[];

    if (results.length === 0) {
      await interaction.reply({
        content: 'ℹ️ Aucune ressource trouvée pour ces critères de recherche.',
        ephemeral: true
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('📚 Bibliothèque Scientifique CORTEX — Résultats')
      .setColor(0xE5092E)
      .setDescription(`Voici les ${results.length} ressource(s) scientifique(s) trouvée(s) :\n`);

    for (const r of results) {
      const catLabel = CATEGORY_NAMES[r.category] || r.category.toUpperCase();
      embed.addFields({
        name: `${catLabel} — ${r.title}`,
        value: `${r.description.slice(0, 160)}${r.description.length > 160 ? '...' : ''}\n🔗 [Ouvrir la ressource](${r.url}) • Partagé par <@${r.author_id}>`,
        inline: false
      });
    }

    embed.setFooter({ text: 'CORTEX Scientific Club • Partagez vos découvertes avec /ressource ajouter' });
    await interaction.reply({ embeds: [embed] });
  }
}
