export interface ProjectRecord {
  id: string;
  guildId: string;
  name: string;
  description: string;
  leaderId: string;
  leaderUsername?: string;
  channelId?: string | null;
  status: 'idea' | 'in_progress' | 'paused' | 'completed' | 'archived';
  memberIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface EventRecord {
  id: string;
  guildId: string;
  title: string;
  description: string;
  type: 'conference' | 'workshop' | 'competition' | 'field_trip' | 'hackathon' | 'training';
  scheduledStartTime: string;
  location: string;
  speaker?: string | null;
  maxParticipants?: number | null;
  targetAudience?: string | null;
  status: 'draft' | 'published' | 'cancelled' | 'completed';
  channelId?: string | null;
  participantRoleId?: string | null;
  participantCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResourceRecord {
  id: string;
  guildId: string;
  title: string;
  description: string;
  url: string;
  category: 'ia' | 'robotique' | 'programmation' | 'physique' | 'chimie' | 'biologie' | 'mathematiques' | 'astronomie';
  tags: string[];
  authorId: string;
  authorUsername?: string;
  createdAt: string;
}

export interface CandidatureRecord {
  id: string;
  guildId: string;
  userId: string;
  username: string;
  studyField: string;
  motivation: string;
  interests: string[];
  status: 'pending' | 'accepted' | 'rejected';
  reviewedBy?: string | null;
  createdAt: string;
}

export interface WarningRecord {
  id: string;
  guildId: string;
  userId: string;
  moderatorId: string;
  reason: string;
  createdAt: string;
}

export interface AuditLogRecord {
  id: string;
  guildId: string;
  userId: string;
  username: string;
  action: string;
  targetType: 'role' | 'channel' | 'permission' | 'member' | 'project' | 'event' | 'resource' | 'config';
  targetId?: string | null;
  details: string;
  createdAt: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface UserSessionData {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  guilds: {
    id: string;
    name: string;
    icon: string | null;
    owner: boolean;
    permissions: string;
    hasBotAccess: boolean;
  }[];
}
