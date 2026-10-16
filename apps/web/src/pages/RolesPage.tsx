import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { DiscordRoleData } from '@sciclub/shared';
import { Shield, Plus, Trash2, Edit3, Lock, Users } from 'lucide-react';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

export const RolesPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const queryClient = useQueryClient();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<DiscordRoleData | null>(null);
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);

  // Form states
  const [roleName, setRoleName] = useState('');
  const [roleColor, setRoleColor] = useState('#3B82F6');
  const [roleHoist, setRoleHoist] = useState(false);
  const [roleMentionable, setRoleMentionable] = useState(false);

  const { data: roles = [], isLoading } = useQuery<DiscordRoleData[]>({
    queryKey: ['roles', guildId],
    queryFn: () => apiFetch(`/guilds/${guildId}/roles`),
    enabled: !!guildId
  });

  const createRoleMutation = useMutation({
    mutationFn: (newRole: any) =>
      apiFetch(`/guilds/${guildId}/roles`, { method: 'POST', body: JSON.stringify(newRole) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles', guildId] });
      setIsCreateModalOpen(false);
      resetForm();
    }
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ roleId, data }: { roleId: string; data: any }) =>
      apiFetch(`/guilds/${guildId}/roles/${roleId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles', guildId] });
      setEditingRole(null);
      resetForm();
    }
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (roleId: string) =>
      apiFetch(`/guilds/${guildId}/roles/${roleId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles', guildId] });
      setDeletingRoleId(null);
    }
  });

  const resetForm = () => {
    setRoleName('');
    setRoleColor('#3B82F6');
    setRoleHoist(false);
    setRoleMentionable(false);
  };

  const handleOpenEdit = (role: DiscordRoleData) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleColor(role.hexColor);
    setRoleHoist(role.hoist);
    setRoleMentionable(role.mentionable);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRole) {
      updateRoleMutation.mutate({
        roleId: editingRole.id,
        data: {
          name: roleName,
          color: roleColor,
          hoist: roleHoist,
          mentionable: roleMentionable
        }
      });
    } else {
      createRoleMutation.mutate({
        name: roleName,
        color: roleColor,
        hoist: roleHoist,
        mentionable: roleMentionable,
        permissions: []
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center">
            <Shield className="w-6 h-6 mr-3 text-blue-400" />
            Gestion des Rôles
          </h1>
          <p className="text-sm text-gray-400">
            Créez, modifiez et protégez les rôles Discord selon la hiérarchie officielle du club.
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setIsCreateModalOpen(true);
          }}
          className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition shadow-md shadow-blue-500/20"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nouveau Rôle
        </button>
      </div>

      {/* Roles Table */}
      <div className="bg-[#111827] border border-gray-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-[#1E293B]/60 text-xs text-gray-400 uppercase tracking-wider border-b border-gray-800">
              <tr>
                <th className="py-3.5 px-6">Nom du Rôle</th>
                <th className="py-3.5 px-6">Membres</th>
                <th className="py-3.5 px-6">Position</th>
                <th className="py-3.5 px-6">Affiché Séparément</th>
                <th className="py-3.5 px-6">Mentionnable</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    Chargement des rôles Discord...
                  </td>
                </tr>
              ) : roles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    Aucun rôle trouvé.
                  </td>
                </tr>
              ) : (
                roles.map(role => (
                  <tr key={role.id} className="hover:bg-gray-800/40 transition">
                    <td className="py-4 px-6 flex items-center space-x-3">
                      <div
                        className="w-3.5 h-3.5 rounded-full shrink-0"
                        style={{ backgroundColor: role.hexColor }}
                      />
                      <span className="font-semibold text-gray-200">{role.name}</span>
                      {role.isBotHighest && (
                        <Badge variant="purple">Rôle le plus haut du bot</Badge>
                      )}
                      {!role.isEditable && (
                        <span title="Protégé : supérieur au bot ou rôle système">
                          <Lock className="w-3.5 h-3.5 text-gray-500" />
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-gray-400">
                      <span className="flex items-center">
                        <Users className="w-3.5 h-3.5 mr-1.5 text-gray-500" />
                        {role.memberCount ?? 0}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-gray-400">{role.position}</td>
                    <td className="py-4 px-6">
                      <Badge variant={role.hoist ? 'green' : 'gray'}>
                        {role.hoist ? 'Oui' : 'Non'}
                      </Badge>
                    </td>
                    <td className="py-4 px-6">
                      <Badge variant={role.mentionable ? 'blue' : 'gray'}>
                        {role.mentionable ? 'Oui' : 'Non'}
                      </Badge>
                    </td>
                    <td className="py-4 px-6 text-right space-x-2">
                      {role.isEditable ? (
                        <>
                          <button
                            onClick={() => handleOpenEdit(role)}
                            className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-800 rounded-lg transition"
                            title="Modifier"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeletingRoleId(role.id)}
                            className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-gray-800 rounded-lg transition"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-gray-500 italic">Non modifiable</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Créer / Modifier un Rôle */}
      <Modal
        isOpen={isCreateModalOpen || !!editingRole}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingRole(null);
          resetForm();
        }}
        title={editingRole ? `Modifier le rôle "${editingRole.name}"` : 'Créer un nouveau rôle'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Nom du Rôle
            </label>
            <input
              type="text"
              required
              value={roleName}
              onChange={e => setRoleName(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: Responsable IA"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Couleur (Hexadécimal)
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="color"
                value={roleColor}
                onChange={e => setRoleColor(e.target.value)}
                className="w-10 h-10 rounded cursor-pointer bg-transparent border-0"
              />
              <input
                type="text"
                value={roleColor}
                onChange={e => setRoleColor(e.target.value)}
                className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={roleHoist}
                onChange={e => setRoleHoist(e.target.checked)}
                className="rounded bg-gray-900 border-gray-700 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-300">Afficher séparément des autres membres en ligne</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={roleMentionable}
                onChange={e => setRoleMentionable(e.target.checked)}
                className="rounded bg-gray-900 border-gray-700 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-300">Permettre à tout le monde de mentionner ce rôle</span>
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-800">
            <button
              type="button"
              onClick={() => {
                setIsCreateModalOpen(false);
                setEditingRole(null);
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
              {editingRole ? 'Mettre à jour' : 'Créer le rôle'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmation de Suppression */}
      <ConfirmDialog
        isOpen={!!deletingRoleId}
        onClose={() => setDeletingRoleId(null)}
        onConfirm={() => deletingRoleId && deleteRoleMutation.mutate(deletingRoleId)}
        title="Supprimer ce rôle ?"
        message="Êtes-vous sûr de vouloir supprimer définitivement ce rôle ? Cette action retirera le rôle de tous les membres associés sur Discord."
        confirmLabel="Supprimer"
      />
    </div>
  );
};
