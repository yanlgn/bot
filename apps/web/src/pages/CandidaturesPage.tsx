import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import {
  UserPlus,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Hash,
  Shield,
  Sparkles,
  Search,
  RefreshCw,
  Trash2,
  GraduationCap
} from 'lucide-react';
import { Modal } from '../components/common/Modal';

interface CandidatureConfig {
  guildId: string;
  submissionChannelId: string | null;
  submissionChannelName: string | null;
  reviewChannelId: string | null;
  reviewChannelName: string | null;
  memberRoleId: string | null;
  memberRoleName: string | null;
  panelMessageId: string | null;
  title: string;
  description: string;
  updatedAt: string | null;
}

interface CandidatureItem {
  id: string;
  guildId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  studyField: string;
  motivation: string;
  interests: string;
  availability?: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  discordMessageId?: string | null;
  reviewNotes?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
}

export const CandidaturesPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'inbox' | 'config'>('inbox');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Config Form state
  const [subChannelId, setSubChannelId] = useState('');
  const [revChannelId, setRevChannelId] = useState('');
  const [memberRoleId, setMemberRoleId] = useState('');
  const [panelTitle, setPanelTitle] = useState('🔴 CORTEX SCIENTIFIC CLUB — RECRUTEMENT OFFICIEL');
  const [panelDescription, setPanelDescription] = useState('');
  const [deployFeedback, setDeployFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Review Modal state
  const [selectedCand, setSelectedCand] = useState<CandidatureItem | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [reviewNotes, setReviewNotes] = useState('');

  // 1. Fetch Candidatures Config
  const { data: configData, isLoading: isConfigLoading } = useQuery<{ success: boolean; data: CandidatureConfig }>({
    queryKey: ['candidatures-config', guildId],
    queryFn: () => apiFetch(`/guilds/${guildId}/candidatures/config`),
    enabled: !!guildId
  });

  const config = configData?.data;

  React.useEffect(() => {
    if (config) {
      if (config.submissionChannelId) setSubChannelId(config.submissionChannelId);
      if (config.reviewChannelId) setRevChannelId(config.reviewChannelId);
      if (config.memberRoleId) setMemberRoleId(config.memberRoleId);
      if (config.title) setPanelTitle(config.title);
      if (config.description) setPanelDescription(config.description);
    }
  }, [config]);

  // 2. Fetch Channels and Roles
  const { data: channels = [] } = useQuery<any[]>({
    queryKey: ['channels', guildId],
    queryFn: () => apiFetch(`/guilds/${guildId}/channels`),
    enabled: !!guildId
  });

  const { data: roles = [] } = useQuery<any[]>({
    queryKey: ['roles', guildId],
    queryFn: () => apiFetch(`/guilds/${guildId}/roles`),
    enabled: !!guildId
  });

  // 3. Fetch Deployed Panels
  const { data: deployedPanels = [] } = useQuery<any[]>({
    queryKey: ['candidatures-panels', guildId],
    queryFn: () => apiFetch(`/guilds/${guildId}/candidatures/panels`),
    enabled: !!guildId
  });

  // 4. Fetch Candidatures List
  const { data: candidaturesData, isLoading: isCandidaturesLoading } = useQuery<{ success: boolean; data: CandidatureItem[] }>({
    queryKey: ['candidatures', guildId, statusFilter],
    queryFn: () => apiFetch(`/guilds/${guildId}/candidatures?status=${statusFilter}`),
    enabled: !!guildId
  });

  const candidatures = candidaturesData?.data || [];

  // Deploy Panel Mutation
  const deployMutation = useMutation({
    mutationFn: (body: any) =>
      apiFetch(`/guilds/${guildId}/candidatures/send-panel`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (res: any) => {
      setDeployFeedback({ type: 'success', message: res.message || 'Panneau de recrutement déployé avec succès sur Discord !' });
      queryClient.invalidateQueries({ queryKey: ['candidatures-config', guildId] });
      queryClient.invalidateQueries({ queryKey: ['candidatures-panels', guildId] });
      setTimeout(() => setDeployFeedback(null), 3500);
    },
    onError: (err: any) => {
      setDeployFeedback({ type: 'error', message: err.message || 'Erreur lors du déploiement.' });
    }
  });

  // Delete Panel Mutation
  const deletePanelMutation = useMutation({
    mutationFn: (panelId: string) =>
      apiFetch(`/guilds/${guildId}/candidatures/panels/${panelId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidatures-panels', guildId] });
    }
  });

  // Review Candidature Mutation
  const reviewMutation = useMutation({
    mutationFn: ({ id, action, reviewNotes }: { id: string; action: 'approve' | 'reject'; reviewNotes?: string }) =>
      apiFetch(`/guilds/${guildId}/candidatures/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ action, reviewNotes })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidatures', guildId] });
      setSelectedCand(null);
      setReviewNotes('');
    }
  });

  const handleDeploySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    deployMutation.mutate({
      submissionChannelId: subChannelId,
      reviewChannelId: revChannelId,
      memberRoleId: memberRoleId || undefined,
      title: panelTitle,
      description: panelDescription || undefined
    });
  };

  const openReviewModal = (cand: CandidatureItem, action: 'approve' | 'reject') => {
    setSelectedCand(cand);
    setReviewAction(action);
    setReviewNotes('');
  };

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCand) return;
    reviewMutation.mutate({
      id: selectedCand.id,
      action: reviewAction,
      reviewNotes: reviewNotes.trim() || undefined
    });
  };

  const filteredCandidatures = candidatures.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return c.displayName.toLowerCase().includes(q) ||
           c.studyField.toLowerCase().includes(q) ||
           c.motivation.toLowerCase().includes(q) ||
           c.interests.toLowerCase().includes(q);
  });

  const pendingCount = candidatures.filter(c => c.status === 'pending').length;
  const acceptedCount = candidatures.filter(c => c.status === 'accepted').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-100 flex items-center tracking-tight">
            <UserPlus className="w-6 h-6 mr-3 text-[#E5092E]" />
            Candidatures & Recrutement Club
          </h1>
          <p className="text-sm text-gray-400">
            Gérez les demandes d'adhésion officielle à CORTEX, déployez le panneau de recrutement interactif et attribuez les rôles Discord en 1 clic.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setActiveTab('config')}
            className={`flex items-center px-4 py-2 text-sm font-bold rounded-lg transition border ${
              activeTab === 'config'
                ? 'bg-[#E5092E] text-white border-[#E5092E]'
                : 'bg-[#1E1E28] hover:bg-[#282836] text-gray-300 border-[#323246]'
            }`}
          >
            <Send className="w-4 h-4 mr-2" />
            Déploiement Discord
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-[#1C1C24] space-x-4">
        <button
          onClick={() => setActiveTab('inbox')}
          className={`pb-3 text-sm font-bold flex items-center border-b-2 transition ${
            activeTab === 'inbox'
              ? 'border-[#E5092E] text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Candidatures Reçues ({candidatures.length})
          {pendingCount > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs font-black bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full animate-pulse">
              {pendingCount} en attente
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('config')}
          className={`pb-3 text-sm font-bold flex items-center border-b-2 transition ${
            activeTab === 'config'
              ? 'border-[#E5092E] text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <Send className="w-4 h-4 mr-2 text-blue-400" />
          Panneau de Recrutement Discord
        </button>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'config' ? (
        /* Configuration & Deployment View */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Form */}
          <div className="lg:col-span-7 bg-[#121217] border border-[#1C1C24] rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center">
                <Sparkles className="w-5 h-5 mr-2 text-[#E5092E]" />
                Déployer le Panneau de Candidature Club
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Configurez le message interactif permettant aux nouveaux arrivants de postuler pour intégrer CORTEX Scientific Club.
              </p>
            </div>

            {deployFeedback && (
              <div
                className={`p-3.5 rounded-xl text-xs font-bold flex items-center ${
                  deployFeedback.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                {deployFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 mr-2 text-rose-400 shrink-0" />
                )}
                {deployFeedback.message}
              </div>
            )}

            <form onSubmit={handleDeploySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  1. Salon Discord d'affichage public (ex: #bienvenue, #recrutement) *
                </label>
                <select
                  required
                  value={subChannelId}
                  onChange={e => setSubChannelId(e.target.value)}
                  className="w-full bg-[#1A1A22] border border-[#2E2E3C] rounded-xl px-4 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-[#E5092E] transition"
                >
                  <option value="">Sélectionnez le salon d'envoi...</option>
                  {channels
                    .filter((c: any) => c.type === 'text' || c.type === 0)
                    .map((c: any) => (
                      <option key={c.id} value={c.id}>
                        #{c.name}
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  Les membres y verront l'embed et le bouton <b>📝 Déposer une candidature</b>.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  2. Salon Discord de réception (Staff / Modération) *
                </label>
                <select
                  required
                  value={revChannelId}
                  onChange={e => setRevChannelId(e.target.value)}
                  className="w-full bg-[#1A1A22] border border-[#2E2E3C] rounded-xl px-4 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-[#E5092E] transition"
                >
                  <option value="">Sélectionnez le salon de réception staff (ex: #recrutement-staff)...</option>
                  {channels
                    .filter((c: any) => c.type === 'text' || c.type === 0)
                    .map((c: any) => (
                      <option key={c.id} value={c.id}>
                        #{c.name}
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  Le bot y publiera chaque candidature avec les boutons ✅ Valider et ❌ Refuser.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  3. Rôle Discord Membre attribué lors de l'approbation
                </label>
                <select
                  value={memberRoleId}
                  onChange={e => setMemberRoleId(e.target.value)}
                  className="w-full bg-[#1A1A22] border border-[#2E2E3C] rounded-xl px-4 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-[#E5092E] transition"
                >
                  <option value="">Détection automatique (Rôle contenant "Membre")...</option>
                  {roles.map((r: any) => (
                    <option key={r.id} value={r.id}>
                      @{r.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  Ce rôle sera immédiatement conféré au candidat dès validation de son adhésion.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  Titre du Panneau
                </label>
                <input
                  type="text"
                  value={panelTitle}
                  onChange={e => setPanelTitle(e.target.value)}
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
                  onChange={e => setPanelDescription(e.target.value)}
                  placeholder="Laissez vide pour utiliser le texte officiel CORTEX..."
                  className="w-full bg-[#1A1A22] border border-[#2E2E3C] rounded-xl px-4 py-2 text-sm text-gray-100 focus:outline-none focus:border-[#E5092E] transition resize-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={deployMutation.isPending || !subChannelId || !revChannelId}
                  className="w-full py-3 bg-[#E5092E] hover:bg-[#c00725] disabled:opacity-50 text-white text-sm font-bold rounded-xl transition shadow-lg shadow-[#E5092E]/25 flex items-center justify-center space-x-2"
                >
                  <Send className="w-4 h-4" />
                  <span>{deployMutation.isPending ? 'Déploiement en cours...' : 'Déployer le Panneau de Recrutement'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Status & Preview Card */}
          <div className="lg:col-span-5 space-y-5">
            {/* Active Status */}
            <div className="bg-[#121217] border border-[#1C1C24] rounded-2xl p-5">
              <h3 className="text-xs font-black text-gray-300 uppercase tracking-wider mb-3 flex items-center">
                <Shield className="w-4 h-4 mr-1.5 text-[#E5092E]" />
                Configuration Actuelle
              </h3>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-[#171720] rounded-xl border border-[#242430]">
                  <div className="text-gray-400 text-[11px] mb-1">Salon d'envoi public :</div>
                  <div className="text-white font-bold flex items-center">
                    <Hash className="w-3.5 h-3.5 mr-1 text-[#E5092E]" />
                    {config?.submissionChannelName ? `#${config.submissionChannelName}` : 'Non configuré'}
                  </div>
                </div>

                <div className="p-3 bg-[#171720] rounded-xl border border-[#242430]">
                  <div className="text-gray-400 text-[11px] mb-1">Salon de réception staff :</div>
                  <div className="text-white font-bold flex items-center">
                    <Hash className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                    {config?.reviewChannelName ? `#${config.reviewChannelName}` : 'Non configuré'}
                  </div>
                </div>

                <div className="p-3 bg-[#171720] rounded-xl border border-[#242430]">
                  <div className="text-gray-400 text-[11px] mb-1">Rôle Membre attribué :</div>
                  <div className="text-white font-bold flex items-center">
                    <Shield className="w-3.5 h-3.5 mr-1 text-blue-400" />
                    {config?.memberRoleName ? `@${config.memberRoleName}` : 'Détection automatique'}
                  </div>
                </div>

                {deployedPanels.length > 0 && (
                  <div className="pt-2">
                    <div className="text-[11px] font-bold text-gray-300 mb-2">
                      Panneaux déployés ({deployedPanels.length}) :
                    </div>
                    <div className="space-y-1.5">
                      {deployedPanels.map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between p-2 bg-[#1A1A24] rounded-lg text-xs">
                          <span className="font-semibold text-white">#{p.channelName}</span>
                          <button
                            onClick={() => deletePanelMutation.mutate(p.id)}
                            className="p-1 text-gray-400 hover:text-rose-400 transition"
                            title="Supprimer ce panneau"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Discord Visual Preview */}
            <div className="bg-[#121217] border border-[#1C1C24] rounded-2xl p-5">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                Aperçu du Panneau Discord
              </span>

              <div className="bg-[#2B2D31] rounded-lg p-3.5 border-l-4 border-[#E5092E] space-y-2 text-xs">
                <div className="font-bold text-white text-sm">
                  {panelTitle || '🔴 CORTEX SCIENTIFIC CLUB — RECRUTEMENT OFFICIEL'}
                </div>
                <div className="text-gray-300 leading-relaxed text-[11px]">
                  {panelDescription || '🔬 Rejoignez l\'aventure scientifique et technique CORTEX ! Cliquez sur le bouton ci-dessous pour déposer votre candidature.'}
                </div>
                <div className="text-[10px] text-gray-400 pt-1">
                  CORTEX Scientific Club • Recrutements ouverts
                </div>
              </div>

              <div className="mt-2.5">
                <div className="w-full py-2 bg-[#10B981] text-white text-xs font-bold rounded flex items-center justify-center space-x-1.5 opacity-90 cursor-default">
                  <span>📝</span>
                  <span>Déposer une candidature</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Inbox View */
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#121217] border border-[#1C1C24] p-3 rounded-2xl">
            <div className="flex items-center space-x-2 overflow-x-auto">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  statusFilter === 'all'
                    ? 'bg-[#E5092E] text-white'
                    : 'text-gray-400 hover:text-white bg-[#1A1A22]'
                }`}
              >
                Toutes ({candidatures.length})
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                  statusFilter === 'pending'
                    ? 'bg-amber-500 text-black'
                    : 'text-amber-400 hover:text-amber-300 bg-amber-500/10'
                }`}
              >
                <span>En attente</span>
                {pendingCount > 0 && <span className="px-1.5 py-0.2 bg-black/20 rounded-full text-[10px]">{pendingCount}</span>}
              </button>
              <button
                onClick={() => setStatusFilter('accepted')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  statusFilter === 'accepted'
                    ? 'bg-emerald-600 text-white'
                    : 'text-emerald-400 hover:text-emerald-300 bg-emerald-500/10'
                }`}
              >
                Acceptées ({acceptedCount})
              </button>
              <button
                onClick={() => setStatusFilter('rejected')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  statusFilter === 'rejected'
                    ? 'bg-rose-600 text-white'
                    : 'text-rose-400 hover:text-rose-300 bg-rose-500/10'
                }`}
              >
                Refusées
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher par nom, filière..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-[#1A1A22] border border-[#2E2E3C] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#E5092E] w-full sm:w-64"
              />
            </div>
          </div>

          {/* Candidatures List */}
          {isCandidaturesLoading ? (
            <div className="p-12 text-center text-gray-500 bg-[#121217] rounded-2xl border border-[#1C1C24]">
              Chargement des candidatures...
            </div>
          ) : filteredCandidatures.length === 0 ? (
            <div className="p-12 text-center text-gray-500 bg-[#121217] rounded-2xl border border-[#1C1C24] space-y-2">
              <UserPlus className="w-8 h-8 mx-auto text-gray-600" />
              <div className="text-white font-bold text-sm">Aucune candidature trouvée</div>
              <p className="text-xs text-gray-500">
                {statusFilter === 'all'
                  ? 'Aucun membre n\'a encore postulé. Déployez le panneau de recrutement pour lancer votre campagne !'
                  : 'Aucune candidature pour ce filtre.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCandidatures.map(cand => {
                const isPending = cand.status === 'pending';
                const isAccepted = cand.status === 'accepted';
                const isRejected = cand.status === 'rejected';

                return (
                  <div
                    key={cand.id}
                    className="p-5 bg-[#121217] border border-[#1C1C24] hover:border-[#2C2C3C] rounded-2xl transition space-y-3.5 shadow-lg relative overflow-hidden"
                  >
                    {/* Status side bar */}
                    <div
                      className={`absolute left-0 top-0 bottom-0 w-1 ${
                        isAccepted ? 'bg-emerald-500' : isRejected ? 'bg-rose-500' : 'bg-amber-500'
                      }`}
                    />

                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center space-x-3">
                        {cand.avatarUrl ? (
                          <img src={cand.avatarUrl} alt="" className="w-10 h-10 rounded-full border border-gray-700" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center font-bold text-xs text-white">
                            {cand.displayName.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-bold text-white flex items-center">
                            {cand.displayName}
                            {cand.username && cand.username !== cand.displayName && (
                              <span className="text-[11px] text-gray-500 font-normal ml-2">(@{cand.username})</span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-400 flex items-center space-x-2">
                            <span className="flex items-center text-blue-400 font-semibold">
                              <GraduationCap className="w-3.5 h-3.5 mr-1" />
                              {cand.studyField}
                            </span>
                            <span>•</span>
                            <span>Postulé le {new Date(cand.createdAt).toLocaleDateString('fr-FR')}</span>
                          </div>
                        </div>
                      </div>

                      {/* Status & Review Buttons */}
                      <div className="flex items-center space-x-2 self-start sm:self-auto">
                        <span
                          className={`px-2.5 py-1 text-xs font-bold rounded-lg flex items-center ${
                            isAccepted
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : isRejected
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {isAccepted && <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                          {isRejected && <XCircle className="w-3.5 h-3.5 mr-1" />}
                          {isPending && <Clock className="w-3.5 h-3.5 mr-1" />}
                          {isAccepted ? 'Adhésion Validée' : isRejected ? 'Refusée' : 'En attente d\'examen'}
                        </span>

                        {isPending && (
                          <div className="flex items-center space-x-1.5">
                            <button
                              onClick={() => openReviewModal(cand, 'approve')}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition flex items-center shadow"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                              Valider
                            </button>
                            <button
                              onClick={() => openReviewModal(cand, 'reject')}
                              className="px-3 py-1 bg-gray-800 hover:bg-rose-600 text-gray-300 hover:text-white text-xs font-bold rounded-lg transition flex items-center"
                            >
                              <XCircle className="w-3.5 h-3.5 mr-1" />
                              Refuser
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      <div className="p-3 bg-[#171720] rounded-xl border border-[#242430] text-xs">
                        <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">🎯 Motivations :</span>
                        <p className="text-gray-200 whitespace-pre-wrap">{cand.motivation}</p>
                      </div>

                      <div className="p-3 bg-[#171720] rounded-xl border border-[#242430] text-xs">
                        <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">🔬 Centres d'intérêt & Compétences :</span>
                        <p className="text-gray-200 whitespace-pre-wrap">{cand.interests}</p>
                        {cand.availability && (
                          <div className="mt-2 text-[11px] text-amber-400 font-semibold">
                            ⏱️ Disponibilité : {cand.availability}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Review Notes */}
                    {cand.reviewNotes && (
                      <div className="text-[11px] text-gray-400 bg-[#1E1E28] border border-[#323246] rounded-lg p-2.5">
                        <b className="text-white">Note du responsable : </b>
                        {cand.reviewNotes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Review Modal */}
      {selectedCand && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedCand(null)}
          title={`Traiter la Candidature de ${selectedCand.displayName}`}
        >
          <form onSubmit={handleReviewSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                Décision d'adhésion *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setReviewAction('approve')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 border transition ${
                    reviewAction === 'approve'
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow'
                      : 'bg-[#1A1A22] text-gray-400 border-[#2E2E3C] hover:text-white'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Valider l'adhésion & attribuer le rôle</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReviewAction('reject')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 border transition ${
                    reviewAction === 'reject'
                      ? 'bg-rose-600 text-white border-rose-500 shadow'
                      : 'bg-[#1A1A22] text-gray-400 border-[#2E2E3C] hover:text-white'
                  }`}
                >
                  <XCircle className="w-4 h-4" />
                  <span>Refuser la candidature</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Note / Message explicatif (optionnel)
              </label>
              <textarea
                rows={3}
                value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
                placeholder="Ex : Bienvenue au club ! Passe nous voir au local demain..."
                className="w-full bg-[#1A1A22] border border-[#2E2E3C] rounded-xl px-4 py-2 text-sm text-gray-100 focus:outline-none focus:border-[#E5092E] transition"
              />
            </div>

            <div className="p-3 bg-[#1A1A22] rounded-xl border border-[#2E2E3C] text-xs text-gray-400">
              ⚡ Lors de la validation, le membre recevra automatiquement son rôle Discord et un message privé de félicitations.
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedCand(null)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded-xl transition"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={reviewMutation.isPending}
                className="px-5 py-2 bg-[#E5092E] hover:bg-[#c00725] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition shadow-md shadow-[#E5092E]/25"
              >
                {reviewMutation.isPending ? 'Traitement en cours...' : 'Confirmer la Décision'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
