import { GuildConfigFileInput } from '../schemas/config.schema.js';

export function getDefaultCortexConfig(guildId: string): GuildConfigFileInput {
  return {
    guildId,
    locale: 'fr',
    timezone: 'Europe/Paris',
    club: {
      name: 'CORTEX Scientific Club',
      description: "Club scientifique d'excellence axé sur l'intelligence artificielle, l'informatique, les sciences et l'innovation technologique.",
      logoUrl: ''
    },
    departments: [],
    roles: {
      admin: {
        name: 'Admin Cortex',
        color: '#E5092E',
        permissions: ['Administrator'],
        protected: true
      },
      moderator: {
        name: 'Modérateur Cortex',
        color: '#F59E0B',
        permissions: [
          'ManageMessages',
          'ModerateMembers',
          'ViewChannel',
          'SendMessages',
          'ReadMessageHistory'
        ],
        protected: true
      },
      mentor: {
        name: 'Mentor / Responsable',
        color: '#8B5CF6',
        permissions: [
          'ViewChannel',
          'SendMessages',
          'ReadMessageHistory',
          'MentionEveryone'
        ],
        protected: false
      },
      member: {
        name: 'Membre Cortex',
        color: '#22C55E',
        permissions: [
          'ViewChannel',
          'SendMessages',
          'ReadMessageHistory',
          'AddReactions',
          'AttachFiles',
          'EmbedLinks'
        ],
        protected: false
      },
      guest: {
        name: 'Invité / Visiteur',
        color: '#64748B',
        permissions: [
          'ViewChannel',
          'ReadMessageHistory'
        ],
        protected: false
      }
    },
    categories: [
      { key: 'accueil', name: '🔴 CORTEX | ACCUEIL' },
      { key: 'club', name: '💬 CORTEX | COMMUNAUTÉ' },
      { key: 'projets', name: '🚀 CORTEX | PROJETS & RECHERCHE' },
      { key: 'evenements', name: '📅 CORTEX | ÉVÉNEMENTS' },
      { key: 'administration', name: '⚙️ CORTEX | ADMINISTRATION' }
    ],
    channels: {
      welcome: {
        name: 'bienvenue',
        type: 'text',
        categoryKey: 'accueil',
        topic: 'Bienvenue au CORTEX Scientific Club ! Présente-toi et prends tes rôles.',
        readonlyForMembers: false
      },
      announcements: {
        name: 'annonces-officielles',
        type: 'text',
        categoryKey: 'accueil',
        topic: 'Communications et annonces importantes du club CORTEX.',
        readonlyForMembers: true
      },
      rules: {
        name: 'reglement-et-charte',
        type: 'text',
        categoryKey: 'accueil',
        topic: 'Charte éthique et règles de vie du serveur CORTEX.',
        readonlyForMembers: true
      },
      general: {
        name: 'general-sciences',
        type: 'text',
        categoryKey: 'club',
        topic: 'Discussions générales, science, technologie et vie du club.',
        readonlyForMembers: false
      },
      idees: {
        name: 'idees-et-debats',
        type: 'text',
        categoryKey: 'club',
        topic: "Partage d'idées novatrices, propositions et débats scientifiques.",
        readonlyForMembers: false
      },
      projets: {
        name: 'projets-en-cours',
        type: 'text',
        categoryKey: 'projets',
        topic: 'Coordination, collaboration et suivi des projets du club.',
        readonlyForMembers: false
      },
      hackathons: {
        name: 'hackathons-et-challenges',
        type: 'text',
        categoryKey: 'projets',
        topic: "Organisation d'équipes pour hackathons, compétitions et CTFs.",
        readonlyForMembers: false
      },
      events: {
        name: 'planning-ateliers',
        type: 'text',
        categoryKey: 'evenements',
        topic: 'Dates et programmes des conférences, workshops et ateliers pratiques.',
        readonlyForMembers: true
      },
      debrief: {
        name: 'retours-evenements',
        type: 'text',
        categoryKey: 'evenements',
        topic: 'Photos, replays et impressions suite aux événements passés.',
        readonlyForMembers: false
      },
      logs: {
        name: 'logs-bot-securite',
        type: 'text',
        categoryKey: 'administration',
        topic: 'Historique des alertes de modération et actions système.',
        readonlyForMembers: true
      },
      admin_discussion: {
        name: 'staff-cortex',
        type: 'text',
        categoryKey: 'administration',
        topic: 'Salon privé réservé aux administrateurs et modérateurs.',
        readonlyForMembers: true
      }
    },
    channelPermissions: [
      {
        channelKey: 'announcements',
        overwrites: [
          {
            targetKey: 'role:member',
            permissions: {
              ViewChannel: 'ALLOW',
              ReadMessageHistory: 'ALLOW',
              SendMessages: 'DENY',
              AddReactions: 'ALLOW'
            }
          },
          {
            targetKey: 'role:moderator',
            permissions: {
              ViewChannel: 'ALLOW',
              ReadMessageHistory: 'ALLOW',
              SendMessages: 'ALLOW',
              ManageMessages: 'ALLOW'
            }
          },
          {
            targetKey: 'role:admin',
            permissions: {
              ViewChannel: 'ALLOW',
              ReadMessageHistory: 'ALLOW',
              SendMessages: 'ALLOW',
              ManageMessages: 'ALLOW'
            }
          }
        ]
      },
      {
        channelKey: 'rules',
        overwrites: [
          {
            targetKey: 'role:member',
            permissions: {
              ViewChannel: 'ALLOW',
              ReadMessageHistory: 'ALLOW',
              SendMessages: 'DENY',
              AddReactions: 'ALLOW'
            }
          },
          {
            targetKey: 'role:guest',
            permissions: {
              ViewChannel: 'ALLOW',
              ReadMessageHistory: 'ALLOW',
              SendMessages: 'DENY'
            }
          },
          {
            targetKey: 'role:moderator',
            permissions: {
              ViewChannel: 'ALLOW',
              ReadMessageHistory: 'ALLOW',
              SendMessages: 'ALLOW'
            }
          },
          {
            targetKey: 'role:admin',
            permissions: {
              ViewChannel: 'ALLOW',
              ReadMessageHistory: 'ALLOW',
              SendMessages: 'ALLOW'
            }
          }
        ]
      },
      {
        channelKey: 'logs',
        overwrites: [
          {
            targetKey: 'role:member',
            permissions: { ViewChannel: 'DENY' }
          },
          {
            targetKey: 'role:guest',
            permissions: { ViewChannel: 'DENY' }
          },
          {
            targetKey: 'role:moderator',
            permissions: {
              ViewChannel: 'ALLOW',
              ReadMessageHistory: 'ALLOW',
              SendMessages: 'DENY'
            }
          },
          {
            targetKey: 'role:admin',
            permissions: {
              ViewChannel: 'ALLOW',
              ReadMessageHistory: 'ALLOW',
              SendMessages: 'ALLOW'
            }
          }
        ]
      },
      {
        channelKey: 'admin_discussion',
        overwrites: [
          {
            targetKey: 'role:member',
            permissions: { ViewChannel: 'DENY' }
          },
          {
            targetKey: 'role:guest',
            permissions: { ViewChannel: 'DENY' }
          },
          {
            targetKey: 'role:moderator',
            permissions: {
              ViewChannel: 'ALLOW',
              ReadMessageHistory: 'ALLOW',
              SendMessages: 'ALLOW'
            }
          },
          {
            targetKey: 'role:admin',
            permissions: {
              ViewChannel: 'ALLOW',
              ReadMessageHistory: 'ALLOW',
              SendMessages: 'ALLOW'
            }
          }
        ]
      }
    ],
    moderation: {
      logChannelKey: 'logs',
      maxWarnings: 3,
      autoMuteDurationMinutes: 60,
      badWordsFilter: true
    },
    points: {
      enabled: true,
      messagePoints: 1,
      eventParticipationPoints: 10,
      projectCreationPoints: 25,
      resourceSharingPoints: 5
    }
  };
}
