import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import {
  Layers,
  Plus,
  Users,
  Folder,
  Shield,
  Clock,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Lightbulb,
  Sparkles,
  RefreshCw,
  Send
} from 'lucide-react';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Badge } from '../components/common/Badge';

interface DepartmentData {
  id: string;
  guildId: string;
  name: string;
  shortName?: string;
  icon: string;
  color: string;
  description: string;
  leaderRoleId?: string;
  leaderRoleName?: string;
  deputyRoleId?: string;
  deputyRoleName?: string;
  memberRoleId?: string;
  memberRoleName?: string;
  categoryId?: string;
  categoryName?: string;
  isArchived: boolean;
  memberCount: number;
  pendingCount: number;
  projectCount: number;
  createdAt: string;
}

interface DepartmentMember {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  role: 'leader' | 'deputy' | 'member';
  status: 'pending' | 'approved' | 'rejected';
  motivation?: string | null;
  skills?: string | null;
  availability?: string | null;
  requestedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export const DepartmentsPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'poles' | 'candidatures'>('poles');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPanelModalOpen, setIsPanelModalOpen] = useState(false);
  const [selectedDeptForMembers, setSelectedDeptForMembers] = useState<DepartmentData | null>(null);
  const [deletingDept, setDeletingDept] = useState<DepartmentData | null>(null);

  // Panel modal state
  const [panelChannelId, setPanelChannelId] = useState('');
  const [panelTitle, setPanelTitle] = useState('🔴 CORTEX SCIENTIFIC CLUB — PÔLES & CANDIDATURES');
  const [panelDescription, setPanelDescription] = useState('');
  const [panelFeedback, setPanelFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form states for creation
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [icon, setIcon] = useState('🔬');
  const [color, setColor] = useState('#E5092E');
  const [description, setDescription] = useState('');
  const [createChannels, setCreateChannels] = useState(true);
  const [createRoles, setCreateRoles] = useState(true);
  const [createCategory, setCreateCategory] = useState(true);

  const emojiPresets = ['🔬', '🤖', '🦾', '💻', '🔭', '🧪', '🧬', '🚀', '⚛️', '🧠', '⚡', '🌐'];
  const colorPresets = ['#E5092E', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#64748B'];

  // Fetch Departments
  const { data: departments = [], isLoading } = useQuery<DepartmentData[]>({
    queryKey: ['departments', guildId],
    queryFn: () => apiFetch(`/guilds/${guildId}/departments`),
    enabled: !!guildId
  });

  // Fetch Channels for panel deployment
  const { data: channels = [] } = useQuery<any[]>({
    queryKey: ['channels', guildId],
    queryFn: () => apiFetch(`/guilds/${guildId}/channels`),
    enabled: !!guildId && isPanelModalOpen
  });

  // Fetch Members & Pending for selected department
  const { data: deptMembers = [] } = useQuery<DepartmentMember[]>({
    queryKey: ['dept-members', guildId, selectedDeptForMembers?.id],
    queryFn: () => apiFetch(`/guilds/${guildId}/departments/${selectedDeptForMembers?.id}/members`),
    enabled: !!guildId && !!selectedDeptForMembers
  });

  // Send Panel Mutation
  const sendPanelMutation = useMutation({
    mutationFn: (body: any) =>
      apiFetch(`/guilds/${guildId}/departments/send-panel`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (res: any) => {
      setPanelFeedback({ type: 'success', message: res.message || 'Panneau envoyé avec succès sur Discord !' });
      setTimeout(() => {
        setIsPanelModalOpen(false);
        setPanelFeedback(null);
      }, 2200);
    },
    onError: (err: any) => {
      setPanelFeedback({ type: 'error', message: err.message || 'Erreur lors de l\'envoi du panneau.' });
    }
  });

  // Create Department Mutation
  const createMutation = useMutation({
    mutationFn: (body: any) =>
      apiFetch(`/guilds/${guildId}/departments`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments', guildId] });
      queryClient.invalidateQueries({ queryKey: ['channels', guildId] });
      queryClient.invalidateQueries({ queryKey: ['roles', guildId] });
      setIsCreateModalOpen(false);
      resetForm();
    }
  });

  // Delete / Archive Department Mutation
  const deleteMutation = useMutation({
    mutationFn: (deptId: string) =>
      apiFetch(`/guilds/${guildId}/departments/${deptId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments', guildId] });
      queryClient.invalidateQueries({ queryKey: ['channels', guildId] });
      setDeletingDept(null);
    }
  });

  // Review Member Application Mutation
  const reviewMutation = useMutation({
    mutationFn: ({ deptId, userId, action }: { deptId: string; userId: string; action: 'approve' | 'reject' }) =>
      apiFetch(`/guilds/${guildId}/departments/${deptId}/members/${userId}/review`, {
        method: 'POST',
        body: JSON.stringify({ action })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dept-members', guildId, selectedDeptForMembers?.id] });
      queryClient.invalidateQueries({ queryKey: ['departments', guildId] });
    }
  });

  // Sync to Discord
  const syncMutation = useMutation({
    mutationFn: () => apiFetch(`/guilds/${guildId}/config/apply`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments', guildId] });
      queryClient.invalidateQueries({ queryKey: ['channels', guildId] });
      queryClient.invalidateQueries({ queryKey: ['roles', guildId] });
    }
  });

  const resetForm = () => {
    setName('');
    setShortName('');
    setIcon('🔬');
    setColor('#E5092E');
    setDescription('');
    setCreateChannels(true);
    setCreateRoles(true);
    setCreateCategory(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name,
      shortName: shortName.trim() || undefined,
      icon,
      color,
      description,
      createChannels,
      createRoles,
      createCategory
    });
  };

  const totalPending = departments.reduce((acc, d) => acc + (d.pendingCount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-100 flex items-center tracking-tight">
            <Layers className="w-6 h-6 mr-3 text-[#E5092E]" />
            Départements & Pôles Scientifiques
          </h1>
          <p className="text-sm text-gray-400">
            Structurez les pôles d'excellence du club avec rôles Discord dédiés, catégories et salons thématiques synchronisés.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              setPanelFeedback(null);
              setIsPanelModalOpen(true);
            }}
            className="flex items-center px-4 py-2 bg-[#1E1E28] hover:bg-[#282836] text-white text-sm font-bold rounded-lg transition border border-[#323246]"
            title="Envoyer un message interactif sur Discord pour recruter des membres"
          >
            <Send className="w-4 h-4 mr-2 text-[#E5092E]" />
            Panneau de Recrutement
          </button>

          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="flex items-center px-4 py-2 bg-[#121217] hover:bg-[#1A1A22] text-gray-300 text-sm font-semibold rounded-lg transition border border-[#242430]"
            title="Appliquer les départements et salons sur Discord"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin text-[#E5092E]' : 'text-gray-400'}`} />
            {syncMutation.isPending ? 'Synchronisation...' : 'Synchroniser Discord'}
          </button>

          <button
            onClick={() => {
              resetForm();
              setIsCreateModalOpen(true);
            }}
            className="flex items-center px-5 py-2 bg-[#E5092E] hover:bg-[#c00725] text-white text-sm font-bold rounded-lg transition shadow-lg shadow-[#E5092E]/25"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouveau Pôle
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-[#1C1C24] space-x-4">
        <button
          onClick={() => setActiveTab('poles')}
          className={`pb-3 text-sm font-bold flex items-center border-b-2 transition ${
            activeTab === 'poles'
              ? 'border-[#E5092E] text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <Layers className="w-4 h-4 mr-2" />
          Pôles Actifs ({departments.length})
        </button>

        <button
          onClick={() => setActiveTab('candidatures')}
          className={`pb-3 text-sm font-bold flex items-center border-b-2 transition ${
            activeTab === 'candidatures'
              ? 'border-[#E5092E] text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <Clock className="w-4 h-4 mr-2" />
          Candidatures en attente
          {totalPending > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs font-black bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full animate-pulse">
              {totalPending}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="bg-[#111827] border border-[#1C1C24] rounded-2xl p-12 text-center text-gray-500">
          Chargement des départements scientifiques...
        </div>
      ) : activeTab === 'poles' ? (
        departments.length === 0 ? (
          /* Empty State */
          <div className="bg-[#121217] border border-[#1C1C24] rounded-2xl p-12 text-center max-w-xl mx-auto shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-[#E5092E]/10 border border-[#E5092E]/30 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-[#E5092E]" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Aucun pôle scientifique configuré</h3>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              Démarrez la structure de votre club CORTEX en créant votre premier pôle scientifique (ex: <i>Intelligence Artificielle, Robotique, Aérospatial</i>).
              L'assistant créera automatiquement les rôles Discord, la catégorie et les salons de recherche en un seul clic !
            </p>
            <button
              onClick={() => {
                resetForm();
                setIsCreateModalOpen(true);
              }}
              className="px-6 py-2.5 bg-[#E5092E] hover:bg-[#c00725] text-white text-sm font-bold rounded-xl transition shadow-lg shadow-[#E5092E]/30"
            >
              Créer le premier pôle scientifique
            </button>
          </div>
        ) : (
          /* Departments Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {departments.map(dept => (
              <div
                key={dept.id}
                className="bg-[#121217] border border-[#1C1C24] hover:border-[#2E2E3C] rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 shadow-lg group relative overflow-hidden"
              >
                {/* Accent Top Bar */}
                <div
                  className="absolute top-0 left-0 right-0 h-1.5"
                  style={{ backgroundColor: dept.color || '#E5092E' }}
                />

                <div>
                  {/* Department Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center space-x-3">
                      <span className="text-3xl p-2 rounded-xl bg-[#1A1A22] border border-[#242430]">
                        {dept.icon || '🔬'}
                      </span>
                      <div>
                        <h3 className="font-extrabold text-white text-base leading-snug group-hover:text-[#E5092E] transition-colors">
                          {dept.name}
                        </h3>
                        {dept.shortName && (
                          <span
                            className="inline-block px-2 py-0.5 text-[10px] font-black rounded-md tracking-wider uppercase mt-1"
                            style={{
                              backgroundColor: `${dept.color || '#E5092E'}20`,
                              color: dept.color || '#E5092E',
                              borderColor: `${dept.color || '#E5092E'}40`
                            }}
                          >
                            PÔLE {dept.shortName}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => setDeletingDept(dept)}
                      className="p-1.5 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                      title="Archiver ce pôle"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-gray-400 line-clamp-2 mb-4 leading-relaxed">
                    {dept.description || 'Pôle scientifique actif de recherche, projets et ateliers pratiques.'}
                  </p>

                  {/* Badges / Stats */}
                  <div className="grid grid-cols-3 gap-2 py-2 border-y border-[#1C1C24] text-center my-3">
                    <div>
                      <div className="text-base font-black text-white flex items-center justify-center">
                        <Users className="w-3.5 h-3.5 mr-1 text-gray-400" />
                        {dept.memberCount || 0}
                      </div>
                      <div className="text-[10px] font-semibold text-gray-500 uppercase">Membres</div>
                    </div>

                    <div>
                      <div className="text-base font-black text-white flex items-center justify-center">
                        <Lightbulb className="w-3.5 h-3.5 mr-1 text-amber-400" />
                        {dept.projectCount || 0}
                      </div>
                      <div className="text-[10px] font-semibold text-gray-500 uppercase">Projets</div>
                    </div>

                    <div>
                      <div className="text-base font-black text-white flex items-center justify-center">
                        <Clock className="w-3.5 h-3.5 mr-1 text-[#E5092E]" />
                        {dept.pendingCount || 0}
                      </div>
                      <div className="text-[10px] font-semibold text-gray-500 uppercase">Candidatures</div>
                    </div>
                  </div>

                  {/* Discord Mappings */}
                  <div className="space-y-1.5 text-xs text-gray-400 mb-4">
                    {dept.categoryName && (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center text-gray-500">
                          <Folder className="w-3.5 h-3.5 mr-1.5 text-amber-400" /> Catégorie :
                        </span>
                        <span className="font-medium text-gray-300 truncate max-w-[150px]">{dept.categoryName}</span>
                      </div>
                    )}
                    {dept.leaderRoleName && (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center text-gray-500">
                          <Shield className="w-3.5 h-3.5 mr-1.5 text-[#E5092E]" /> Responsable :
                        </span>
                        <span className="font-medium text-gray-300 truncate max-w-[150px]">@{dept.leaderRoleName}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Action */}
                <button
                  onClick={() => setSelectedDeptForMembers(dept)}
                  className="w-full mt-2 py-2 px-3 bg-[#1A1A22] hover:bg-[#242430] border border-[#242430] text-gray-200 text-xs font-bold rounded-xl transition flex items-center justify-center space-x-2"
                >
                  <Users className="w-3.5 h-3.5 text-gray-400" />
                  <span>Gérer Membres & Candidatures ({dept.pendingCount} en attente)</span>
                </button>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Applications view across all departments */
        <div className="bg-[#121217] border border-[#1C1C24] rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-amber-400" />
            Toutes les Candidatures d'Adhésion en Attente
          </h2>

          {totalPending === 0 ? (
            <div className="text-center py-10 text-gray-500 text-sm">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500/50" />
              Toutes les candidatures ont été traitées ! Aucune adhésion en attente.
            </div>
          ) : (
            <div className="space-y-3">
              {departments.filter(d => d.pendingCount > 0).map(dept => (
                <div key={dept.id} className="border border-[#242430] bg-[#16161D] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-extrabold text-white flex items-center">
                      <span className="mr-2">{dept.icon}</span> Pôle {dept.name}
                    </span>
                    <button
                      onClick={() => setSelectedDeptForMembers(dept)}
                      className="text-xs font-bold text-[#E5092E] hover:underline flex items-center"
                    >
                      Examiner les {dept.pendingCount} candidature(s) &rarr;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Création Pôle 1 Clic */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Créer un Pôle Scientifique (1 Clic)"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
              Nom du Pôle Scientifique *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="ex: Intelligence Artificielle & Data"
              className="w-full bg-[#1A1A22] border border-[#2E2E3C] rounded-xl px-4 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-[#E5092E] transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Sigle / Abréviation
              </label>
              <input
                type="text"
                value={shortName}
                onChange={e => setShortName(e.target.value)}
                placeholder="ex: IA"
                className="w-full bg-[#1A1A22] border border-[#2E2E3C] rounded-xl px-4 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-[#E5092E] transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Icône du Pôle
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={icon}
                  onChange={e => setIcon(e.target.value)}
                  className="w-14 text-center text-lg bg-[#1A1A22] border border-[#2E2E3C] rounded-xl py-2 text-white focus:outline-none"
                />
                <div className="flex flex-wrap gap-1 max-w-[180px]">
                  {emojiPresets.map(em => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setIcon(em)}
                      className="p-1 text-sm hover:bg-[#2E2E3C] rounded-md transition"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
              Couleur Thématique
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="w-10 h-10 rounded-lg bg-transparent border-0 cursor-pointer"
              />
              <div className="flex items-center space-x-1.5">
                {colorPresets.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="w-6 h-6 rounded-full border border-gray-700 transition transform hover:scale-110"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
              Description & Objectifs
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Domaines de recherche, projets phares, compétences abordées..."
              className="w-full bg-[#1A1A22] border border-[#2E2E3C] rounded-xl px-4 py-2 text-sm text-gray-100 focus:outline-none focus:border-[#E5092E] transition"
            />
          </div>

          {/* Assistant 1 Clic Automation */}
          <div className="bg-[#1A1A22]/60 border border-[#2E2E3C] rounded-xl p-4 space-y-2.5">
            <span className="text-xs font-black text-gray-300 uppercase tracking-wider flex items-center">
              <Sparkles className="w-3.5 h-3.5 mr-1.5 text-[#E5092E]" />
              Automatisation Complète Discord & JSON
            </span>

            <label className="flex items-center space-x-3 cursor-pointer text-xs text-gray-300">
              <input
                type="checkbox"
                checked={createRoles}
                onChange={e => setCreateRoles(e.target.checked)}
                className="rounded border-[#2E2E3C] text-[#E5092E] focus:ring-[#E5092E] bg-[#121217]"
              />
              <span>Créer les 3 rôles (<b>Chef Pôle</b>, <b>Adjoint</b> et <b>Membre</b>) sur Discord</span>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer text-xs text-gray-300">
              <input
                type="checkbox"
                checked={createCategory}
                onChange={e => setCreateCategory(e.target.checked)}
                className="rounded border-[#2E2E3C] text-[#E5092E] focus:ring-[#E5092E] bg-[#121217]"
              />
              <span>Créer la catégorie Discord <b>{icon} PÔLE {name.toUpperCase() || '...'}</b></span>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer text-xs text-gray-300">
              <input
                type="checkbox"
                checked={createChannels}
                onChange={e => setCreateChannels(e.target.checked)}
                className="rounded border-[#2E2E3C] text-[#E5092E] focus:ring-[#E5092E] bg-[#121217]"
              />
              <span>Générer les salons types (#annonces, #candidatures privé, #general, #projets, #ressources, Vocal)</span>
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-3">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded-xl transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-5 py-2 bg-[#E5092E] hover:bg-[#c00725] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition shadow-md shadow-[#E5092E]/25"
            >
              {createMutation.isPending ? 'Création en cours...' : 'Créer le Pôle en 1 Clic'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Membres & Candidatures */}
      {selectedDeptForMembers && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedDeptForMembers(null)}
          title={`Membres & Candidatures — ${selectedDeptForMembers.icon} ${selectedDeptForMembers.name}`}
        >
          <div className="space-y-5">
            {/* Section Candidatures en attente */}
            <div>
              <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider mb-2 flex items-center">
                <Clock className="w-3.5 h-3.5 mr-1.5" />
                Demandes d'adhésion en attente
              </h4>

              {deptMembers.filter(m => m.status === 'pending').length === 0 ? (
                <p className="text-xs text-gray-500 italic p-3 bg-[#1A1A22] rounded-xl border border-[#242430]">
                  Aucune candidature en attente d'approbation.
                </p>
              ) : (
                <div className="space-y-3">
                  {deptMembers.filter(m => m.status === 'pending').map(mem => (
                    <div
                      key={mem.userId}
                      className="p-3.5 bg-[#1A1A22] border border-amber-500/25 rounded-xl space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {mem.avatarUrl ? (
                            <img src={mem.avatarUrl} alt="" className="w-9 h-9 rounded-full border border-gray-700" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center font-bold text-xs text-white">
                              {mem.displayName.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="text-xs font-bold text-white flex items-center">
                              {mem.displayName}
                              {mem.username && mem.username !== mem.displayName && (
                                <span className="text-[10px] text-gray-500 font-normal ml-1.5">(@{mem.username})</span>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-400">
                              Postulé le {new Date(mem.requestedAt).toLocaleDateString('fr-FR')} à {new Date(mem.requestedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => reviewMutation.mutate({ deptId: selectedDeptForMembers.id, userId: mem.userId, action: 'approve' })}
                            disabled={reviewMutation.isPending}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition flex items-center space-x-1 shadow"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            Valider
                          </button>
                          <button
                            onClick={() => reviewMutation.mutate({ deptId: selectedDeptForMembers.id, userId: mem.userId, action: 'reject' })}
                            disabled={reviewMutation.isPending}
                            className="px-3 py-1.5 bg-gray-800 hover:bg-rose-600 text-gray-300 hover:text-white text-xs font-bold rounded-lg transition flex items-center space-x-1"
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" />
                            Refuser
                          </button>
                        </div>
                      </div>

                      {mem.availability && (
                        <div className="inline-flex items-center text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20">
                          ⏱️ Temps disponible : {mem.availability}
                        </div>
                      )}

                      {mem.motivation && (
                        <div className="text-xs text-gray-300 p-2.5 bg-[#14141B] rounded-lg border border-[#242430]">
                          <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">🎯 Motivation :</span>
                          <p className="whitespace-pre-wrap">{mem.motivation}</p>
                        </div>
                      )}

                      {mem.skills && (
                        <div className="text-xs text-gray-300 p-2.5 bg-[#14141B] rounded-lg border border-[#242430]">
                          <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">🛠️ Compétences & Projets :</span>
                          <p className="whitespace-pre-wrap">{mem.skills}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section Membres approuvés */}
            <div>
              <h4 className="text-xs font-black text-gray-300 uppercase tracking-wider mb-2 flex items-center">
                <Users className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
                Membres actifs du pôle ({deptMembers.filter(m => m.status === 'approved').length})
              </h4>

              <div className="max-h-60 overflow-y-auto space-y-2">
                {deptMembers.filter(m => m.status === 'approved').map(mem => (
                  <div
                    key={mem.userId}
                    className="flex items-center justify-between p-2.5 bg-[#1A1A22] border border-[#242430] rounded-xl text-xs"
                  >
                    <div className="flex items-center space-x-3">
                      {mem.avatarUrl ? (
                        <img src={mem.avatarUrl} alt="" className="w-7 h-7 rounded-full" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center font-bold text-xs text-white">
                          {mem.displayName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-white">{mem.displayName}</div>
                        <div className="text-[10px] text-gray-400">
                          {mem.role === 'leader' ? '🎖️ Responsable de Pôle' : (mem.role === 'deputy' ? '🥈 Adjoint de Pôle' : 'Membre')}
                        </div>
                      </div>
                    </div>

                    <Badge variant={mem.role === 'leader' ? 'red' : (mem.role === 'deputy' ? 'blue' : 'gray')}>
                      {mem.role === 'leader' ? 'Chef' : (mem.role === 'deputy' ? 'Adjoint' : 'Membre')}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedDeptForMembers(null)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded-xl transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Panneau de Recrutement Discord */}
      <Modal
        isOpen={isPanelModalOpen}
        onClose={() => setIsPanelModalOpen(false)}
        title="📢 Déployer le Panneau de Recrutement sur Discord"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendPanelMutation.mutate({
              channelId: panelChannelId,
              title: panelTitle,
              description: panelDescription || undefined
            });
          }}
          className="space-y-4"
        >
          {panelFeedback && (
            <div
              className={`p-3 rounded-xl text-xs font-bold flex items-center ${
                panelFeedback.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}
            >
              {panelFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 mr-2 text-rose-400" />
              )}
              {panelFeedback.message}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
              Salon Discord d'affichage *
            </label>
            <select
              required
              value={panelChannelId}
              onChange={(e) => setPanelChannelId(e.target.value)}
              className="w-full bg-[#1A1A22] border border-[#2E2E3C] rounded-xl px-4 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-[#E5092E] transition"
            >
              <option value="">Sélectionnez un salon textuel...</option>
              {channels
                .filter((c: any) => c.type === 'text' || c.type === 0)
                .map((c: any) => (
                  <option key={c.id} value={c.id}>
                    #{c.name}
                  </option>
                ))}
            </select>
            <p className="text-[11px] text-gray-500 mt-1">
              Les membres y verront l'embed avec les boutons et le menu déroulant de choix de pôle.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
              Titre du Panneau
            </label>
            <input
              type="text"
              value={panelTitle}
              onChange={(e) => setPanelTitle(e.target.value)}
              placeholder="🔴 CORTEX SCIENTIFIC CLUB — PÔLES & CANDIDATURES"
              className="w-full bg-[#1A1A22] border border-[#2E2E3C] rounded-xl px-4 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-[#E5092E] transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
              Description personnalisée (optionnel)
            </label>
            <textarea
              rows={3}
              value={panelDescription}
              onChange={(e) => setPanelDescription(e.target.value)}
              placeholder="Laissez vide pour afficher le texte explicatif officiel CORTEX."
              className="w-full bg-[#1A1A22] border border-[#2E2E3C] rounded-xl px-4 py-2 text-sm text-gray-100 focus:outline-none focus:border-[#E5092E] transition resize-none"
            />
          </div>

          <div className="p-3 bg-[#1A1A22] rounded-xl border border-[#2E2E3C] text-xs text-gray-400">
            <span className="font-bold text-white block mb-1">💡 Expérience membre Discord :</span>
            Un embed CORTEX récapitule vos {departments.length} pôle(s) actif(s). Le membre sélectionne un pôle, ce qui ouvre instantanément un <strong>formulaire modal Discord</strong> (Motivations, Compétences & Projets, Disponibilité). Sa candidature apparaîtra ensuite ici et dans votre salon de modération !
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={() => setIsPanelModalOpen(false)}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded-xl transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={sendPanelMutation.isPending || !panelChannelId}
              className="px-5 py-2 bg-[#E5092E] hover:bg-[#c00725] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition shadow-md shadow-[#E5092E]/25 flex items-center"
            >
              <Send className="w-3.5 h-3.5 mr-2" />
              {sendPanelMutation.isPending ? 'Envoi en cours...' : 'Envoyer dans le salon'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmation d'Archivage / Suppression */}
      {deletingDept && (
        <ConfirmDialog
          isOpen={true}
          title={`Archiver le pôle "${deletingDept.name}" ?`}
          message="Conformément à la politique de sécurité CORTEX, les salons Discord seront conservés et déplacés dans la catégorie '🗄️ ARCHIVES CORTEX' en lecture seule. Les messages et historiques ne seront pas perdus."
          confirmLabel="Archiver le pôle"
          danger={true}
          onConfirm={() => deleteMutation.mutate(deletingDept.id)}
          onClose={() => setDeletingDept(null)}
        />
      )}
    </div>
  );
};
