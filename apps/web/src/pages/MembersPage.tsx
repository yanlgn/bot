import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { DiscordMemberData, DiscordRoleData } from '@sciclub/shared';
import { Users, Search, Shield, AlertTriangle, Clock, UserX, Ban } from 'lucide-react';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

export const MembersPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<DiscordMemberData | null>(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isWarnModalOpen, setIsWarnModalOpen] = useState(false);
  const [isTimeoutModalOpen, setIsTimeoutModalOpen] = useState(false);

  const [warnReason, setWarnReason] = useState('');
  const [timeoutMinutes, setTimeoutMinutes] = useState(60);
  const [timeoutReason, setTimeoutReason] = useState('');

  const [kickTarget, setKickTarget] = useState<DiscordMemberData | null>(null);
  const [banTarget, setBanTarget] = useState<DiscordMemberData | null>(null);

  // Queries
  const { data: members = [], isLoading } = useQuery<DiscordMemberData[]>({
    queryKey: ['members', guildId],
    queryFn: () => apiFetch(`/guilds/${guildId}/members`),
    enabled: !!guildId
  });

  const { data: roles = [] } = useQuery<DiscordRoleData[]>({
    queryKey: ['roles', guildId],
    queryFn: () => apiFetch(`/guilds/${guildId}/roles`),
    enabled: !!guildId
  });

  // Role map for quick lookup
  const roleMap = new Map(roles.map(r => [r.id, r]));

  // Mutations
  const toggleRoleMutation = useMutation({
    mutationFn: ({ memberId, roleId, action }: { memberId: string; roleId: string; action: 'add' | 'remove' }) => {
      const url = `/guilds/${guildId}/members/${memberId}/roles`;
      if (action === 'add') {
        return apiFetch(url, { method: 'POST', body: JSON.stringify({ roleId }) });
      } else {
        return apiFetch(`${url}/${roleId}`, { method: 'DELETE' });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members', guildId] })
  });

  const warnMutation = useMutation({
    mutationFn: ({ memberId, reason }: { memberId: string; reason: string }) =>
      apiFetch(`/guilds/${guildId}/moderation/warn`, {
        method: 'POST',
        body: JSON.stringify({ userId: memberId, reason })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', guildId] });
      setIsWarnModalOpen(false);
      setWarnReason('');
    }
  });

  const timeoutMutation = useMutation({
    mutationFn: ({ memberId, durationMinutes, reason }: { memberId: string; durationMinutes: number; reason: string }) =>
      apiFetch(`/guilds/${guildId}/members/${memberId}/timeout`, {
        method: 'POST',
        body: JSON.stringify({ durationMinutes, reason })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', guildId] });
      setIsTimeoutModalOpen(false);
      setTimeoutReason('');
    }
  });

  const kickMutation = useMutation({
    mutationFn: (memberId: string) =>
      apiFetch(`/guilds/${guildId}/members/${memberId}/kick`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Expulsion via dashboard' })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', guildId] });
      setKickTarget(null);
    }
  });

  const banMutation = useMutation({
    mutationFn: (memberId: string) =>
      apiFetch(`/guilds/${guildId}/members/${memberId}/ban`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Bannissement via dashboard' })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', guildId] });
      setBanTarget(null);
    }
  });

  const filtered = members.filter(m => {
    const q = search.toLowerCase();
    return m.username.toLowerCase().includes(q) || (m.nickname && m.nickname.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center">
            <Users className="w-6 h-6 mr-3 text-blue-400" />
            Membres du Club
          </h1>
          <p className="text-sm text-gray-400">
            Consultez les membres inscrits, attribuez leurs rôles et appliquez les sanctions nécessaires.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Rechercher un membre..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#111827] border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-[#111827] border border-gray-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-[#1E293B]/60 text-xs text-gray-400 uppercase tracking-wider border-b border-gray-800">
              <tr>
                <th className="py-3.5 px-6">Membre</th>
                <th className="py-3.5 px-6">Points</th>
                <th className="py-3.5 px-6">Avertissements</th>
                <th className="py-3.5 px-6">Rôles Attribués</th>
                <th className="py-3.5 px-6">Arrivée</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    Chargement des membres...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    Aucun membre trouvé.
                  </td>
                </tr>
              ) : (
                filtered.map(member => (
                  <tr key={member.id} className="hover:bg-gray-800/40 transition">
                    <td className="py-4 px-6 flex items-center space-x-3">
                      <img
                        src={member.avatarUrl}
                        alt={member.username}
                        className="w-9 h-9 rounded-full bg-gray-800 shrink-0"
                      />
                      <div>
                        <p className="font-semibold text-gray-100">
                          {member.nickname || member.username}
                        </p>
                        <p className="text-xs text-gray-400">@{member.username}</p>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-semibold text-emerald-400">
                        {member.points ?? 0} pts
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      {(member.warningsCount ?? 0) > 0 ? (
                        <Badge variant="amber">{member.warningsCount} avertissement(s)</Badge>
                      ) : (
                        <span className="text-gray-500 text-xs">0</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {member.roles.slice(0, 3).map(rId => {
                          const role = roleMap.get(rId);
                          if (!role) return null;
                          return (
                            <Badge key={rId} colorHex={role.hexColor}>
                              {role.name}
                            </Badge>
                          );
                        })}
                        {member.roles.length > 3 && (
                          <span className="text-xs text-gray-500 self-center">
                            +{member.roles.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-gray-400 text-xs">
                      {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString('fr-FR') : 'Inconnue'}
                    </td>
                    <td className="py-4 px-6 text-right space-x-1">
                      <button
                        onClick={() => {
                          setSelectedMember(member);
                          setIsRoleModalOpen(true);
                        }}
                        title="Gérer les rôles"
                        className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-800 rounded-lg transition"
                      >
                        <Shield className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedMember(member);
                          setIsWarnModalOpen(true);
                        }}
                        title="Avertir (Warn)"
                        className="p-1.5 text-gray-400 hover:text-amber-400 hover:bg-gray-800 rounded-lg transition"
                      >
                        <AlertTriangle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedMember(member);
                          setIsTimeoutModalOpen(true);
                        }}
                        title="Timeout temporaire"
                        className="p-1.5 text-gray-400 hover:text-purple-400 hover:bg-gray-800 rounded-lg transition"
                      >
                        <Clock className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setKickTarget(member)}
                        title="Expulser"
                        className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-gray-800 rounded-lg transition"
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setBanTarget(member)}
                        title="Bannir"
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-800 rounded-lg transition"
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Gestion des Rôles Membre */}
      <Modal
        isOpen={isRoleModalOpen}
        onClose={() => {
          setIsRoleModalOpen(false);
          setSelectedMember(null);
        }}
        title={`Rôles de ${selectedMember?.username}`}
      >
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {roles.filter(r => r.id !== guildId).map(role => {
            const hasRole = selectedMember?.roles.includes(role.id);
            return (
              <div
                key={role.id}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-900/60 border border-gray-800"
              >
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: role.hexColor }} />
                  <span className="text-sm font-medium text-gray-200">{role.name}</span>
                </div>
                <button
                  onClick={() => {
                    if (selectedMember) {
                      toggleRoleMutation.mutate({
                        memberId: selectedMember.id,
                        roleId: role.id,
                        action: hasRole ? 'remove' : 'add'
                      });
                    }
                  }}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                    hasRole
                      ? 'bg-rose-900/40 text-rose-300 hover:bg-rose-900/60'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {hasRole ? 'Retirer' : 'Attribuer'}
                </button>
              </div>
            );
          })}
        </div>
      </Modal>

      {/* Modal Avertissement */}
      <Modal
        isOpen={isWarnModalOpen}
        onClose={() => setIsWarnModalOpen(false)}
        title={`Avertir ${selectedMember?.username}`}
      >
        <form
          onSubmit={e => {
            e.preventDefault();
            if (selectedMember) {
              warnMutation.mutate({ memberId: selectedMember.id, reason: warnReason });
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Motif de l'avertissement
            </label>
            <textarea
              required
              rows={3}
              value={warnReason}
              onChange={e => setWarnReason(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: Non-respect de la charte du club ou spam en salon..."
            />
          </div>
          <div className="flex justify-end space-x-3 pt-3">
            <button
              type="button"
              onClick={() => setIsWarnModalOpen(false)}
              className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition"
            >
              Enregistrer l'avertissement
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Timeout */}
      <Modal
        isOpen={isTimeoutModalOpen}
        onClose={() => setIsTimeoutModalOpen(false)}
        title={`Exclusion temporaire de ${selectedMember?.username}`}
      >
        <form
          onSubmit={e => {
            e.preventDefault();
            if (selectedMember) {
              timeoutMutation.mutate({
                memberId: selectedMember.id,
                durationMinutes: timeoutMinutes,
                reason: timeoutReason
              });
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Durée (Minutes)
            </label>
            <input
              type="number"
              min={1}
              max={10080}
              value={timeoutMinutes}
              onChange={e => setTimeoutMinutes(Number(e.target.value))}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Raison
            </label>
            <input
              type="text"
              required
              value={timeoutReason}
              onChange={e => setTimeoutReason(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Raison du timeout..."
            />
          </div>
          <div className="flex justify-end space-x-3 pt-3">
            <button
              type="button"
              onClick={() => setIsTimeoutModalOpen(false)}
              className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition"
            >
              Appliquer le Timeout
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmation Kick */}
      <ConfirmDialog
        isOpen={!!kickTarget}
        onClose={() => setKickTarget(null)}
        onConfirm={() => kickTarget && kickMutation.mutate(kickTarget.id)}
        title="Expulser ce membre ?"
        message={`Êtes-vous sûr de vouloir expulser ${kickTarget?.username} du serveur ? Il pourra le réintégrer avec une nouvelle invitation.`}
        confirmLabel="Expulser"
      />

      {/* Confirmation Ban */}
      <ConfirmDialog
        isOpen={!!banTarget}
        onClose={() => setBanTarget(null)}
        onConfirm={() => banTarget && banMutation.mutate(banTarget.id)}
        title="Bannir définitivement ce membre ?"
        message={`Attention : ${banTarget?.username} sera banni de manière permanente du serveur Discord.`}
        confirmLabel="Bannir définitivement"
      />
    </div>
  );
};
