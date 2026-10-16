import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { AuditLogRecord } from '@sciclub/shared';
import { ScrollText, Search, Shield, Filter } from 'lucide-react';
import { Badge } from '../components/common/Badge';

export const AuditLogsPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const [filterType, setFilterType] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  const { data: logs = [], isLoading } = useQuery<AuditLogRecord[]>({
    queryKey: ['audit-logs', guildId],
    queryFn: () => apiFetch(`/guilds/${guildId}/audit-logs`),
    enabled: !!guildId
  });

  const getTargetBadge = (type: string) => {
    switch (type) {
      case 'role': return <Badge variant="amber">Rôle</Badge>;
      case 'channel': return <Badge variant="blue">Salon</Badge>;
      case 'permission': return <Badge variant="purple">Permission</Badge>;
      case 'member': return <Badge variant="red">Membre</Badge>;
      case 'project': return <Badge variant="green">Projet</Badge>;
      case 'event': return <Badge variant="blue">Événement</Badge>;
      case 'config': return <Badge variant="gray">Configuration</Badge>;
      default: return <Badge variant="gray">{type}</Badge>;
    }
  };

  const filtered = logs.filter(log => {
    const matchType = filterType === 'all' || log.targetType === filterType;
    const matchSearch =
      search === '' ||
      log.username.toLowerCase().includes(search.toLowerCase()) ||
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.details.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center">
            <ScrollText className="w-6 h-6 mr-3 text-blue-400" />
            Journal d'Audit des Actions Sensibles
          </h1>
          <p className="text-sm text-gray-400">
            Traçabilité complète des modifications administratives effectuées via le Bot Discord et le Dashboard Web.
          </p>
        </div>

        {/* Filters and Search */}
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Rechercher dans les logs..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-[#111827] border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-xs text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="bg-[#111827] border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Toutes les cibles</option>
              <option value="role">Rôles</option>
              <option value="channel">Salons</option>
              <option value="permission">Permissions</option>
              <option value="member">Membres</option>
              <option value="project">Projets</option>
              <option value="event">Événements</option>
              <option value="config">Configuration</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-[#111827] border border-gray-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-[#1E293B]/60 text-xs text-gray-400 uppercase tracking-wider border-b border-gray-800">
              <tr>
                <th className="py-3.5 px-6">Date & Heure</th>
                <th className="py-3.5 px-6">Opérateur</th>
                <th className="py-3.5 px-6">Cible</th>
                <th className="py-3.5 px-6">Action</th>
                <th className="py-3.5 px-6">Détails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-500">
                    Chargement du journal d'audit...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-500">
                    Aucun log d'audit ne correspond à vos critères.
                  </td>
                </tr>
              ) : (
                filtered.map(log => (
                  <tr key={log.id} className="hover:bg-gray-800/40 transition">
                    <td className="py-3.5 px-6 text-xs text-gray-400 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('fr-FR')}
                    </td>
                    <td className="py-3.5 px-6 font-medium text-gray-200 text-xs flex items-center space-x-1.5">
                      <Shield className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span>{log.username}</span>
                    </td>
                    <td className="py-3.5 px-6">{getTargetBadge(log.targetType)}</td>
                    <td className="py-3.5 px-6 font-mono text-xs font-semibold text-blue-400">
                      {log.action}
                    </td>
                    <td className="py-3.5 px-6 text-xs text-gray-300 max-w-md truncate">
                      {log.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
