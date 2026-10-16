import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { WarningRecord, DiscordMemberData } from '@sciclub/shared';
import { AlertOctagon, Plus, ShieldAlert, User } from 'lucide-react';
import { Modal } from '../components/common/Modal';

export const ModerationPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const queryClient = useQueryClient();

  const [isWarnOpen, setIsWarnOpen] = useState(false);
  const [targetUserId, setTargetUserId] = useState('');
  const [reason, setReason] = useState('');

  const { data: warnings = [], isLoading } = useQuery<WarningRecord[]>({
    queryKey: ['warnings', guildId],
    queryFn: () => apiFetch(`/guilds/${guildId}/moderation/warnings`),
    enabled: !!guildId
  });

  const { data: members = [] } = useQuery<DiscordMemberData[]>({
    queryKey: ['members', guildId],
    queryFn: () => apiFetch(`/guilds/${guildId}/members`),
    enabled: !!guildId
  });

  const warnMutation = useMutation({
    mutationFn: (payload: any) =>
      apiFetch(`/guilds/${guildId}/moderation/warn`, { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warnings', guildId] });
      setIsWarnOpen(false);
      setTargetUserId('');
      setReason('');
    }
  });

  const handleWarn = (e: React.FormEvent) => {
    e.preventDefault();
    warnMutation.mutate({ userId: targetUserId, reason });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center">
            <AlertOctagon className="w-6 h-6 mr-3 text-amber-500" />
            Modération & Discipline
          </h1>
          <p className="text-sm text-gray-400">
            Historique des avertissements, seuils automatiques de sanctions et journal de discipline.
          </p>
        </div>

        <button
          onClick={() => setIsWarnOpen(true)}
          className="flex items-center px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition shadow-md shadow-amber-500/20"
        >
          <Plus className="w-4 h-4 mr-2" />
          Avertir un Membre
        </button>
      </div>

      {/* Info Card */}
      <div className="bg-[#111827] border border-amber-900/30 p-5 rounded-xl flex items-start space-x-4 shadow-lg">
        <ShieldAlert className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-sm">
          <h3 className="font-semibold text-gray-200">Protection Automatique Configurée</h3>
          <p className="text-gray-400 mt-1">
            Chaque avertissement est consigné. Si un membre atteint le seuil maximal d'avertissements (défini dans la configuration déclarative), un mute temporaire automatique est immédiatement appliqué par le bot Discord.
          </p>
        </div>
      </div>

      {/* Warnings Table */}
      <div className="bg-[#111827] border border-gray-800 rounded-xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-gray-800 bg-[#1E293B]/40">
          <h3 className="font-semibold text-gray-200 text-sm">
            Historique des Avertissements Récents ({warnings.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-[#1E293B]/20 text-xs text-gray-400 uppercase tracking-wider border-b border-gray-800">
              <tr>
                <th className="py-3.5 px-6">Membre Sanctionné</th>
                <th className="py-3.5 px-6">Motif</th>
                <th className="py-3.5 px-6">Modérateur</th>
                <th className="py-3.5 px-6 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-gray-500">
                    Chargement des avertissements...
                  </td>
                </tr>
              ) : warnings.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-gray-500">
                    Aucun avertissement actif. Tout est en ordre !
                  </td>
                </tr>
              ) : (
                warnings.map(warn => (
                  <tr key={warn.id} className="hover:bg-gray-800/40 transition">
                    <td className="py-4 px-6 font-semibold text-gray-200 flex items-center space-x-2">
                      <User className="w-4 h-4 text-gray-500" />
                      <span>ID: {warn.userId}</span>
                    </td>
                    <td className="py-4 px-6 text-gray-300">{warn.reason}</td>
                    <td className="py-4 px-6 text-gray-400 text-xs">
                      Modérateur: {warn.moderatorId}
                    </td>
                    <td className="py-4 px-6 text-right text-gray-500 text-xs">
                      {new Date(warn.createdAt).toLocaleString('fr-FR')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Avertir */}
      <Modal
        isOpen={isWarnOpen}
        onClose={() => setIsWarnOpen(false)}
        title="Délivrer un avertissement formel"
      >
        <form onSubmit={handleWarn} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Membre
            </label>
            <select
              required
              value={targetUserId}
              onChange={e => setTargetUserId(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Sélectionner un membre...</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>
                  {m.username} ({m.nickname || 'Membre'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Motif de la sanction
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Explication claire du motif..."
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-800">
            <button
              type="button"
              onClick={() => setIsWarnOpen(false)}
              className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition"
            >
              Avertir le membre
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
