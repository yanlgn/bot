import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { DiscordChannelData } from '@sciclub/shared';
import { Hash, Volume2, Folder, MessagesSquare, Plus, Lock, Unlock, Trash2, Edit3 } from 'lucide-react';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

export const ChannelsPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const queryClient = useQueryClient();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<DiscordChannelData | null>(null);
  const [deletingChannelId, setDeletingChannelId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [type, setType] = useState<'text' | 'voice' | 'category' | 'forum'>('text');
  const [parentId, setParentId] = useState<string>('');
  const [topic, setTopic] = useState('');
  const [slowmode, setSlowmode] = useState(0);

  const { data: channels = [], isLoading } = useQuery<DiscordChannelData[]>({
    queryKey: ['channels', guildId],
    queryFn: () => apiFetch(`/guilds/${guildId}/channels`),
    enabled: !!guildId
  });

  const categories = channels.filter(c => c.type === 'category');

  const createChannelMutation = useMutation({
    mutationFn: (newChannel: any) =>
      apiFetch(`/guilds/${guildId}/channels`, { method: 'POST', body: JSON.stringify(newChannel) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels', guildId] });
      setIsCreateModalOpen(false);
      resetForm();
    }
  });

  const updateChannelMutation = useMutation({
    mutationFn: ({ channelId, data }: { channelId: string; data: any }) =>
      apiFetch(`/guilds/${guildId}/channels/${channelId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels', guildId] });
      setEditingChannel(null);
      resetForm();
    }
  });

  const deleteChannelMutation = useMutation({
    mutationFn: (channelId: string) =>
      apiFetch(`/guilds/${guildId}/channels/${channelId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels', guildId] });
      setDeletingChannelId(null);
    }
  });

  const resetForm = () => {
    setName('');
    setType('text');
    setParentId('');
    setTopic('');
    setSlowmode(0);
  };

  const handleOpenEdit = (ch: DiscordChannelData) => {
    setEditingChannel(ch);
    setName(ch.name);
    setParentId(ch.parentId || '');
    setTopic(ch.topic || '');
    setSlowmode(ch.rateLimitPerUser || 0);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingChannel) {
      updateChannelMutation.mutate({
        channelId: editingChannel.id,
        data: {
          name,
          parentId: parentId || null,
          topic,
          rateLimitPerUser: Number(slowmode)
        }
      });
    } else {
      createChannelMutation.mutate({
        name,
        type,
        parentId: parentId || null,
        topic,
        rateLimitPerUser: Number(slowmode)
      });
    }
  };

  const getChannelIcon = (chType: string) => {
    switch (chType) {
      case 'voice': return <Volume2 className="w-4 h-4 text-emerald-400" />;
      case 'category': return <Folder className="w-4 h-4 text-amber-400" />;
      case 'forum': return <MessagesSquare className="w-4 h-4 text-purple-400" />;
      default: return <Hash className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center">
            <Hash className="w-6 h-6 mr-3 text-blue-400" />
            Salons & Pôles Scientifiques
          </h1>
          <p className="text-sm text-gray-400">
            Structurez les catégories et les espaces de travail thématiques de votre club scientifique.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              resetForm();
              setType('category');
              setIsCreateModalOpen(true);
            }}
            className="flex items-center px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium rounded-lg transition border border-gray-700"
          >
            <Folder className="w-4 h-4 mr-2 text-amber-400" />
            Nouvelle Catégorie
          </button>
          <button
            onClick={() => {
              resetForm();
              setType('text');
              setIsCreateModalOpen(true);
            }}
            className="flex items-center px-4 py-2 bg-[#E5092E] hover:bg-[#c00725] text-white text-sm font-medium rounded-lg transition shadow-md shadow-[#E5092E]/20"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouveau Salon
          </button>
        </div>
      </div>

      {/* Channels List by Category */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="bg-[#111827] border border-gray-800 rounded-xl p-8 text-center text-gray-500">
            Chargement des salons Discord...
          </div>
        ) : (
          channels.map(channel => (
            <div
              key={channel.id}
              className={`bg-[#111827] border ${
                channel.type === 'category' ? 'border-gray-700 bg-[#1E293B]/40' : 'border-gray-800'
              } rounded-xl p-4 flex items-center justify-between hover:border-gray-700 transition`}
            >
              <div className="flex items-center space-x-3">
                {getChannelIcon(channel.type)}
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-gray-200">
                      {channel.type === 'category' ? channel.name.toUpperCase() : channel.name}
                    </span>
                    <Badge variant="gray">{channel.type}</Badge>
                    {channel.parentName && (
                      <span className="text-xs text-gray-500">📁 {channel.parentName}</span>
                    )}
                  </div>
                  {channel.topic && (
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{channel.topic}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {channel.type === 'text' && (
                  <button
                    onClick={() =>
                      updateChannelMutation.mutate({
                        channelId: channel.id,
                        data: { isLocked: true }
                      })
                    }
                    title="Verrouiller le salon"
                    className="p-1.5 text-gray-400 hover:text-amber-400 hover:bg-gray-800 rounded-lg transition"
                  >
                    <Lock className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={() => handleOpenEdit(channel)}
                  title="Modifier"
                  className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-800 rounded-lg transition"
                >
                  <Edit3 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setDeletingChannelId(channel.id)}
                  title="Supprimer"
                  className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-gray-800 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Créer / Modifier Salon */}
      <Modal
        isOpen={isCreateModalOpen || !!editingChannel}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingChannel(null);
          resetForm();
        }}
        title={editingChannel ? `Modifier le salon #${editingChannel.name}` : 'Créer un nouveau salon'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Nom du Salon
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="ex: atelier-robotique"
            />
          </div>

          {!editingChannel && (
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Type de Salon
              </label>
              <select
                value={type}
                onChange={e => setType(e.target.value as any)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="text">Texte (#)</option>
                <option value="voice">Vocal (🔊)</option>
                <option value="category">Catégorie (📁)</option>
                <option value="forum">Forum (💬)</option>
              </select>
            </div>
          )}

          {type !== 'category' && (
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Catégorie Parente
              </label>
              <select
                value={parentId}
                onChange={e => setParentId(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Aucune catégorie (Racine)</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    📁 {cat.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {type === 'text' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Description / Sujet
                </label>
                <textarea
                  rows={2}
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Objectif du salon..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Mode Lent (Slowmode en secondes : 0 = désactivé)
                </label>
                <input
                  type="number"
                  min={0}
                  max={21600}
                  value={slowmode}
                  onChange={e => setSlowmode(Number(e.target.value))}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-800">
            <button
              type="button"
              onClick={() => {
                setIsCreateModalOpen(false);
                setEditingChannel(null);
                resetForm();
              }}
              className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-lg transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
            >
              {editingChannel ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deletingChannelId}
        onClose={() => setDeletingChannelId(null)}
        onConfirm={() => deletingChannelId && deleteChannelMutation.mutate(deletingChannelId)}
        title="Supprimer ce salon ?"
        message="Attention : cette action supprimera définitivement le salon ainsi que l'intégralité de son historique de messages sur Discord."
        confirmLabel="Supprimer définitivement"
      />
    </div>
  );
};
