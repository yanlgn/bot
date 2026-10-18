import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { DiscordChannelData, DiscordRoleData, DiscordPermissionState, DISCORD_PERMISSIONS } from '@sciclub/shared';
import { KeyRound, Check, X, Minus, Save } from 'lucide-react';

export const PermissionsPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const queryClient = useQueryClient();

  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [permStates, setPermStates] = useState<Record<string, DiscordPermissionState>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Fetch Channels
  const { data: channels = [] } = useQuery<DiscordChannelData[]>({
    queryKey: ['channels', guildId],
    queryFn: () => apiFetch(`/guilds/${guildId}/channels`),
    enabled: !!guildId
  });

  // Fetch Roles
  const { data: roles = [] } = useQuery<DiscordRoleData[]>({
    queryKey: ['roles', guildId],
    queryFn: () => apiFetch(`/guilds/${guildId}/roles`),
    enabled: !!guildId
  });

  // Select first channel and role when loaded
  React.useEffect(() => {
    if (channels.length > 0 && !selectedChannelId) {
      setSelectedChannelId(channels[0]!.id);
    }
  }, [channels, selectedChannelId]);

  React.useEffect(() => {
    if (roles.length > 0 && !selectedRoleId) {
      setSelectedRoleId(roles[0]!.id);
    }
  }, [roles, selectedRoleId]);

  // Update local permission states when channel/role change
  React.useEffect(() => {
    if (!selectedChannelId || !selectedRoleId) return;
    const channel = channels.find(c => c.id === selectedChannelId);
    if (!channel) return;

    const overwrite = channel.permissionOverwrites.find(o => o.id === selectedRoleId);
    const newStates: Record<string, DiscordPermissionState> = {};

    DISCORD_PERMISSIONS.forEach(p => {
      if (overwrite?.allow.includes(p.flag)) {
        newStates[p.flag] = 'ALLOW';
      } else if (overwrite?.deny.includes(p.flag)) {
        newStates[p.flag] = 'DENY';
      } else {
        newStates[p.flag] = 'NEUTRAL';
      }
    });

    setPermStates(newStates);
  }, [selectedChannelId, selectedRoleId, channels]);

  const savePermissionsMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/guilds/${guildId}/channels/${selectedChannelId}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({
          targetId: selectedRoleId,
          targetType: 'role',
          permissions: permStates
        })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels', guildId] });
      setStatusMessage('Permissions enregistrées et appliquées sur Discord avec succès !');
      setTimeout(() => setStatusMessage(null), 4000);
    },
    onError: (err: any) => {
      setStatusMessage(`Erreur : ${err.message}`);
    }
  });



  const selectedChannel = channels.find(c => c.id === selectedChannelId);
  const selectedRole = roles.find(r => r.id === selectedRoleId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-100 flex items-center">
          <KeyRound className="w-6 h-6 mr-3 text-blue-400" />
          Matrice des Permissions par Salon
        </h1>
        <p className="text-sm text-gray-400">
          Configurez précisément les droits d'accès et d'écriture pour chaque rôle et salon scientifique.
        </p>
      </div>

      {/* Selectors Bar */}
      <div className="bg-[#111827] border border-gray-800 rounded-xl p-5 flex flex-wrap gap-4 items-center justify-between shadow-lg">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Salon Ciblé
            </label>
            <select
              value={selectedChannelId}
              onChange={e => setSelectedChannelId(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {channels.map(ch => (
                <option key={ch.id} value={ch.id}>
                  #{ch.name} ({ch.type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Rôle Ciblé
            </label>
            <select
              value={selectedRoleId}
              onChange={e => setSelectedRoleId(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {roles.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={() => savePermissionsMutation.mutate()}
          disabled={savePermissionsMutation.isPending}
          className="flex items-center px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white text-sm font-semibold rounded-lg transition shadow-md shadow-blue-500/20"
        >
          <Save className="w-4 h-4 mr-2" />
          {savePermissionsMutation.isPending ? 'Enregistrement...' : 'Enregistrer les Permissions'}
        </button>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-sm font-medium ${
            statusMessage.startsWith('Erreur')
              ? 'bg-rose-950/40 border border-rose-800 text-rose-300'
              : 'bg-emerald-950/40 border border-emerald-800 text-emerald-300'
          }`}
        >
          {statusMessage}
        </div>
      )}

      {/* Permissions Matrix Table */}
      <div className="bg-[#111827] border border-gray-800 rounded-xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-[#1E293B]/40">
          <div>
            <h3 className="font-semibold text-gray-200">
              Droits de <span className="text-blue-400">{selectedRole?.name}</span> sur <span className="text-blue-400">#{selectedChannel?.name}</span>
            </h3>
            <p className="text-xs text-gray-400">Cliquez sur un état pour alterner : Autorisé → Refusé → Neutre</p>
          </div>
          <div className="flex items-center space-x-3 text-xs">
            <span className="flex items-center text-emerald-400">
              <Check className="w-4 h-4 mr-1" /> Autorisé (ALLOW)
            </span>
            <span className="flex items-center text-rose-400">
              <X className="w-4 h-4 mr-1" /> Refusé (DENY)
            </span>
            <span className="flex items-center text-gray-400">
              <Minus className="w-4 h-4 mr-1" /> Neutre / Hérité
            </span>
          </div>
        </div>

        <div className="divide-y divide-gray-800">
          {DISCORD_PERMISSIONS.map(perm => {
            const state = permStates[perm.flag] || 'NEUTRAL';
            return (
              <div
                key={perm.flag}
                className="px-6 py-3.5 flex items-center justify-between hover:bg-gray-800/30 transition"
              >
                <div>
                  <p className="font-medium text-sm text-gray-200">{perm.name}</p>
                  <p className="text-xs text-gray-400">{perm.description}</p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setPermStates(p => ({ ...p, [perm.flag]: 'ALLOW' }))}
                    className={`p-2 rounded-lg transition ${
                      state === 'ALLOW'
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                        : 'bg-gray-800 text-gray-400 hover:text-emerald-400 hover:bg-gray-700'
                    }`}
                    title="Autoriser"
                  >
                    <Check className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setPermStates(p => ({ ...p, [perm.flag]: 'NEUTRAL' }))}
                    className={`p-2 rounded-lg transition ${
                      state === 'NEUTRAL'
                        ? 'bg-gray-600 text-white shadow-md'
                        : 'bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                    }`}
                    title="Neutre"
                  >
                    <Minus className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setPermStates(p => ({ ...p, [perm.flag]: 'DENY' }))}
                    className={`p-2 rounded-lg transition ${
                      state === 'DENY'
                        ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                        : 'bg-gray-800 text-gray-400 hover:text-rose-400 hover:bg-gray-700'
                    }`}
                    title="Refuser"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
