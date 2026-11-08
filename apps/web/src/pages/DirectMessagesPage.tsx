import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import {
  Send,
  Calendar,
  Layers,
  Shield,
  User,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  History,
  Users,
  Eye,
  Info,
  RefreshCw
} from 'lucide-react';
import { Modal } from '../components/common/Modal';

interface DMCampaign {
  id: string;
  guildId: string;
  senderId: string;
  senderName: string;
  targetType: string;
  targetName: string;
  title: string;
  message: string;
  totalTargets: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
}

interface EventItem {
  id: string;
  title: string;
  location: string;
  status: string;
  participantCount?: number;
  sessions?: Array<{ id: string; name: string; dayOfWeek?: string; timeSlot?: string }>;
}

interface DepartmentItem {
  id: string;
  name: string;
  shortName?: string;
  icon?: string;
  memberCount?: number;
}

interface RoleItem {
  id: string;
  name: string;
  color: number;
  hexColor: string;
  memberCount?: number;
}

export const DirectMessagesPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const queryClient = useQueryClient();

  // État du formulaire
  const [targetType, setTargetType] = useState<'event' | 'department' | 'role' | 'user'>('event');
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedSessionId, setSelectedSessionId] = useState<string>('all');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [targetUserId, setTargetUserId] = useState<string>('');

  const [title, setTitle] = useState<string>('Information importante — CORTEX');
  const [message, setMessage] = useState<string>(
    'Bonjour {prenom},\n\nNous vous informons d\'une actualité importante concernant votre parcours et vos activités au sein du club.\n\nRestez attentif(ve) et n\'hésitez pas à poser vos questions dans les salons d\'entraide !'
  );
  const [color, setColor] = useState<string>('#E5092E');

  // Modal de confirmation / résultat
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [resultData, setResultData] = useState<{
    totalTargets: number;
    sentCount: number;
    failedCount: number;
  } | null>(null);

  // Requêtes
  const { data: campaigns = [], isLoading: loadingCampaigns } = useQuery<DMCampaign[]>({
    queryKey: ['dm-campaigns', guildId],
    queryFn: () => apiFetch(`/guilds/${guildId}/messages/history`),
    enabled: !!guildId
  });

  const { data: events = [] } = useQuery<EventItem[]>({
    queryKey: ['events', guildId],
    queryFn: () => apiFetch(`/guilds/${guildId}/events`),
    enabled: !!guildId
  });

  const { data: departments = [] } = useQuery<DepartmentItem[]>({
    queryKey: ['departments', guildId],
    queryFn: () => apiFetch(`/guilds/${guildId}/departments`),
    enabled: !!guildId
  });

  const { data: roles = [] } = useQuery<RoleItem[]>({
    queryKey: ['roles', guildId],
    queryFn: () => apiFetch(`/guilds/${guildId}/roles`),
    enabled: !!guildId
  });

  // Calcul dynamique de l'ID cible actif
  const activeTargetId = 
    targetType === 'event' ? selectedEventId :
    targetType === 'department' ? selectedDeptId :
    targetType === 'role' ? selectedRoleId :
    targetUserId;

  // Calcul du nombre de cibles
  const { data: targetMeta, isLoading: loadingTargetMeta } = useQuery<{ count: number; preview: string[] }>({
    queryKey: ['targets-count', guildId, targetType, activeTargetId, selectedSessionId],
    queryFn: () => apiFetch(`/guilds/${guildId}/messages/targets-count?targetType=${targetType}&targetId=${activeTargetId || ''}&sessionId=${selectedSessionId}`),
    enabled: !!guildId && !!activeTargetId
  });

  // Sessions de l'événement sélectionné
  const currentEvent = events.find(e => e.id === selectedEventId);

  // Mutation d'envoi
  const sendMutation = useMutation({
    mutationFn: (payload: any) =>
      apiFetch(`/guilds/${guildId}/messages/send`, {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    onSuccess: (data: any) => {
      setResultData(data);
      setIsConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['dm-campaigns', guildId] });
    }
  });

  const handleInsertPlaceholder = (placeholder: string) => {
    setMessage(prev => prev + placeholder);
  };

  const handleSend = () => {
    if (!title.trim() || !message.trim()) return;
    sendMutation.mutate({
      targetType,
      targetId: activeTargetId,
      sessionId: targetType === 'event' ? selectedSessionId : undefined,
      title,
      message,
      color
    });
  };

  const colorOptions = [
    { label: 'Rouge Cortex', value: '#E5092E' },
    { label: 'Émeraude Succès', value: '#10B981' },
    { label: 'Bleu Royal', value: '#3B82F6' },
    { label: 'Ambre Vigilance', value: '#F59E0B' },
    { label: 'Violet Mentor', value: '#8B5CF6' }
  ];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#242430]">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-[#E5092E]/10 border border-[#E5092E]/20 text-[#E5092E]">
              <Send className="w-6 h-6" />
            </span>
            Centre de Messagerie & Envoi de DMs
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Envoyez des messages privés Discord officiels, personnalisés et ciblés par événement, pôle ou rôle.
          </p>
        </div>
      </div>

      {/* Main Grid : Formulaire & Discord Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Colonne Gauche : Formulaire de ciblage & composition */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card Ciblage */}
          <div className="bg-[#121217] border border-[#1E1E26] rounded-2xl p-6 shadow-xl space-y-5">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-[#E5092E]" />
              1. Sélectionner les Destinataires
            </h2>

            {/* Onglets de type de cible */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 bg-[#16161D] rounded-xl border border-[#242430]">
              <button
                type="button"
                onClick={() => setTargetType('event')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition ${
                  targetType === 'event'
                    ? 'bg-[#E5092E] text-white shadow-md shadow-[#E5092E]/25'
                    : 'text-gray-400 hover:text-white hover:bg-[#20202A]'
                }`}
              >
                <Calendar className="w-4 h-4" />
                Événement
              </button>

              <button
                type="button"
                onClick={() => setTargetType('department')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition ${
                  targetType === 'department'
                    ? 'bg-[#E5092E] text-white shadow-md shadow-[#E5092E]/25'
                    : 'text-gray-400 hover:text-white hover:bg-[#20202A]'
                }`}
              >
                <Layers className="w-4 h-4" />
                Pôle
              </button>

              <button
                type="button"
                onClick={() => setTargetType('role')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition ${
                  targetType === 'role'
                    ? 'bg-[#E5092E] text-white shadow-md shadow-[#E5092E]/25'
                    : 'text-gray-400 hover:text-white hover:bg-[#20202A]'
                }`}
              >
                <Shield className="w-4 h-4" />
                Rôle Discord
              </button>

              <button
                type="button"
                onClick={() => setTargetType('user')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition ${
                  targetType === 'user'
                    ? 'bg-[#E5092E] text-white shadow-md shadow-[#E5092E]/25'
                    : 'text-gray-400 hover:text-white hover:bg-[#20202A]'
                }`}
              >
                <User className="w-4 h-4" />
                Membre
              </button>
            </div>

            {/* Sélecteurs selon le type */}
            {targetType === 'event' && (
              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                    Choisir l'Événement :
                  </label>
                  <select
                    value={selectedEventId}
                    onChange={e => {
                      setSelectedEventId(e.target.value);
                      setSelectedSessionId('all');
                    }}
                    className="w-full bg-[#1A1A22] border border-[#2E2E3C] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#E5092E]"
                  >
                    <option value="">-- Sélectionnez un événement --</option>
                    {events.map(ev => (
                      <option key={ev.id} value={ev.id}>
                        {ev.title} ({ev.participantCount || 0} inscrits)
                      </option>
                    ))}
                  </select>
                </div>

                {currentEvent && currentEvent.sessions && currentEvent.sessions.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                      Session ciblée :
                    </label>
                    <select
                      value={selectedSessionId}
                      onChange={e => setSelectedSessionId(e.target.value)}
                      className="w-full bg-[#1A1A22] border border-[#2E2E3C] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#E5092E]"
                    >
                      <option value="all">Toutes les sessions de l'événement</option>
                      {currentEvent.sessions.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} {s.dayOfWeek ? `(${s.dayOfWeek} à ${s.timeSlot})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {targetType === 'department' && (
              <div className="pt-2">
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                  Choisir le Pôle Scientifique :
                </label>
                <select
                  value={selectedDeptId}
                  onChange={e => setSelectedDeptId(e.target.value)}
                  className="w-full bg-[#1A1A22] border border-[#2E2E3C] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#E5092E]"
                >
                  <option value="">-- Sélectionnez un pôle --</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.icon || '🔬'} {d.name} ({d.memberCount || 0} membres)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {targetType === 'role' && (
              <div className="pt-2">
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                  Choisir le Rôle Discord :
                </label>
                <select
                  value={selectedRoleId}
                  onChange={e => setSelectedRoleId(e.target.value)}
                  className="w-full bg-[#1A1A22] border border-[#2E2E3C] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#E5092E]"
                >
                  <option value="">-- Sélectionnez un rôle --</option>
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>
                      @{r.name} ({r.memberCount || 0} membres)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {targetType === 'user' && (
              <div className="pt-2">
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                  Discord ID du membre :
                </label>
                <input
                  type="text"
                  value={targetUserId}
                  onChange={e => setTargetUserId(e.target.value.trim())}
                  placeholder="Ex : 1012476753459032206"
                  className="w-full bg-[#1A1A22] border border-[#2E2E3C] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#E5092E]"
                />
              </div>
            )}

            {/* Badge d'estimation des cibles */}
            <div className="p-3 bg-[#16161D] rounded-xl border border-[#242430] flex items-center justify-between text-xs">
              <span className="text-gray-400 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                Destinataires estimés :
              </span>
              <span className="font-bold text-white bg-[#20202A] px-2.5 py-1 rounded-md border border-[#2E2E3C]">
                {loadingTargetMeta ? 'Calcul en cours...' : `${targetMeta?.count || 0} membre(s)`}
              </span>
            </div>
          </div>

          {/* Card Rédaction du Message */}
          <div className="bg-[#121217] border border-[#1E1E26] rounded-2xl p-6 shadow-xl space-y-5">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#E5092E]" />
              2. Rédiger le Message Officiel
            </h2>

            {/* Titre */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                Titre du message :
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={256}
                className="w-full bg-[#1A1A22] border border-[#2E2E3C] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#E5092E]"
              />
            </div>

            {/* Boutons d'insertion rapide de placeholders */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-400" />
                Variables dynamiques disponibles (cliquez pour insérer) :
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { tag: '{prenom}', label: 'Prénom' },
                  { tag: '{nom}', label: 'Nom' },
                  { tag: '{evenement}', label: 'Nom de l\'événement' },
                  { tag: '{session}', label: 'Session & Horaire' },
                  { tag: '{lieu}', label: 'Lieu' },
                  { tag: '{serveur}', label: 'Nom du Serveur' }
                ].map(item => (
                  <button
                    key={item.tag}
                    type="button"
                    onClick={() => handleInsertPlaceholder(item.tag)}
                    className="text-xs bg-[#1A1A22] hover:bg-[#262635] text-gray-300 hover:text-white border border-[#2E2E3C] px-2.5 py-1 rounded-lg transition"
                  >
                    <code className="text-[#E5092E] font-bold">{item.tag}</code> ({item.label})
                  </button>
                ))}
              </div>
            </div>

            {/* Message Body */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                Corps du message privé :
              </label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={7}
                maxLength={4000}
                className="w-full bg-[#1A1A22] border border-[#2E2E3C] rounded-xl p-4 text-sm text-white focus:outline-none focus:border-[#E5092E] font-sans leading-relaxed"
              />
            </div>

            {/* Choix de couleur de l'embed */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                Couleur de la bordure Discord :
              </label>
              <div className="flex items-center gap-2">
                {colorOptions.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                      color === c.value
                        ? 'border-white bg-[#20202A] text-white'
                        : 'border-transparent text-gray-400 hover:text-white bg-[#16161D]'
                    }`}
                  >
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.value }} />
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bouton d'action */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(true)}
                disabled={!activeTargetId || !title.trim() || !message.trim() || (targetMeta?.count === 0)}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#E5092E] hover:bg-[#CC0727] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition shadow-lg shadow-[#E5092E]/25 hover:scale-[1.01] active:scale-[0.99]"
              >
                <Send className="w-4 h-4" />
                Envoyer aux {targetMeta?.count || 0} destinataire(s)
              </button>
            </div>
          </div>
        </div>

        {/* Colonne Droite : Discord Embed Preview */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#121217] border border-[#1E1E26] rounded-2xl p-6 shadow-xl sticky top-6">
            <h2 className="text-base font-bold text-white flex items-center gap-2 mb-4">
              <Eye className="w-5 h-5 text-blue-400" />
              Aperçu en Direct dans Discord
            </h2>
            <p className="text-xs text-gray-400 mb-6 leading-relaxed">
              Voici exactement comment le message s'affichera dans les MP Discord de vos membres. Les variables dynamiques sont ici simulées avec un exemple de profil.
            </p>

            {/* Discord Simulation Container */}
            <div className="bg-[#313338] rounded-xl p-4 border border-[#3E4047] font-sans text-sm select-none shadow-inner">
              {/* Header Discord Bot */}
              <div className="flex items-center gap-3 mb-3">
                <img
                  src="/cortex-emblem.png"
                  alt="Cortex"
                  className="w-10 h-10 rounded-full border border-red-500/30"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white text-sm">Cortex</span>
                    <span className="bg-[#5865F2] text-white text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">
                      APP
                    </span>
                    <span className="text-[10px] text-gray-400 ml-1">Aujourd'hui à 18:00</span>
                  </div>
                  <span className="text-[11px] text-gray-400">Message privé automatique</span>
                </div>
              </div>

              {/* Embed Box */}
              <div
                className="bg-[#2B2D31] rounded-lg p-4 border-l-4 space-y-3"
                style={{ borderLeftColor: color }}
              >
                {/* Title */}
                <h3 className="font-bold text-white text-base leading-snug">
                  {title
                    .replace(/{prenom}/gi, 'Mohamed')
                    .replace(/{nom}/gi, 'Benali')
                    .replace(/{evenement}/gi, currentEvent?.title || 'Speaking Circle')
                    .replace(/{session}/gi, 'Session 1')
                    .replace(/{lieu}/gi, currentEvent?.location || 'Amphi C')
                    .replace(/{serveur}/gi, 'CORTEX Scientific Club')}
                </h3>

                {/* Body */}
                <div className="text-gray-200 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                  {message
                    .replace(/{prenom}/gi, 'Mohamed')
                    .replace(/{nom}/gi, 'Benali')
                    .replace(/{evenement}/gi, currentEvent?.title || 'Speaking Circle')
                    .replace(/{session}/gi, 'Session 1 (Lundi à 18:00)')
                    .replace(/{lieu}/gi, currentEvent?.location || 'Amphi C')
                    .replace(/{serveur}/gi, 'CORTEX Scientific Club')}
                </div>

                {/* Footer Embed */}
                <div className="pt-2 border-t border-[#383A40] text-[10px] text-gray-400 flex items-center justify-between">
                  <span>CORTEX Scientific Club • Message officiel</span>
                  <span>Aujourd'hui à 18:00</span>
                </div>
              </div>
            </div>

            {/* Note sur la protection Discord */}
            <div className="mt-4 p-3 bg-[#16161D] rounded-xl border border-[#242430] flex items-start gap-2.5 text-xs text-gray-400">
              <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Protection Anti-Spam :</strong> Les messages sont envoyés avec un délai de 500 ms entre chaque membre pour respecter les quotas de l'API Discord.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Section Historique des Campagnes */}
      <div className="bg-[#121217] border border-[#1E1E26] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-[#E5092E]" />
            Historique des Messages Privés Récents
          </h2>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['dm-campaigns', guildId] })}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg bg-[#16161D] border border-[#242430] transition"
            title="Rafraîchir l'historique"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {loadingCampaigns ? (
          <div className="text-center py-8 text-gray-400 text-sm">Chargement de l'historique...</div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            Aucune campagne de messages privés n'a encore été envoyée sur ce serveur.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-[#16161D] text-gray-400 uppercase text-[10px] tracking-wider border-b border-[#242430]">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Cible</th>
                  <th className="py-3 px-4">Titre</th>
                  <th className="py-3 px-4">Envoyés / Total</th>
                  <th className="py-3 px-4">Échecs (DMs fermés)</th>
                  <th className="py-3 px-4">Expéditeur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E1E26]">
                {campaigns.map(camp => (
                  <tr key={camp.id} className="hover:bg-[#16161D]/50 transition">
                    <td className="py-3 px-4 text-gray-400 whitespace-nowrap">
                      {new Date(camp.createdAt).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-white">{camp.targetName}</span>
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-gray-200">
                      {camp.title}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        {camp.sentCount} / {camp.totalTargets}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {camp.failedCount > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <AlertCircle className="w-3 h-3" />
                          {camp.failedCount} échec(s)
                        </span>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-400">
                      @{camp.senderName}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Confirmation avant envoi */}
      <Modal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        title="Confirmer la diffusion des messages privés"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-300">
            Vous vous apprêtez à envoyer un message privé officiel à{' '}
            <strong className="text-white">{targetMeta?.count || 0} destinataire(s)</strong>.
          </p>

          <div className="p-3 bg-[#16161D] rounded-xl border border-[#242430] text-xs space-y-1.5 text-gray-300">
            <div><strong>Cible :</strong> {targetType}</div>
            <div><strong>Titre :</strong> {title}</div>
            {targetMeta?.preview && targetMeta.preview.length > 0 && (
              <div>
                <strong>Exemples de destinataires :</strong>{' '}
                <span className="text-gray-400">{targetMeta.preview.join(', ')}...</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setIsConfirmOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white transition"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={sendMutation.isPending}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#E5092E] hover:bg-[#CC0727] text-white text-xs font-bold rounded-xl transition shadow-lg shadow-[#E5092E]/25"
            >
              {sendMutation.isPending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Confirmer et Envoyer
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal de Résultat d'envoi */}
      <Modal
        isOpen={!!resultData}
        onClose={() => setResultData(null)}
        title="Rapport de diffusion"
      >
        {resultData && (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3 text-emerald-400">
              <CheckCircle2 className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="font-bold text-sm">Diffusion terminée avec succès !</h3>
                <p className="text-xs text-emerald-300/80">
                  {resultData.sentCount} message(s) privé(s) ont été remis avec succès.
                </p>
              </div>
            </div>

            {resultData.failedCount > 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-xs text-amber-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  {resultData.failedCount} membre(s) n'ont pas pu recevoir le message car leurs messages privés sont fermés ou le bot est bloqué.
                </span>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setResultData(null)}
                className="px-5 py-2 bg-[#1A1A22] hover:bg-[#22222E] text-white text-xs font-semibold rounded-xl border border-[#2E2E3C] transition"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
