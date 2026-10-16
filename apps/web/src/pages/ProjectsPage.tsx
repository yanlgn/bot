import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { ProjectRecord, DiscordMemberData } from '@sciclub/shared';
import { Rocket, Plus, Hash, UserCheck, CheckCircle2 } from 'lucide-react';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';

export const ProjectsPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const queryClient = useQueryClient();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [leaderId, setLeaderId] = useState('');
  const [createChannel, setCreateChannel] = useState(true);

  const { data: projects = [], isLoading } = useQuery<ProjectRecord[]>({
    queryKey: ['projects', guildId],
    queryFn: () => apiFetch(`/guilds/${guildId}/projects`),
    enabled: !!guildId
  });

  const { data: members = [] } = useQuery<DiscordMemberData[]>({
    queryKey: ['members', guildId],
    queryFn: () => apiFetch(`/guilds/${guildId}/members`),
    enabled: !!guildId
  });

  const createMutation = useMutation({
    mutationFn: (newPrj: any) =>
      apiFetch(`/guilds/${guildId}/projects`, { method: 'POST', body: JSON.stringify(newPrj) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', guildId] });
      setIsCreateOpen(false);
      setName('');
      setDescription('');
      setLeaderId('');
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ projectId, status }: { projectId: string; status: string }) =>
      apiFetch(`/guilds/${guildId}/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects', guildId] })
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name,
      description,
      leaderId,
      memberIds: [],
      createChannel
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'idea': return <Badge variant="purple">💡 Idée</Badge>;
      case 'in_progress': return <Badge variant="blue">⚙️ En Cours</Badge>;
      case 'paused': return <Badge variant="amber">⏸️ En Pause</Badge>;
      case 'completed': return <Badge variant="green">✅ Terminé</Badge>;
      case 'archived': return <Badge variant="gray">📦 Archivé</Badge>;
      default: return <Badge variant="gray">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center">
            <Rocket className="w-6 h-6 mr-3 text-blue-400" />
            Projets Scientifiques & Recherches
          </h1>
          <p className="text-sm text-gray-400">
            Coordonnez les groupes de recherche, ateliers d'innovation et salons Discord restreints dédiés.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition shadow-md shadow-blue-500/20"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nouveau Projet
        </button>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full py-12 text-center text-gray-500">
            Chargement des projets...
          </div>
        ) : projects.length === 0 ? (
          <div className="col-span-full py-12 text-center text-gray-500 bg-[#111827] border border-gray-800 rounded-xl">
            Aucun projet scientifique enregistré pour le moment.
          </div>
        ) : (
          projects.map(project => (
            <div
              key={project.id}
              className="bg-[#111827] border border-gray-800 rounded-xl p-6 shadow-xl flex flex-col justify-between hover:border-gray-700 transition"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-lg text-gray-100">{project.name}</h3>
                  {getStatusBadge(project.status)}
                </div>

                <p className="text-sm text-gray-400 mb-4 line-clamp-3">
                  {project.description}
                </p>

                <div className="space-y-2 text-xs text-gray-400 mb-6 bg-gray-900/60 p-3 rounded-lg border border-gray-800">
                  <div className="flex items-center">
                    <UserCheck className="w-4 h-4 text-emerald-400 mr-2" />
                    <span>Chef de projet : </span>
                    <strong className="text-gray-200 ml-1">ID: {project.leaderId}</strong>
                  </div>
                  {project.channelId && (
                    <div className="flex items-center">
                      <Hash className="w-4 h-4 text-blue-400 mr-2" />
                      <span>Salon privé : </span>
                      <strong className="text-blue-400 ml-1">#{project.channelId}</strong>
                    </div>
                  )}
                  <div className="flex items-center">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 mr-2" />
                    <span>Membres : {project.memberIds?.length || 1} contributeur(s)</span>
                  </div>
                </div>
              </div>

              {/* Status Change Selector */}
              <div className="pt-4 border-t border-gray-800 flex items-center justify-between">
                <span className="text-xs text-gray-500">Modifier le statut :</span>
                <select
                  value={project.status}
                  onChange={e =>
                    updateStatusMutation.mutate({
                      projectId: project.id,
                      status: e.target.value
                    })
                  }
                  className="bg-gray-800 border border-gray-700 text-xs text-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="idea">Idée</option>
                  <option value="in_progress">En Cours</option>
                  <option value="paused">En Pause</option>
                  <option value="completed">Terminé</option>
                  <option value="archived">Archivé</option>
                </select>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Création Projet */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Créer un nouveau projet scientifique"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Nom du Projet
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: Rover Autonome ROS2"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Chef de Projet (Leader)
            </label>
            <select
              required
              value={leaderId}
              onChange={e => setLeaderId(e.target.value)}
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
              Description & Objectifs
            </label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Objectifs scientifiques, matériel requis, calendrier estimé..."
            />
          </div>

          <label className="flex items-center space-x-2 cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={createChannel}
              onChange={e => setCreateChannel(e.target.checked)}
              className="rounded bg-gray-900 border-gray-700 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-300">
              Créer automatiquement un salon textuel Discord privé réservé à l'équipe
            </span>
          </label>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-800">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
            >
              Créer le projet
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
