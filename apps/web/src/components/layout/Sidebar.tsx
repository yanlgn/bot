import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Shield,
  Hash,
  KeyRound,
  Users,
  Rocket,
  Calendar,
  BookOpen,
  AlertOctagon,
  FileCode,
  ScrollText
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Sidebar: React.FC = () => {
  const { activeGuild } = useAuth();
  const guildId = activeGuild?.id;

  const navItems = [
    { label: 'Vue d\'ensemble', path: `/dashboard/${guildId}`, icon: LayoutDashboard },
    { label: 'Rôles Discord', path: `/dashboard/${guildId}/roles`, icon: Shield },
    { label: 'Salons & Pôles', path: `/dashboard/${guildId}/channels`, icon: Hash },
    { label: 'Permissions', path: `/dashboard/${guildId}/permissions`, icon: KeyRound },
    { label: 'Membres', path: `/dashboard/${guildId}/members`, icon: Users },
    { label: 'Projets Club', path: `/dashboard/${guildId}/projects`, icon: Rocket },
    { label: 'Événements', path: `/dashboard/${guildId}/events`, icon: Calendar },
    { label: 'Ressources', path: `/dashboard/${guildId}/resources`, icon: BookOpen },
    { label: 'Modération', path: `/dashboard/${guildId}/moderation`, icon: AlertOctagon },
    { label: 'Configuration JSON', path: `/dashboard/${guildId}/config`, icon: FileCode },
    { label: 'Logs d\'Audit', path: `/dashboard/${guildId}/audit-logs`, icon: ScrollText }
  ];

  return (
    <aside className="w-64 bg-[#0F172A] border-r border-gray-800 flex flex-col h-screen fixed left-0 top-0 z-30">
      {/* SciClub Logo Header */}
      <div className="h-16 flex items-center px-6 border-b border-gray-800 space-x-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
          <Rocket className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-gray-100 text-sm tracking-wide">SciClub Manager</h1>
          <span className="text-[10px] text-blue-400 font-medium tracking-wider uppercase">Plateforme Discord</span>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-4 px-3 overflow-y-auto space-y-1">
        <div className="px-3 pb-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
          Gestion du Club
        </div>

        {navItems.map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === `/dashboard/${guildId}`}
              className={({ isActive }) =>
                `flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800/60'
                }`
              }
            >
              <Icon className="w-4 h-4 mr-3 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>

      {/* Guild Info Footer */}
      <div className="p-4 border-t border-gray-800 bg-[#0B0F19]/50">
        <div className="flex items-center space-x-3">
          {activeGuild?.iconUrl ? (
            <img src={activeGuild.iconUrl} alt={activeGuild.name} className="w-8 h-8 rounded-full" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-300">
              {activeGuild?.name.slice(0, 2).toUpperCase() || 'SC'}
            </div>
          )}
          <div className="truncate">
            <p className="text-xs font-semibold text-gray-200 truncate">{activeGuild?.name || 'Serveur'}</p>
            <p className="text-[10px] text-emerald-400 flex items-center">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full mr-1 animate-pulse" />
              Connecté
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};
