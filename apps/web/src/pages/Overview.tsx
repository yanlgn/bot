import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import {
  Users,
  Shield,
  Hash,
  Rocket,
  Calendar,
  BookOpen,
  Award,
  Activity
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

export const Overview: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['stats', guildId],
    queryFn: () => apiFetch<any>(`/guilds/${guildId}/stats`),
    enabled: !!guildId
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-800 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-[#111827] rounded-xl border border-gray-800 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-rose-950/20 border border-rose-800 text-rose-300 p-6 rounded-xl">
        Erreur lors de la récupération des statistiques du serveur.
      </div>
    );
  }

  const { guild, counts, topMembers, recentActivity } = data;

  const statCards = [
    { label: 'Membres Discord', value: guild.memberCount, icon: Users, color: 'text-blue-400', bg: 'bg-blue-900/20' },
    { label: 'Rôles Définis', value: guild.roleCount, icon: Shield, color: 'text-amber-400', bg: 'bg-amber-900/20' },
    { label: 'Salons & Pôles', value: guild.channelCount, icon: Hash, color: 'text-purple-400', bg: 'bg-purple-900/20' },
    { label: 'Projets Scientifiques', value: counts.projects, icon: Rocket, color: 'text-emerald-400', bg: 'bg-emerald-900/20' }
  ];

  const chartData = [
    { name: 'Membres', count: guild.memberCount },
    { name: 'Rôles', count: guild.roleCount },
    { name: 'Salons', count: guild.channelCount },
    { name: 'Projets', count: counts.projects },
    { name: 'Événements', count: counts.events },
    { name: 'Ressources', count: counts.resources }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-100">{guild.name}</h1>
        <p className="text-sm text-gray-400">Tableau de bord scientifique & indicateurs d'activité</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="bg-[#111827] border border-gray-800 rounded-xl p-5 flex items-center justify-between shadow-lg"
            >
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{card.label}</p>
                <p className="text-2xl font-bold text-gray-100 mt-1">{card.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl ${card.bg} ${card.color} flex items-center justify-center`}>
                <Icon className="w-6 h-6" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Second Row: Bar Chart & Top Members */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Distribution Chart */}
        <div className="lg:col-span-2 bg-[#111827] border border-gray-800 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-gray-100">Répartition des Entités du Club</h3>
              <p className="text-xs text-gray-400">Données en direct issues du serveur Discord et de la base SciClub</p>
            </div>
            <Activity className="w-5 h-5 text-blue-400" />
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#6B7280" fontSize={12} tickLine={false} />
                <YAxis stroke="#6B7280" fontSize={12} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', borderRadius: '0.5rem', color: '#F3F4F6' }}
                />
                <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Members Leaderboard */}
        <div className="bg-[#111827] border border-gray-800 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-100 flex items-center">
              <Award className="w-5 h-5 text-amber-400 mr-2" />
              Membres les Plus Actifs
            </h3>
          </div>

          {topMembers.length === 0 ? (
            <p className="text-xs text-gray-500 py-6 text-center">Aucun point attribué pour l'instant.</p>
          ) : (
            <div className="space-y-3">
              {topMembers.map((member: any, i: number) => (
                <div
                  key={member.userId}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-900/60 border border-gray-800 text-sm"
                >
                  <div className="flex items-center space-x-3">
                    <span className="font-bold text-gray-400 text-xs w-4">#{i + 1}</span>
                    <span className="text-gray-200 font-medium">ID: {member.userId}</span>
                  </div>
                  <span className="font-semibold text-emerald-400">{member.balance} pts</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Third Row: Recent Activity Log */}
      <div className="bg-[#111827] border border-gray-800 rounded-xl p-6 shadow-lg">
        <h3 className="font-semibold text-gray-100 mb-4">Activités & Logs Récents</h3>
        {recentActivity.length === 0 ? (
          <p className="text-xs text-gray-500 py-4 text-center">Aucune activité enregistrée.</p>
        ) : (
          <div className="divide-y divide-gray-800">
            {recentActivity.map((log: any) => (
              <div key={log.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-blue-400 mr-2">[{log.action}]</span>
                  <span className="text-gray-300">{log.details}</span>
                  <span className="text-gray-500 ml-2">par {log.username}</span>
                </div>
                <span className="text-gray-500 shrink-0">
                  {new Date(log.createdAt).toLocaleString('fr-FR')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
