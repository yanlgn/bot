/**
 * Liste des permissions Discord courantes avec libellés en français et catégories
 */
export interface PermissionDefinition {
  flag: string;
  bit: bigint;
  name: string;
  description: string;
  category: 'general' | 'text' | 'voice' | 'advanced';
}

export const DISCORD_PERMISSIONS: PermissionDefinition[] = [
  // General
  {
    flag: 'ViewChannel',
    bit: 1n << 10n,
    name: 'Voir le salon',
    description: 'Permet aux membres de voir le salon et ses messages.',
    category: 'general'
  },
  {
    flag: 'ManageChannels',
    bit: 1n << 4n,
    name: 'Gérer les salons',
    description: 'Permet de créer, modifier ou supprimer des salons.',
    category: 'general'
  },
  {
    flag: 'ManageRoles',
    bit: 1n << 28n,
    name: 'Gérer les rôles',
    description: 'Permet de créer, modifier et supprimer des rôles inférieurs.',
    category: 'general'
  },
  {
    flag: 'Administrator',
    bit: 1n << 3n,
    name: 'Administrateur',
    description: 'Donne tous les droits sur le serveur (ignore les restrictions).',
    category: 'advanced'
  },

  // Text
  {
    flag: 'SendMessages',
    bit: 1n << 11n,
    name: 'Envoyer des messages',
    description: 'Permet d\'écrire dans les salons textuels.',
    category: 'text'
  },
  {
    flag: 'ReadMessageHistory',
    bit: 1n << 16n,
    name: 'Lire l\'historique',
    description: 'Permet de consulter les anciens messages du salon.',
    category: 'text'
  },
  {
    flag: 'AddReactions',
    bit: 1n << 6n,
    name: 'Ajouter des réactions',
    description: 'Permet d\'ajouter de nouvelles réactions emoji aux messages.',
    category: 'text'
  },
  {
    flag: 'AttachFiles',
    bit: 1n << 15n,
    name: 'Joindre des fichiers',
    description: 'Permet d\'uploader des images, PDF, code et documents.',
    category: 'text'
  },
  {
    flag: 'EmbedLinks',
    bit: 1n << 14n,
    name: 'Intégrer des liens',
    description: 'Affiche les aperçus riches des liens partagés.',
    category: 'text'
  },
  {
    flag: 'MentionEveryone',
    bit: 1n << 17n,
    name: 'Mentionner @everyone',
    description: 'Permet d\'envoyer une notification à tout le serveur.',
    category: 'text'
  },
  {
    flag: 'ManageMessages',
    bit: 1n << 13n,
    name: 'Gérer les messages',
    description: 'Permet de supprimer les messages d\'autres membres et d\'épingler.',
    category: 'text'
  },
  {
    flag: 'CreatePublicThreads',
    bit: 1n << 35n,
    name: 'Créer des fils publics',
    description: 'Permet de créer des fils de discussion ouverts à tous.',
    category: 'text'
  },
  {
    flag: 'CreatePrivateThreads',
    bit: 1n << 36n,
    name: 'Créer des fils privés',
    description: 'Permet de créer des fils de discussion restreints.',
    category: 'text'
  },
  {
    flag: 'SendMessagesInThreads',
    bit: 1n << 38n,
    name: 'Écrire dans les fils',
    description: 'Permet de poster des réponses dans les fils de discussion.',
    category: 'text'
  },

  // Voice
  {
    flag: 'Connect',
    bit: 1n << 20n,
    name: 'Se connecter',
    description: 'Permet de rejoindre un salon vocal.',
    category: 'voice'
  },
  {
    flag: 'Speak',
    bit: 1n << 21n,
    name: 'Parler',
    description: 'Permet de s\'exprimer au microphone dans les salons vocaux.',
    category: 'voice'
  },
  {
    flag: 'MuteMembers',
    bit: 1n << 22n,
    name: 'Couper le micro des membres',
    description: 'Permet de rendre muet un autre membre en vocal.',
    category: 'voice'
  },
  {
    flag: 'MoveMembers',
    bit: 1n << 24n,
    name: 'Déplacer des membres',
    description: 'Permet de déplacer un membre d\'un salon vocal à un autre.',
    category: 'voice'
  },

  // Advanced & Moderation
  {
    flag: 'ModerateMembers',
    bit: 1n << 40n,
    name: 'Exclure temporairement (Timeout)',
    description: 'Permet de restreindre temporairement l\'accès d\'un membre.',
    category: 'advanced'
  },
  {
    flag: 'KickMembers',
    bit: 1n << 1n,
    name: 'Expulser des membres',
    description: 'Permet de retirer un membre du serveur.',
    category: 'advanced'
  },
  {
    flag: 'BanMembers',
    bit: 1n << 2n,
    name: 'Bannir des membres',
    description: 'Permet d\'interdire définitivement l\'accès au serveur.',
    category: 'advanced'
  }
];

export const PERMISSION_FLAGS = DISCORD_PERMISSIONS.map(p => p.flag);

export function hasPermissionBit(permissionsBitfield: string | bigint | number, flag: string): boolean {
  const perm = DISCORD_PERMISSIONS.find(p => p.flag === flag);
  if (!perm) return false;
  const bitfield = BigInt(permissionsBitfield);
  // Check Administrator first
  const adminBit = 1n << 3n;
  if ((bitfield & adminBit) === adminBit) return true;
  return (bitfield & perm.bit) === perm.bit;
}
