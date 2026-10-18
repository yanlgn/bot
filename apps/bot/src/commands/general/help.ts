import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Affiche le guide complet et interactif des commandes CORTEX');

export async function execute(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle('🔴 CORTEX Scientific Club — Guide des Commandes')
    .setColor(0xE5092E)
    .setDescription(
      'Bienvenue sur le système d\'assistance de **CORTEX Scientific Club**.\n' +
      'Toutes les commandes slash sont organisées par pôle d\'activité ci-dessous :'
    )
    .addFields(
      {
        name: '🔬 Départements & Pôles Scientifiques',
        value:
          '`/departement liste` : Découvrir tous les pôles et postuler via le menu interactif\n' +
          '`/departement info nom:...` : Consulter les effectifs, chef et projets d\'un pôle\n' +
          '`/departement rejoindre nom:...` : Ouvrir le formulaire modal de candidature\n' +
          '`/departement demandes` : *(Staff)* Examiner les candidatures en attente\n' +
          '`/departement valider` / `refuser` : *(Staff)* Traiter une candidature'
      },
      {
        name: '👤 Profil & Classement',
        value:
          '`/profil [membre]` : Consulter vos points, niveau, badges et pôles rejoints\n' +
          '`/classement` : Afficher le Top 10 des membres les plus engagés du club'
      },
      {
        name: '🚀 Projets Collaboratifs',
        value:
          '`/projet creer` : Proposer et lancer un nouveau projet scientifique\n' +
          '`/projet liste` : Parcourir l\'ensemble des projets du club\n' +
          '`/projet rejoindre` : Intégrer l\'équipe de recherche d\'un projet'
      },
      {
        name: '📅 Événements, Ateliers & Hackathons',
        value:
          '`/evenement liste` : Consulter le planning et les dates des prochains ateliers\n' +
          '`/evenement inscrire` : Réserver sa place pour une conférence ou formation'
      },
      {
        name: '📚 Ressources & Veille Technologique',
        value:
          '`/ressource ajouter` : Partager un papier de recherche, cours ou tutoriel\n' +
          '`/ressource rechercher` : Filtrer les ressources par discipline (IA, Robotique, etc.)'
      },
      {
        name: '⚙️ Administration & Synchronisation (Staff)',
        value:
          '`/sync` : Forcer la synchronisation instantanée rôles/salons/permissions\n' +
          '`/config` : Afficher ou sauvegarder la configuration JSON du serveur\n' +
          '`/backup` : Gérer les sauvegardes d\'état du serveur\n' +
          '👉 *Ou pilotez tout en temps réel via le **Dashboard Web Cortex**.*'
      }
    )
    .setFooter({ text: 'CORTEX Scientific Club • Innovation, IA & Ingénierie' })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel('Accéder au Dashboard Web')
      .setStyle(ButtonStyle.Link)
      .setURL('https://cortex.yanlouggani.dev')
      .setEmoji('🌐')
  );

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}
