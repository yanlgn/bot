import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { EventRecord } from '@sciclub/shared';
import { Calendar, Plus, MapPin, User, Users, Clock, Tag } from 'lucide-react';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';

export const EventsPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const queryClient = useQueryClient();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<any>('conference');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [speaker, setSpeaker] = useState('');
  const [maxParticipants, setMaxParticipants] = useState<number | ''>('');
  const [targetAudience, setTargetAudience] = useState('');

  const { data: events = [], isLoading } = useQuery<EventRecord[]>({
    queryKey: ['events', guildId],
    queryFn: () => apiFetch(`/guilds/${guildId}/events`),
    enabled: !!guildId
  });

  const createMutation = useMutation({
    mutationFn: (newEvent: any) =>
      apiFetch(`/guilds/${guildId}/events`, { method: 'POST', body: JSON.stringify(newEvent) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', guildId] });
      setIsCreateOpen(false);
      resetForm();
    }
  });

  const resetForm = () => {
    setTitle('');
    setType('conference');
    setDescription('');
    setDate('');
    setLocation('');
    setSpeaker('');
    setMaxParticipants('');
    setTargetAudience('');
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      title,
      type,
      description,
      scheduledStartTime: new Date(date).toISOString(),
      location,
      speaker: speaker || null,
      maxParticipants: maxParticipants ? Number(maxParticipants) : null,
      targetAudience: targetAudience || null,
      createParticipantRole: true
    });
  };

  const getTypeBadge = (eventType: string) => {
    switch (eventType) {
      case 'conference': return <Badge variant="blue">Conférence</Badge>;
      case 'workshop': return <Badge variant="green">Workshop / Atelier</Badge>;
      case 'competition': return <Badge variant="purple">Hackathon / Concours</Badge>;
      case 'field_trip': return <Badge variant="amber">Sortie Scientifique</Badge>;
      case 'training': return <Badge variant="gray">Formation</Badge>;
      default: return <Badge variant="gray">{eventType}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center">
            <Calendar className="w-6 h-6 mr-3 text-blue-400" />
            Événements, Conférences & Ateliers
          </h1>
          <p className="text-sm text-gray-400">
            Planifiez les activités du club, gérez les inscriptions et attribuez automatiquement les rôles participants.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition shadow-md shadow-blue-500/20"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nouvel Événement
        </button>
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full py-12 text-center text-gray-500">
            Chargement des événements...
          </div>
        ) : events.length === 0 ? (
          <div className="col-span-full py-12 text-center text-gray-500 bg-[#111827] border border-gray-800 rounded-xl">
            Aucun événement scientifique planifié.
          </div>
        ) : (
          events.map(event => (
            <div
              key={event.id}
              className="bg-[#111827] border border-gray-800 rounded-xl p-6 shadow-xl flex flex-col justify-between hover:border-gray-700 transition"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-lg text-gray-100">{event.title}</h3>
                  {getTypeBadge(event.type)}
                </div>

                <p className="text-sm text-gray-400 mb-4 line-clamp-3">
                  {event.description}
                </p>

                <div className="space-y-2 text-xs text-gray-300 bg-gray-900/60 p-3.5 rounded-lg border border-gray-800 mb-4">
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 text-blue-400 mr-2 shrink-0" />
                    <span>{new Date(event.scheduledStartTime).toLocaleString('fr-FR')}</span>
                  </div>
                  <div className="flex items-center">
                    <MapPin className="w-4 h-4 text-emerald-400 mr-2 shrink-0" />
                    <span className="truncate">{event.location}</span>
                  </div>
                  {event.speaker && (
                    <div className="flex items-center">
                      <User className="w-4 h-4 text-purple-400 mr-2 shrink-0" />
                      <span>Intervenant : {event.speaker}</span>
                    </div>
                  )}
                  {event.targetAudience && (
                    <div className="flex items-center">
                      <Tag className="w-4 h-4 text-amber-400 mr-2 shrink-0" />
                      <span>Public : {event.targetAudience}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-800 flex items-center justify-between text-xs text-gray-400">
                <span className="flex items-center">
                  <Users className="w-4 h-4 mr-1 text-blue-400" />
                  {event.participantCount || 0} / {event.maxParticipants || '∞'} inscrits
                </span>
                <Badge variant={event.status === 'published' ? 'green' : 'amber'}>
                  {event.status}
                </Badge>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Créer Événement */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Créer un événement scientifique"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Titre de l'événement
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: Conférence : Télescope James Webb & Cosmologie"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Type
              </label>
              <select
                value={type}
                onChange={e => setType(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="conference">Conférence</option>
                <option value="workshop">Atelier / Workshop</option>
                <option value="competition">Hackathon / Concours</option>
                <option value="field_trip">Sortie scientifique</option>
                <option value="training">Séance de formation</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Date & Heure
              </label>
              <input
                type="datetime-local"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Lieu physique ou lien en ligne
            </label>
            <input
              type="text"
              required
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: Amphithéâtre Marie Curie ou Salon Vocal Discord"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Intervenant
              </label>
              <input
                type="text"
                value={speaker}
                onChange={e => setSpeaker(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: Dr. A. Dupont"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Nombre de places max
              </label>
              <input
                type="number"
                min={1}
                value={maxParticipants}
                onChange={e => setMaxParticipants(e.target.value ? Number(e.target.value) : '')}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Illimité si vide"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Public cible
            </label>
            <input
              type="text"
              value={targetAudience}
              onChange={e => setTargetAudience(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: Tous niveaux / Étudiants en L3 Master"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Description complète
            </label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Présentation du sujet, prérequis..."
            />
          </div>

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
              Publier l'événement
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
