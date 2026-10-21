import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import {
  Lightbulb,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
  AlertCircle,
  Hash,
  ExternalLink,
  ThumbsUp,
  Sparkles,
  Search,
  Filter
} from 'lucide-react';
import { Modal } from '../components/common/Modal';
import { Badge } from '../components/common/Badge';

interface SuggestionConfig {
  guildId: string;
  submissionChannelId: string | null;
  submissionChannelName: string | null;
  reviewChannelId: string | null;
  reviewChannelName: string | null;
  panelMessageId: string | null;
  title: string;
  description: string;
  updatedAt: string | null;
}

interface SuggestionItem {
  id: string;
  guildId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  title: string;
  description: string;
  benefits?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'in_discussion';
  discordMessageId?: string | null;
  reviewNotes?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
}

export const SuggestionsPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'inbox' | 'config'>('inbox');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'in_discussion' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Config Form state
  const [subChannelId, setSubChannelId] = useState('');
  const [revChannelId, setRevChannelId] = useState('');
  const [panelTitle, setPanelTitle] = useState('💡 CORTEX SCIENTIFIC CLUB — BOÎTE À IDÉES & SUGGESTIONS');
  const [panelDescription, setPanelDescription] = useState('');
  const [deployFeedback, setDeployFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Review Modal state
  const [selectedSuggestion, setSelectedSuggestion] = useState<SuggestionItem | null>(null);
  const [reviewAction, setReviewAction] = useState<'approved' | 'in_discussion' | 'rejected'>('approved');
  const [reviewNotes, setReviewNotes] = useState('');

  // 1. Fetch Suggestions Config
  const { data: configData, isLoading: isConfigLoading } = useQuery<{ success: boolean; data: SuggestionConfig }>({
    queryKey: ['suggestions-config', guildId],
    queryFn: () => apiFetch(`/guilds/${guildId}/suggestions/config`),
    enabled: !!guildId
  });

  const config = configData?.data;

  // Initialize form when config is loaded
  React.useEffect(() => {
    if (config) {
      if (config.submissionChannelId) setSubChannelId(config.submissionChannelId);
      if (config.reviewChannelId) setRevChannelId(config.reviewChannelId);
      if (config.title) setPanelTitle(config.title);
      if (config.description) setPanelDescription(config.description);
    }
  }, [config]);

  // 2. Fetch Channels for dropdowns
  const { data: channels = [] } = useQuery<any[]>({
    queryKey: ['channels', guildId],
    queryFn: () => apiFetch(`/guilds/${guildId}/channels`),
    enabled: !!guildId
  });

  // 3. Fetch Suggestions List
  const { data: suggestionsData, isLoading: isSuggestionsLoading } = useQuery<{ success: boolean; data: SuggestionItem[] }>({
    queryKey: ['suggestions', guildId, statusFilter],
    queryFn: () => apiFetch(`/guilds/${guildId}/suggestions?status=${statusFilter}`),
    enabled: !!guildId
  });

  const suggestions = suggestionsData?.data || [];

  // Deploy Panel Mutation
  const deployMutation = useMutation({
    mutationFn: (body: any) =>
      apiFetch(`/guilds/${guildId}/suggestions/send-panel`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (res: any) => {
      setDeployFeedback({ type: 'success', message: res.message || 'Panneau déployé avec succès sur Discord !' });
      queryClient.invalidateQueries({ queryKey: ['suggestions-config', guildId] });
      setTimeout(() => setDeployFeedback(null), 3500);
    },
    onError: (err: any) => {
      setDeployFeedback({ type: 'error', message: err.message || 'Erreur lors du déploiement.' });
    }
  });

  // Review Suggestion Mutation
  const reviewMutation = useMutation({
    mutationFn: ({ id, status, reviewNotes }: { id: string; status: string; reviewNotes?: string }) =>
      apiFetch(`/guilds/${guildId}/suggestions/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ status, reviewNotes })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions', guildId] });
      setSelectedSuggestion(null);
      setReviewNotes('');
    }
  });

  const handleDeploySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    deployMutation.mutate({
      submissionChannelId: subChannelId,
      reviewChannelId: revChannelId,
      title: panelTitle,
      description: panelDescription || undefined
    });
  };

  const openReviewModal = (sug: SuggestionItem, action: 'approved' | 'in_discussion' | 'rejected') => {
    setSelectedSuggestion(sug);
    setReviewAction(action);
    setReviewNotes('');
  };

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSuggestion) return;
    reviewMutation.mutate({
      id: selectedSuggestion.id,
      status: reviewAction,
      reviewNotes: reviewNotes.trim() || undefined
    });
  };

  const filteredSuggestions = suggestions.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return s.title.toLowerCase().includes(q) ||
           s.description.toLowerCase().includes(q) ||
           s.displayName.toLowerCase().includes(q);
  });

  const pendingCount = suggestions.filter(s => s.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-100 flex items-center tracking-tight">
            <Lightbulb className="w-6 h-6 mr-3 text-amber-400" />
            Espace Boîte à Idées & Suggestions
          </h1>
          <p className="text-sm text-gray-400">
            Déployez un panneau interactif Discord pour recueillir les idées des membres et gérez les propositions dans votre salon staff dédié.
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
            Configuration & Déploiement
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
          <Lightbulb className="w-4 h-4 mr-2 text-amber-400" />
          Suggestions Reçues ({suggestions.length})
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
          Déploiement du Panneau Discord
        </button>
      </div>

      {/* Main Tab Views */}
      {activeTab === 'config' ? (
        /* Configuration & Deployment View */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Form */}
          <div className="lg:col-span-7 bg-[#121217] border border-[#1C1C24] rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center">
                <Sparkles className="w-5 h-5 mr-2 text-amber-400" />
                Déployer la Boîte à Idées sur Discord
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Choisissez le salon où afficher le bouton de suggestion et le salon privé où le staff recevra les propositions avec vote automatique.
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
                  1. Salon Discord d'affichage du message (Visible par tous les membres) *
                </label>
                <select
                  required
                  value={subChannelId}
                  onChange={e => setSubChannelId(e.target.value)}
                  className="w-full bg-[#1A1A22] border border-[#2E2E3C] rounded-xl px-4 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-[#E5092E] transition"
                >
                  <option value="">Sélectionnez le salon d'envoi (ex: #boîte-à-idées, #suggestions)...</option>
                  {channels
                    .filter((c: any) => c.type === 'text' || c.type === 0)
                    .map((c: any) => (
                      <option key={c.id} value={c.id}>
                        #{c.name}
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  Les membres y verront le message explicatif et le bouton interactif <b>💡 Proposer une suggestion</b>.
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
                  <option value="">Sélectionnez le salon de réception (ex: #suggestions-staff, #revue)...</option>
                  {channels
                    .filter((c: any) => c.type === 'text' || c.type === 0)
                    .map((c: any) => (
                      <option key={c.id} value={c.id}>
                        #{c.name}
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  Cortex y postera chaque suggestion avec réactions 👍/👎 et boutons d'approbation instantanée.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  Titre de l'Embed Discord
                </label>
                <input
                  type="text"
                  value={panelTitle}
                  onChange={e => setPanelTitle(e.target.value)}
                  placeholder="💡 CORTEX SCIENTIFIC CLUB — BOÎTE À IDÉES & SUGGESTIONS"
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
                  <span>{deployMutation.isPending ? 'Déploiement en cours...' : 'Envoyer / Mettre à jour le Panneau'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Status & Preview Card */}
          <div className="lg:col-span-5 space-y-5">
            {/* Active Status */}
            <div className="bg-[#121217] border border-[#1C1C24] rounded-2xl p-5">
              <h3 className="text-xs font-black text-gray-300 uppercase tracking-wider mb-3 flex items-center">
                <Hash className="w-4 h-4 mr-1.5 text-blue-400" />
                Statut des Salons Déployés
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

                {config?.updatedAt && (
                  <div className="text-[10px] text-gray-500 text-right">
                    Dernière configuration : {new Date(config.updatedAt).toLocaleDateString('fr-FR')} à {new Date(config.updatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
            </div>

            {/* Discord Visual Preview */}
            <div className="bg-[#121217] border border-[#1C1C24] rounded-2xl p-5">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                Aperçu du Panneau Discord
              </span>

              <div className="bg-[#2B2D31] rounded-lg p-3.5 border-l-4 border-blue-500 space-y-2 text-xs">
                <div className="font-bold text-white text-sm">
                  {panelTitle || '💡 CORTEX SCIENTIFIC CLUB — BOÎTE À IDÉES & SUGGESTIONS'}
                </div>
                <div className="text-gray-300 leading-relaxed text-[11px]">
                  {panelDescription || '🔬 Votre avis et vos initiatives comptent pour CORTEX ! Cliquez sur le bouton ci-dessous pour proposer votre idée.'}
                </div>
                <div className="text-[10px] text-gray-400 pt-1">
                  CORTEX Scientific Club • Boîte à suggestions active
                </div>
              </div>

              <div className="mt-2.5">
                <div className="w-full py-2 bg-[#5865F2] text-white text-xs font-bold rounded flex items-center justify-center space-x-1.5 opacity-90 cursor-default">
                  <span>💡</span>
                  <span>Proposer une suggestion / idée</span>
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
                Toutes ({suggestions.length})
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
                onClick={() => setStatusFilter('approved')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  statusFilter === 'approved'
                    ? 'bg-emerald-600 text-white'
                    : 'text-emerald-400 hover:text-emerald-300 bg-emerald-500/10'
                }`}
              >
                Approuvées
              </button>
              <button
                onClick={() => setStatusFilter('in_discussion')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  statusFilter === 'in_discussion'
                    ? 'bg-blue-600 text-white'
                    : 'text-blue-400 hover:text-blue-300 bg-blue-500/10'
                }`}
              >
                En discussion
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
                placeholder="Rechercher une idée..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-[#1A1A22] border border-[#2E2E3C] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#E5092E] w-full sm:w-56"
              />
            </div>
          </div>

          {/* Suggestions List */}
          {isSuggestionsLoading ? (
            <div className="p-12 text-center text-gray-500 bg-[#121217] rounded-2xl border border-[#1C1C24]">
              Chargement des propositions...
            </div>
          ) : filteredSuggestions.length === 0 ? (
            <div className="p-12 text-center text-gray-500 bg-[#121217] rounded-2xl border border-[#1C1C24] space-y-2">
              <Lightbulb className="w-8 h-8 mx-auto text-gray-600" />
              <div className="text-white font-bold text-sm">Aucune suggestion trouvée</div>
              <p className="text-xs text-gray-500">
                {statusFilter === 'all'
                  ? 'Aucune idée n\'a encore été soumise. Déployez le panneau Discord pour inviter vos membres à proposer !'
                  : 'Aucune suggestion pour ce filtre.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredSuggestions.map(sug => {
                const isPending = sug.status === 'pending';
                const isApproved = sug.status === 'approved';
                const isDiscussion = sug.status === 'in_discussion';
                const isRejected = sug.status === 'rejected';

                return (
                  <div
                    key={sug.id}
                    className="p-5 bg-[#121217] border border-[#1C1C24] hover:border-[#2C2C3C] rounded-2xl transition space-y-3.5 shadow-lg relative overflow-hidden"
                  >
                    {/* Status indicator bar */}
                    <div
                      className={`absolute left-0 top-0 bottom-0 w-1 ${
                        isApproved ? 'bg-emerald-500' : isDiscussion ? 'bg-amber-500' : isRejected ? 'bg-rose-500' : 'bg-blue-500'
                      }`}
                    />

                    {/* Top Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center space-x-3">
                        {sug.avatarUrl ? (
                          <img src={sug.avatarUrl} alt="" className="w-9 h-9 rounded-full border border-gray-700" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center font-bold text-xs text-white">
                            {sug.displayName.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-bold text-white flex items-center">
                            {sug.title}
                          </div>
                          <div className="text-[11px] text-gray-400 flex items-center space-x-1.5">
                            <span>Par <b className="text-gray-300">{sug.displayName}</b></span>
                            <span>•</span>
                            <span>Le {new Date(sug.createdAt).toLocaleDateString('fr-FR')} à {new Date(sug.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      </div>

                      {/* Status Badge & Review Controls */}
                      <div className="flex items-center space-x-2 self-start sm:self-auto">
                        <span
                          className={`px-2.5 py-1 text-xs font-bold rounded-lg flex items-center ${
                            isApproved
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : isDiscussion
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : isRejected
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}
                        >
                          {isApproved && <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                          {isDiscussion && <MessageSquare className="w-3.5 h-3.5 mr-1" />}
                          {isRejected && <XCircle className="w-3.5 h-3.5 mr-1" />}
                          {isPending && <Clock className="w-3.5 h-3.5 mr-1" />}
                          {isApproved ? 'Approuvée' : isDiscussion ? 'En discussion' : isRejected ? 'Refusée' : 'En attente'}
                        </span>

                        {/* Quick action buttons */}
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => openReviewModal(sug, 'approved')}
                            className="p-1.5 text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition"
                            title="Approuver la suggestion"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openReviewModal(sug, 'in_discussion')}
                            className="p-1.5 text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition"
                            title="Mettre en discussion"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openReviewModal(sug, 'rejected')}
                            className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                            title="Refuser la proposition"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="bg-[#171720] border border-[#242430] rounded-xl p-3.5 text-xs text-gray-200 leading-relaxed whitespace-pre-wrap">
                      <p>{sug.description}</p>
                      {sug.benefits && (
                        <div className="mt-2.5 pt-2 border-t border-[#242430] text-[11px] text-gray-400">
                          <b className="text-amber-400">Impact & Bénéfices pour le club : </b>
                          {sug.benefits}
                        </div>
                      )}
                    </div>

                    {/* Reviewer Note if available */}
                    {sug.reviewNotes && (
                      <div className="text-[11px] text-gray-400 bg-[#1E1E28] border border-[#323246] rounded-lg p-2.5">
                        <b className="text-white">Note de l'équipe : </b>
                        {sug.reviewNotes}
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
      {selectedSuggestion && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedSuggestion(null)}
          title={`Traiter la Suggestion — "${selectedSuggestion.title}"`}
        >
          <form onSubmit={handleReviewSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                Décision de l'équipe *
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setReviewAction('approved')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 border transition ${
                    reviewAction === 'approved'
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-[#1A1A22] text-gray-400 border-[#2E2E3C] hover:text-white'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Approuver</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReviewAction('in_discussion')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 border transition ${
                    reviewAction === 'in_discussion'
                      ? 'bg-amber-600 text-white border-amber-500'
                      : 'bg-[#1A1A22] text-gray-400 border-[#2E2E3C] hover:text-white'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>En discussion</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReviewAction('rejected')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 border transition ${
                    reviewAction === 'rejected'
                      ? 'bg-rose-600 text-white border-rose-500'
                      : 'bg-[#1A1A22] text-gray-400 border-[#2E2E3C] hover:text-white'
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Refuser</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Note explicative / Réponse envoyée au membre par MP Discord (optionnel)
              </label>
              <textarea
                rows={3}
                value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
                placeholder="Ex : Super proposition ! Nous allons programmer cet atelier pour le mois prochain..."
                className="w-full bg-[#1A1A22] border border-[#2E2E3C] rounded-xl px-4 py-2 text-sm text-gray-100 focus:outline-none focus:border-[#E5092E] transition"
              />
            </div>

            <div className="p-3 bg-[#1A1A22] rounded-xl border border-[#2E2E3C] text-xs text-gray-400">
              ⚡ La validation mettra à jour l'Embed dans le salon de réception Discord et enverra une notification MP au membre.
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedSuggestion(null)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded-xl transition"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={reviewMutation.isPending}
                className="px-5 py-2 bg-[#E5092E] hover:bg-[#c00725] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition shadow-md shadow-[#E5092E]/25"
              >
                {reviewMutation.isPending ? 'Enregistrement...' : 'Valider la Décision'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
