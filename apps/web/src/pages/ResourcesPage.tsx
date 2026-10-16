import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { ResourceRecord, ScientificCategories } from '@sciclub/shared';
import { BookOpen, Plus, ExternalLink, Filter, Tag } from 'lucide-react';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';

export const ResourcesPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const queryClient = useQueryClient();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState<any>('ia');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  const { data: resources = [], isLoading } = useQuery<ResourceRecord[]>({
    queryKey: ['resources', guildId],
    queryFn: () => apiFetch(`/guilds/${guildId}/resources`),
    enabled: !!guildId
  });

  const createMutation = useMutation({
    mutationFn: (newRes: any) =>
      apiFetch(`/guilds/${guildId}/resources`, { method: 'POST', body: JSON.stringify(newRes) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources', guildId] });
      setIsCreateOpen(false);
      resetForm();
    }
  });

  const resetForm = () => {
    setTitle('');
    setUrl('');
    setCategory('ia');
    setDescription('');
    setTagsInput('');
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    createMutation.mutate({
      title,
      url,
      category,
      description,
      tags,
      publishToDiscord: true
    });
  };

  const filtered = selectedCategory === 'all'
    ? resources
    : resources.filter(r => r.category === selectedCategory);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center">
            <BookOpen className="w-6 h-6 mr-3 text-blue-400" />
            Bibliothèque Scientifique & Veille
          </h1>
          <p className="text-sm text-gray-400">
            Base de connaissances partagée : articles de recherche, dépôts GitHub, vidéos et MOOCs.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition shadow-md shadow-blue-500/20"
        >
          <Plus className="w-4 h-4 mr-2" />
          Ajouter une Ressource
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2">
        <Filter className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition shrink-0 ${
            selectedCategory === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-gray-200'
          }`}
        >
          Toutes ({resources.length})
        </button>
        {ScientificCategories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium uppercase transition shrink-0 ${
              selectedCategory === cat
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Resource Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full py-12 text-center text-gray-500">
            Chargement des ressources...
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-12 text-center text-gray-500 bg-[#111827] border border-gray-800 rounded-xl">
            Aucune ressource dans cette catégorie.
          </div>
        ) : (
          filtered.map(res => (
            <div
              key={res.id}
              className="bg-[#111827] border border-gray-800 rounded-xl p-6 shadow-xl flex flex-col justify-between hover:border-gray-700 transition"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="purple">{res.category.toUpperCase()}</Badge>
                  <span className="text-[11px] text-gray-500">
                    {new Date(res.createdAt).toLocaleDateString('fr-FR')}
                  </span>
                </div>

                <h3 className="font-semibold text-gray-100 text-base mb-2 line-clamp-2">
                  {res.title}
                </h3>

                <p className="text-xs text-gray-400 mb-4 line-clamp-3">
                  {res.description}
                </p>

                {res.tags && res.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {res.tags.map(t => (
                      <span
                        key={t}
                        className="inline-flex items-center text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded"
                      >
                        <Tag className="w-2.5 h-2.5 mr-1" />
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-gray-800 flex items-center justify-between">
                <span className="text-xs text-gray-500">ID Auteur: {res.authorId}</span>
                <a
                  href={res.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center text-xs font-semibold text-blue-400 hover:text-blue-300"
                >
                  Accéder <ExternalLink className="w-3.5 h-3.5 ml-1" />
                </a>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Ajout Ressource */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Partager une ressource scientifique"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Titre
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: Cours complet : Introduction à la Vision par Ordinateur"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Discipline
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
              >
                {ScientificCategories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Lien Web (URL)
              </label>
              <input
                type="url"
                required
                value={url}
                onChange={e => setUrl(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://..."
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Tags (séparés par des virgules)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="opencv, deeplearning, python"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Description & Résumé
            </label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Présentation rapide du document ou de la ressource..."
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
              Publier la ressource
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
