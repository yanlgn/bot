import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { PointsService } from '../../services/pointsService.js';
import { db } from '../../database/db.js';

export const data = new SlashCommandBuilder()
  .setName('profil')
  .setDescription('Affiche votre profil scientifique CORTEX, points, pôles et projets')
  .addUserOption(option =>
    option.setName('membre')
      .setDescription('Membre à inspecter (vous-même par défaut)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;

  const targetUser = interaction.options.getUser('membre') || interaction.user;
  const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

  const balance = PointsService.getBalance(interaction.guild.id, targetUser.id);

  // Projets rejoints ou dirigés
  const projectsCount = db.prepare(`
    SELECT COUNT(DISTINCT project_id) as count FROM project_members WHERE user_id = ?
  `).get(targetUser.id) as { count: number };

  // Événements rejoints
  const eventsCount = db.prepare(`
    SELECT COUNT(*) as count FROM event_participants WHERE user_id = ?
  `).get(targetUser.id) as { count: number };

  // Départements rejoints
  const userDepts = db.prepare(`
    SELECT d.name, d.icon, dm.role
    FROM department_members dm
    JOIN departments d ON d.id = dm.department_id
    WHERE dm.guild_id = ? AND dm.user_id = ? AND dm.status = 'approved'
  `).all(interaction.guild.id, targetUser.id) as any[];

  // Badges & Rangs scientifiques
  let rankTitle = '🌱 Apprenti Scientifique';
  let nextRankPoints = 20;
  if (balance >= 100) {
    rankTitle = '🏆 Savant Émérite (Rang Élite)';
    nextRankPoints = 100;
  } else if (balance >= 50) {
    rankTitle = '🔬 Chercheur Confirmé (Rang Avancé)';
    nextRankPoints = 100;
  } else if (balance >= 20) {
    rankTitle = '🧪 Expérimentateur (Rang Intermédiaire)';
    nextRankPoints = 50;
  }

  const badges: string[] = [];
  if (balance >= 100) badges.push('🏆 Savant Émérite');
  else if (balance >= 50) badges.push('🔬 Chercheur Confirmé');
  else if (balance >= 20) badges.push('🧪 Expérimentateur');
  else badges.push('🌱 Apprenti Scientifique');

  if (projectsCount.count > 0) badges.push('🚀 Bâtisseur de Projets');
  if (eventsCount.count >= 3) badges.push('📅 Pilier des Ateliers');
  if (userDepts.some(d => d.role === 'leader')) badges.push('👑 Responsable de Pôle');

  // Barre de progression
  const progressPercent = Math.min(100, Math.round((balance / nextRankPoints) * 100));
  const filledBlocks = Math.round(progressPercent / 10);
  const progressBar = '█'.repeat(filledBlocks) + '░'.repeat(10 - filledBlocks);

  const embed = new EmbedBuilder()
    .setTitle(`🔬 Profil Scientifique — ${targetUser.username}`)
    .setThumbnail(targetUser.displayAvatarURL())
    .setColor(0xE5092E)
    .setDescription(
      `**Rang :** ${rankTitle}\n` +
      `**Progression :** \`${progressBar}\` **${balance}** / ${nextRankPoints} pts (${progressPercent}%)\n`
    )
    .addFields(
      {
        name: '✨ Engagement Club',
        value: `🎯 **${balance}** Points\n🚀 **${projectsCount.count}** Projets\n📅 **${eventsCount.count}** Ateliers`,
        inline: true
      },
      {
        name: '🔬 Pôles & Départements',
        value: userDepts.length > 0
          ? userDepts.map(d => `${d.icon || '🔬'} **${d.name}** (${d.role === 'leader' ? '👑 Chef' : 'Membre'})`).join('\n')
          : '*Aucun pôle pour l\'instant*',
        inline: true
      },
      {
        name: '🎖️ Titres & Distinctions',
        value: badges.join(' • ') || '*Aucun titre*',
        inline: false
      },
      {
        name: '🏷️ Rôles Discord',
        value: targetMember
          ? targetMember.roles.cache
              .filter(r => r.id !== interaction.guild!.id)
              .map(r => `<@&${r.id}>`)
              .slice(0, 8)
              .join(', ') || '*Aucun rôle*'
          : '*Inconnu*'
      }
    )
    .setFooter({ text: 'CORTEX Scientific Club • Participez aux projets et ateliers pour gagner des points' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
