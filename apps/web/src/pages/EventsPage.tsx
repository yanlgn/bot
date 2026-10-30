import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { EventRecord } from '@sciclub/shared';
import {
  Calendar,
  Plus,
  MapPin,
  User,
  Users,
  Clock,
  Tag,
  Repeat,
  Send,
  Trash2,
  Pencil,
  CheckCircle2,
  XCircle,
  Hash,
  AlertCircle,
  Sparkles,
  Layers,
  Lock,
  Unlock,
  ExternalLink
} from 'lucide-react';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';

interface EventSessionItem {
  id?: string;
  name: string;
  description?: string;
  scheduledStartTime?: string;
  maxParticipants?: number | '';
}

export const EventsPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const queryClient = useQueryClient();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventRecord | null>(null);
  const [selectedEventForParticipants, setSelectedEventForParticipants] = useState<EventRecord | null>(null);
  const [selectedEventForDeploy, setSelectedEventForDeploy] = useState<EventRecord | null>(null);
  const [deployChannelId, setDeployChannelId] = useState('');
  const [deployFeedback, setDeployFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [type, setType] = useState<any>('workshop');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [location, setLocation] = useState('');
  const [speaker, setSpeaker] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [channelId, setChannelId] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState('Hebdomadaire (Tous les Jeudis)');
  const [hasLimit, setHasLimit] = useState(true);
  const [maxParticipants, setMaxParticipants] = useState<number | ''>(15);
  const [allowCancellation, setAllowCancellation] = useState(true);
  const [hasMultipleSessions, setHasMultipleSessions] = useState(false);
  const [sessions, setSessions] = useState<EventSessionItem[]>([
    { name: 'Session 1 (Matin 10h00 - 12h00)', maxParticipants: 15 },
    { name: 'Session 2 (Après-midi 14h00 - 16h00)', maxParticipants: 15 }
  ]);

  // Fetch Events
  const { data: events = [], isLoading } = useQuery<EventRecord[]>({
    queryKey: ['events', guildId],
    queryFn: () => apiFetch(`/guilds/${guildId}/events`),
    enabled: !!guildId
  });

  // Fetch Channels for selector
  const { data: channels = [] } = useQuery<any[]>({
    queryKey: ['channels', guildId],
    queryFn: () => apiFetch(`/guilds/${guildId}/channels`),
    enabled: !!guildId
  });

  // Fetch Participants for selected event
  const { data: participants = [], isLoading: isParticipantsLoading } = useQuery<any[]>({
    queryKey: ['event-participants', guildId, selectedEventForParticipants?.id],
    queryFn: () => apiFetch(`/guilds/${guildId}/events/${selectedEventForParticipants?.id}/participants`),
    enabled: !!guildId && !!selectedEventForParticipants
  });

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: (newEvent: any) =>
      apiFetch(`/guilds/${guildId}/events`, { method: 'POST', body: JSON.stringify(newEvent) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', guildId] });
      setIsCreateOpen(false);
      resetForm();
    }
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: ({ eventId, body }: { eventId: string; body: any }) =>
      apiFetch(`/guilds/${guildId}/events/${eventId}`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', guildId] });
      setEditingEvent(null);
    }
  });

  // Delete Event Mutation
  const deleteMutation = useMutation({
    mutationFn: (eventId: string) =>
      apiFetch(`/guilds/${guildId}/events/${eventId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', guildId] });
    }
  });

  // Remove Participant Mutation
  const removeParticipantMutation = useMutation({
    mutationFn: ({ eventId, participantId }: { eventId: string; participantId: string }) =>
      apiFetch(`/guilds/${guildId}/events/${eventId}/participants/${participantId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-participants', guildId, selectedEventForParticipants?.id] });
      queryClient.invalidateQueries({ queryKey: ['events', guildId] });
    }
  });

  // Re-send / Deploy Discord panel
  const deployMutation = useMutation({
    mutationFn: ({ eventId, channelId }: { eventId: string; channelId: string }) =>
      apiFetch(`/guilds/${guildId}/events/${eventId}/resend-panel`, { method: 'POST', body: JSON.stringify({ channelId }) }),
    onSuccess: (res: any) => {
      setDeployFeedback({ type: 'success', message: res.message || 'Message interactif posté sur Discord !' });
      queryClient.invalidateQueries({ queryKey: ['events', guildId] });
      setTimeout(() => {
        setSelectedEventForDeploy(null);
        setDeployFeedback(null);
      }, 2000);
    },
    onError: (err: any) => {
      setDeployFeedback({ type: 'error', message: err.message || 'Erreur lors de l\'envoi sur Discord.' });
    }
  });

  const resetForm = () => {
    setTitle('');
    setType('workshop');
    setDescription('');
    setDate('');
    setEndDate('');
    setLocation('');
    setSpeaker('');
    setTargetAudience('');
    setChannelId('');
    setIsRecurring(false);
    setRecurrencePattern('Hebdomadaire (Tous les Jeudis)');
    setHasLimit(true);
    setMaxParticipants(15);
    setAllowCancellation(true);
    setHasMultipleSessions(false);
    setSessions([
      { name: 'Session 1 (Matin 10h00 - 12h00)', maxParticipants: 15 },
      { name: 'Session 2 (Après-midi 14h00 - 16h00)', maxParticipants: 15 }
    ]);
  };

  const handleOpenEdit = (event: EventRecord) => {
    setEditingEvent(event);
    setTitle(event.title);
    setType(event.type);
    setDescription(event.description);
    setDate(event.scheduledStartTime ? new Date(event.scheduledStartTime).toISOString().slice(0, 16) : '');
    setEndDate(event.endTime ? new Date(event.endTime).toISOString().slice(0, 16) : '');
    setLocation(event.location);
    setSpeaker(event.speaker || '');
    setTargetAudience(event.targetAudience || '');
    setChannelId(event.channelId || '');
    setIsRecurring(Boolean(event.isRecurring));
    setRecurrencePattern(event.recurrencePattern || 'Hebdomadaire (Tous les Jeudis)');
    setHasLimit(event.maxParticipants !== null && event.maxParticipants !== undefined && event.maxParticipants > 0);
    setMaxParticipants(event.maxParticipants || '');
    setAllowCancellation(event.allowCancellation !== false);

    if (event.sessions && event.sessions.length > 0) {
      setHasMultipleSessions(true);
      setSessions(event.sessions.map(s => ({
        id: s.id,
        name: s.name,
        maxParticipants: s.maxParticipants || ''
      })));
    } else {
      setHasMultipleSessions(false);
      setSessions([]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const formattedSessions = hasMultipleSessions
      ? sessions.map(s => ({
          id: s.id,
          name: s.name,
          maxParticipants: s.maxParticipants ? Number(s.maxParticipants) : 0
        }))
      : [];

    const payload = {
      title,
      type,
      description,
      scheduledStartTime: new Date(date).toISOString(),
      endTime: endDate ? new Date(endDate).toISOString() : null,
      location,
      speaker: speaker || null,
      maxParticipants: hasLimit && maxParticipants ? Number(maxParticipants) : null,
      targetAudience: targetAudience || null,
      channelId: channelId || null,
      isRecurring,
      recurrencePattern: isRecurring ? recurrencePattern : null,
      allowCancellation,
      createParticipantRole: true,
      sessions: formattedSessions
    };

    if (editingEvent) {
      updateMutation.mutate({ eventId: editingEvent.id, body: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const addSessionRow = () => {
    setSessions(prev => [
      ...prev,
      { name: `Session ${prev.length + 1}`, maxParticipants: 15 }
    ]);
  };

  const removeSessionRow = (index: number) => {
    setSessions(prev => prev.filter((_, i) => i !== index));
  };

  const updateSessionRow = (index: number, field: keyof EventSessionItem, val: any) => {
    setSessions(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const getTypeBadge = (eventType: string) => {
    switch (eventType) {
      case 'conference': return <Badge variant="blue">Conférence</Badge>;
      case 'workshop': return <Badge variant="green">Workshop / Atelier</Badge>;
      case 'competition': return <Badge variant="purple">Hackathon & Concours</Badge>;
      case 'field_trip': return <Badge variant="amber">Sortie Scientifique</Badge>;
      case 'training': return <Badge variant="gray">Formation</Badge>;
      default: return <Badge variant="gray">{eventType}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-100 flex items-center tracking-tight">
            <Calendar className="w-6 h-6 mr-3 text-[#E5092E]" />
            Événements, Ateliers & Speaking Circles
          </h1>
          <p className="text-sm text-gray-400">
            Créez des ateliers récurrents ou ponctuels, diffusez les annonces interactives dans vos salons Discord et gérez les places.
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setIsCreateOpen(true);
          }}
          className="flex items-center px-5 py-2.5 bg-[#E5092E] hover:bg-[#c00725] text-white text-sm font-bold rounded-xl transition shadow-lg shadow-[#E5092E]/25 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nouvel Événement
        </button>
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full py-12 text-center text-gray-500 bg-[#121217] border border-[#1C1C24] rounded-2xl">
            Chargement des événements scientifiques...
          </div>
        ) : events.length === 0 ? (
          <div className="col-span-full py-16 text-center text-gray-400 bg-[#121217] border border-[#1C1C24] rounded-2xl max-w-xl mx-auto p-8 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-[#E5092E]/10 border border-[#E5092E]/30 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-[#E5092E]" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Aucun événement planifié</h3>
            <p className="text-xs text-gray-400 mb-6">
              Planifiez votre premier workshop, conférence ou session récurrente (ex: Speaking Circle avec 2 sessions). Vous pourrez poster l'embed interactif directement dans le salon Discord de votre choix !
            </p>
            <button
              onClick={() => {
                resetForm();
                setIsCreateOpen(true);
              }}
              className="px-6 py-2.5 bg-[#E5092E] hover:bg-[#c00725] text-white text-xs font-bold rounded-xl transition"
            >
              Créer un Événement
            </button>
          </div>
        ) : (
          events.map(event => {
            const isRec = Boolean(event.isRecurring);
            const allowCancel = event.allowCancellation !== false;
            const sessionsList = event.sessions || [];

            return (
              <div
                key={event.id}
                className="bg-[#121217] border border-[#1C1C24] hover:border-[#2C2C3C] rounded-2xl p-5 shadow-xl flex flex-col justify-between transition group relative overflow-hidden"
              >
                {/* Top accent */}
                <div className={`absolute top-0 left-0 right-0 h-1.5 ${isRec ? 'bg-purple-500' : 'bg-[#E5092E]'}`} />

                <div>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div>
                      <h3 className="font-extrabold text-base text-gray-100 group-hover:text-[#E5092E] transition-colors">
                        {event.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {getTypeBadge(event.type)}
                        {isRec ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            <Repeat className="w-3 h-3 mr-1" />
                            Récurrent
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            Ponctuel
                          </span>
                        )}

                        {allowCancel ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400" title="Places libérables si désinscription">
                            <Unlock className="w-2.5 h-2.5 mr-1" />
                            Libérable
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400" title="Places fixes">
                            <Lock className="w-2.5 h-2.5 mr-1" />
                            Fixe
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        onClick={() => handleOpenEdit(event)}
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-[#1E1E28] rounded-lg transition"
                        title="Modifier l'événement"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(event.id)}
                        className="p-1.5 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                        title="Supprimer l'événement"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-gray-400 mb-3 line-clamp-2 leading-relaxed">
                    {event.description}
                  </p>

                  {/* Event Details Box */}
                  <div className="space-y-2 text-xs text-gray-300 bg-[#171720] p-3 rounded-xl border border-[#242430] mb-3">
                    <div className="flex items-center text-[11px]">
                      <Clock className="w-3.5 h-3.5 text-blue-400 mr-2 shrink-0" />
                      <span className="truncate">
                        {isRec ? (event.recurrencePattern || 'Récurrent') : new Date(event.scheduledStartTime).toLocaleString('fr-FR')}
                      </span>
                    </div>

                    <div className="flex items-center text-[11px]">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400 mr-2 shrink-0" />
                      <span className="truncate">{event.location}</span>
                    </div>

                    {event.speaker && (
                      <div className="flex items-center text-[11px]">
                        <User className="w-3.5 h-3.5 text-purple-400 mr-2 shrink-0" />
                        <span className="truncate">Intervenant : {event.speaker}</span>
                      </div>
                    )}

                    {event.channelName && (
                      <div className="flex items-center text-[11px] text-gray-400">
                        <Hash className="w-3.5 h-3.5 text-[#E5092E] mr-2 shrink-0" />
                        <span>Salon Discord : #{event.channelName}</span>
                      </div>
                    )}
                  </div>

                  {/* Multi-Sessions breakdown */}
                  {sessionsList.length > 0 && (
                    <div className="mb-3 space-y-1.5">
                      <div className="text-[10px] uppercase font-bold text-gray-400 flex items-center">
                        <Layers className="w-3 h-3 mr-1 text-amber-400" />
                        Sessions ({sessionsList.length}) :
                      </div>
                      <div className="space-y-1">
                        {sessionsList.map(s => (
                          <div key={s.id} className="flex items-center justify-between p-1.5 bg-[#1A1A24] rounded-lg text-[11px] text-gray-300">
                            <span className="truncate font-semibold">{s.name}</span>
                            <span className="font-bold text-white shrink-0 ml-2">
                              {s.participantCount || 0}{s.maxParticipants ? `/${s.maxParticipants}` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="pt-3 border-t border-[#1C1C24] space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span className="flex items-center font-bold text-white">
                      <Users className="w-3.5 h-3.5 mr-1 text-blue-400" />
                      {event.participantCount || 0} {event.maxParticipants ? `/ ${event.maxParticipants}` : ''} inscrit(s)
                    </span>
                    <Badge variant={event.status === 'published' ? 'green' : 'amber'}>
                      {event.status === 'published' ? 'Actif' : event.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => setSelectedEventForParticipants(event)}
                      className="py-1.5 px-2 bg-[#1A1A22] hover:bg-[#242430] border border-[#242430] text-gray-200 text-xs font-bold rounded-lg transition flex items-center justify-center space-x-1"
                    >
                      <Users className="w-3.5 h-3.5 text-blue-400" />
                      <span>Inscrits</span>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedEventForDeploy(event);
                        setDeployChannelId(event.channelId || '');
                        setDeployFeedback(null);
                      }}
                      className="py-1.5 px-2 bg-[#1E1E28] hover:bg-[#2A2A3A] border border-[#323246] text-white text-xs font-bold rounded-lg transition flex items-center justify-center space-x-1"
                      title="Poster ou rafraîchir sur Discord"
                    >
                      <Send className="w-3.5 h-3.5 text-[#E5092E]" />
                      <span>Diffuser Discord</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Création / Édition Événement */}
      {(isCreateOpen || editingEvent) && (
        <Modal
          isOpen={true}
          onClose={() => {
            setIsCreateOpen(false);
            setEditingEvent(null);
          }}
          title={editingEvent ? `Modifier l'Événement : ${editingEvent.title}` : 'Planifier un Nouvel Événement / Atelier'}
        >
          <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Titre de l'événement *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="ex: Speaking Circle Anglais, Workshop IA..."
                className="w-full bg-[#1A1A22] border border-[#2E2E3C] rounded-xl px-4 py-2 text-sm text-gray-100 focus:outline-none focus:border-[#E5092E] transition"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  Type d'événement
                </label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value)}
                  className="w-full bg-[#1A1A22] border border-[#2E2E3C] rounded-xl px-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-[#E5092E]"
                >
                  <option value="workshop">🛠️ Workshop / Atelier</option>
                  <option value="conference">🎙️ Conférence</option>
                  <option value="competition">🏆 Hackathon / Concours</option>
                  <option value="training">📖 Masterclass / Formation</option>
                  <option value="field_trip">🪐 Sortie Scientifique</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  Salon Discord de diffusion
                </label>
                <select
                  value={channelId}
                  onChange={e => setChannelId(e.target.value)}
                  className="w-full bg-[#1A1A22] border border-[#2E2E3C] rounded-xl px-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-[#E5092E]"
                >
                  <option value="">Sélectionner un salon Discord...</option>
                  {channels.filter((c: any) => c.type === 'text' || c.type === 0).map((c: any) => (
                    <option key={c.id} value={c.id}>#{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Description & Programme
              </label>
              <textarea
                rows={2}
                required
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Détails, prérequis, objectifs pédagogiques..."
                className="w-full bg-[#1A1A22] border border-[#2E2E3C] rounded-xl px-4 py-2 text-sm text-gray-100 focus:outline-none focus:border-[#E5092E] transition resize-none"
              />
            </div>

            {/* Temporalité & Récurrence */}
            <div className="p-3 bg-[#1A1A22] rounded-xl border border-[#2E2E3C] space-y-3">
              <label className="flex items-center space-x-2 text-xs text-white font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={e => setIsRecurring(e.target.checked)}
                  className="rounded border-[#2E2E3C] text-[#E5092E] focus:ring-[#E5092E] bg-[#121217]"
                />
                <span className="flex items-center">
                  <Repeat className="w-3.5 h-3.5 mr-1.5 text-purple-400" />
                  Événement Récurrent (ex: chaque semaine, chaque mois)
                </span>
              </label>

              {isRecurring ? (
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Fréquence / Périodicité
                  </label>
                  <input
                    type="text"
                    value={recurrencePattern}
                    onChange={e => setRecurrencePattern(e.target.value)}
                    placeholder="ex: Tous les Jeudis à 18h00, Tous les 15 jours..."
                    className="w-full bg-[#121217] border border-[#2E2E3C] rounded-lg px-3 py-1.5 text-xs text-gray-100"
                  />
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    {isRecurring ? 'Prochaine session (Début) *' : 'Date & Heure de début *'}
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full bg-[#121217] border border-[#2E2E3C] rounded-lg px-3 py-1.5 text-xs text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Heure de fin (optionnel)
                  </label>
                  <input
                    type="datetime-local"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full bg-[#121217] border border-[#2E2E3C] rounded-lg px-3 py-1.5 text-xs text-gray-100"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  Lieu (physique ou salon Discord) *
                </label>
                <input
                  type="text"
                  required
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="ex: Labo 3, Vocal Atelier 1..."
                  className="w-full bg-[#1A1A22] border border-[#2E2E3C] rounded-xl px-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-[#E5092E]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                  Intervenant (optionnel)
                </label>
                <input
                  type="text"
                  value={speaker}
                  onChange={e => setSpeaker(e.target.value)}
                  placeholder="ex: Dr. Benali, Chef Pôle..."
                  className="w-full bg-[#1A1A22] border border-[#2E2E3C] rounded-xl px-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-[#E5092E]"
                />
              </div>
            </div>

            {/* Places & Libération */}
            <div className="p-3 bg-[#1A1A22] rounded-xl border border-[#2E2E3C] space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center space-x-2 text-xs text-gray-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasLimit}
                    onChange={e => setHasLimit(e.target.checked)}
                    className="rounded border-[#2E2E3C] text-[#E5092E] focus:ring-[#E5092E] bg-[#121217]"
                  />
                  <span className="font-semibold">Nombre de places limité</span>
                </label>

                {hasLimit && (
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                      Capacité globale (max places)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={maxParticipants}
                      onChange={e => setMaxParticipants(e.target.value ? Number(e.target.value) : '')}
                      className="w-full bg-[#121217] border border-[#2E2E3C] rounded-lg px-3 py-1.5 text-xs text-gray-100"
                    />
                  </div>
                )}
              </div>

              <label className="flex items-center space-x-2 text-xs text-gray-200 cursor-pointer pt-1 border-t border-[#242430]">
                <input
                  type="checkbox"
                  checked={allowCancellation}
                  onChange={e => setAllowCancellation(e.target.checked)}
                  className="rounded border-[#2E2E3C] text-[#E5092E] focus:ring-[#E5092E] bg-[#121217]"
                />
                <span>
                  <b>Places libérables :</b> Autoriser les membres à annuler leur réservation pour libérer la place
                </span>
              </label>
            </div>

            {/* Multi-Sessions Builder */}
            <div className="p-3 bg-[#1A1A22] rounded-xl border border-[#2E2E3C] space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2 text-xs text-white font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasMultipleSessions}
                    onChange={e => setHasMultipleSessions(e.target.checked)}
                    className="rounded border-[#2E2E3C] text-[#E5092E] focus:ring-[#E5092E] bg-[#121217]"
                  />
                  <span className="flex items-center">
                    <Layers className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                    Diviser en plusieurs sessions (ex: Speaking Circle 2 créneaux)
                  </span>
                </label>

                {hasMultipleSessions && (
                  <button
                    type="button"
                    onClick={addSessionRow}
                    className="text-xs font-bold text-[#E5092E] hover:underline flex items-center"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Ajouter session
                  </button>
                )}
              </div>

              {hasMultipleSessions && (
                <div className="space-y-2 pt-1">
                  {sessions.map((sess, idx) => (
                    <div key={idx} className="flex items-center space-x-2 bg-[#121217] p-2 rounded-lg border border-[#242430]">
                      <input
                        type="text"
                        required
                        value={sess.name}
                        onChange={e => updateSessionRow(idx, 'name', e.target.value)}
                        placeholder="Nom de la session (ex: Session Matin 10h)"
                        className="flex-1 bg-transparent border-0 text-xs text-white focus:outline-none"
                      />
                      <div className="flex items-center space-x-1 shrink-0">
                        <span className="text-[10px] text-gray-500 uppercase font-semibold">Max :</span>
                        <input
                          type="number"
                          min="0"
                          value={sess.maxParticipants}
                          onChange={e => updateSessionRow(idx, 'maxParticipants', e.target.value ? Number(e.target.value) : '')}
                          placeholder="0 = illimité"
                          className="w-16 bg-[#1A1A22] border border-[#2E2E3C] rounded px-2 py-1 text-xs text-white text-center"
                        />
                      </div>
                      {sessions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSessionRow(idx)}
                          className="text-gray-500 hover:text-rose-400 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <p className="text-[11px] text-gray-400 italic">
                    Chaque session disposera de son propre quota et apparaîtra dans le menu déroulant Discord !
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-3">
              <button
                type="button"
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditingEvent(null);
                }}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded-xl transition"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="px-5 py-2 bg-[#E5092E] hover:bg-[#c00725] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition shadow-md shadow-[#E5092E]/25"
              >
                {createMutation.isPending || updateMutation.isPending ? 'Enregistrement...' : (editingEvent ? 'Mettre à jour & Synchroniser' : 'Créer l\'Événement')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Consultation des Inscrits (Staff Only) */}
      {selectedEventForParticipants && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedEventForParticipants(null)}
          title={`Inscrits — ${selectedEventForParticipants.title}`}
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="p-3 bg-[#1A1A22] border border-[#242430] rounded-xl flex items-center justify-between text-xs">
              <div>
                <span className="text-gray-400">Total participants enregistrés : </span>
                <span className="font-extrabold text-white text-sm ml-1">{participants.length}</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                🔒 Liste Staff Confidentielle
              </span>
            </div>

            {isParticipantsLoading ? (
              <div className="py-8 text-center text-gray-500 text-xs">Chargement des participants...</div>
            ) : participants.length === 0 ? (
              <div className="py-8 text-center text-gray-500 text-xs bg-[#171720] rounded-xl border border-[#242430]">
                Aucun participant n'est encore inscrit pour cet événement.
              </div>
            ) : (
              <div className="space-y-2.5">
                {participants.map(p => (
                  <div
                    key={p.id}
                    className="p-3 bg-[#171720] border border-[#242430] rounded-xl flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center space-x-3">
                      {p.avatarUrl ? (
                        <img src={p.avatarUrl} alt="" className="w-8 h-8 rounded-full border border-gray-700" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center font-bold text-xs text-white">
                          {p.displayName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-white flex items-center">
                          {p.firstName || ''} {p.lastName || ''}
                          <span className="text-gray-400 font-normal ml-1.5 text-[11px]">(@{p.username || p.userId})</span>
                        </div>
                        <div className="text-[11px] text-gray-400">
                          📧 <span className="text-gray-300">{p.email || 'non spécifié'}</span>
                          {p.sessionName && (
                            <span className="ml-2 px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-semibold text-[10px]">
                              {p.sessionName}
                            </span>
                          )}
                        </div>
                        {p.notes && (
                          <div className="text-[10px] text-amber-400/90 italic mt-0.5">
                            Note : {p.notes}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => removeParticipantMutation.mutate({ eventId: selectedEventForParticipants.id, participantId: p.id })}
                      disabled={removeParticipantMutation.isPending}
                      className="p-1.5 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                      title="Retirer ce participant et libérer la place"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedEventForParticipants(null)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded-xl transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Déploiement Discord */}
      {selectedEventForDeploy && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedEventForDeploy(null)}
          title={`Diffuser sur Discord — ${selectedEventForDeploy.title}`}
        >
          <form
            onSubmit={e => {
              e.preventDefault();
              deployMutation.mutate({ eventId: selectedEventForDeploy.id, channelId: deployChannelId });
            }}
            className="space-y-4"
          >
            {deployFeedback && (
              <div className={`p-3 rounded-xl text-xs font-bold flex items-center ${
                deployFeedback.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
              }`}>
                {deployFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <AlertCircle className="w-4 h-4 mr-2" />}
                {deployFeedback.message}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Salon Discord où poster l'événement *
              </label>
              <select
                required
                value={deployChannelId}
                onChange={e => setDeployChannelId(e.target.value)}
                className="w-full bg-[#1A1A22] border border-[#2E2E3C] rounded-xl px-4 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-[#E5092E] transition"
              >
                <option value="">Sélectionnez un salon textuel...</option>
                {channels.filter((c: any) => c.type === 'text' || c.type === 0).map((c: any) => (
                  <option key={c.id} value={c.id}>#{c.name}</option>
                ))}
              </select>
            </div>

            <div className="p-3 bg-[#1A1A22] rounded-xl border border-[#2E2E3C] text-xs text-gray-300 space-y-1">
              <span className="font-bold text-white block">💡 Ce que verront les membres :</span>
              <p>Un embed élégant avec les détails de l'événement, les quotas en direct, et les boutons interactifs pour choisir leur session et remplir le formulaire (Nom, Prénom, Email).</p>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedEventForDeploy(null)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded-xl transition"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={deployMutation.isPending || !deployChannelId}
                className="px-5 py-2 bg-[#E5092E] hover:bg-[#c00725] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition shadow-md shadow-[#E5092E]/25 flex items-center"
              >
                <Send className="w-3.5 h-3.5 mr-2" />
                {deployMutation.isPending ? 'Envoi en cours...' : 'Envoyer dans le salon'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
