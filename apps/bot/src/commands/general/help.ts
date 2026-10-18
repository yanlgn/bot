import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Affiche la liste complète des commandes de Cortex');

export async function execute(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle('🧠 CORTEX Scientific Club - Guide des Commandes')
    .setColor(0xE5092E)
    .setDescription('Bienvenue sur le système d\'assistance du club scientifique Cortex. Voici les commandes à votre disposition :')
    .addFields(
      {
        name: '👤 Membre & Participation',
        value: '`/profil` : Affiche votre profil, vos badges et vos points Cortex\n`/classement` : Affiche le classement des membres les plus actifs'
      },
      {
        name: '🚀 Projets Scientifiques',
        value: '`/projet creer` : Proposer et créer un nouveau projet\n`/projet liste` : Explorer tous les projets du club\n`/projet rejoindre` : Postuler pour rejoindre un projet existant'
      },
      {
        name: '📅 Événements & Formations',
        value: '`/evenement liste` : Consulter le planning des conférences et ateliers\n`/evenement inscrire` : Réserver sa place pour un événement'
      },
      {
        name: '📚 Bibliothèque de Ressources',
        value: '`/ressource ajouter` : Partager un cours, article, vidéo ou tutoriel\n`/ressource rechercher` : Explorer les ressources scientifiques par matière'
      },
      {
        name: '📝 Candidatures & Sondages',
        value: '`/candidature envoyer` : Déposer votre candidature au club\n`/candidature statut` : Vérifier l\'état de votre dossier\n`/sondage creer` : Lancer une consultation interne'
      },
      {
        name: '⚙️ Administration (Staff)',
        value: '`/config`, `/role`, `/canal`, `/permission`, `/sync`, `/backup` ou utilisez le **Dashboard Web Cortex** pour une gestion graphique complète.'
      }
    )
    .setFooter({ text: 'CORTEX Scientific Club • Innovation & Sciences' });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
