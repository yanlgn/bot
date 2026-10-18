import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Layers,
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
    { label: 'Pôles Scientifiques', path: `/dashboard/${guildId}/departments`, icon: Layers },
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
    <aside className="w-64 bg-[#0B0B0D] border-r border-[#1C1C24] flex flex-col h-screen fixed left-0 top-0 z-30">
      {/* Cortex Logo Header */}
      <div className="h-16 flex items-center px-5 border-b border-[#1C1C24] space-x-3 bg-[#0B0B0D]">
        <img
          src="/cortex-emblem.png"
          alt="CORTEX"
          className="w-9 h-9 rounded-full shrink-0 drop-shadow-[0_0_10px_rgba(229,9,46,0.4)]"
        />
        <div className="truncate">
          <h1 className="font-extrabold text-white text-sm tracking-wider flex items-center">
            CORT<span className="text-[#E5092E] font-black tracking-tight inline-flex flex-col justify-center leading-none mx-0.5"><span className="h-[2px] w-2.5 bg-[#E5092E] my-[0.8px] rounded-sm"></span><span className="h-[2px] w-2.5 bg-[#E5092E] my-[0.8px] rounded-sm"></span><span className="h-[2px] w-2.5 bg-[#E5092E] my-[0.8px] rounded-sm"></span></span>X
          </h1>
          <span className="text-[9px] text-[#E5092E] font-semibold tracking-[0.2em] uppercase">SCIENTIFIC CLUB</span>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-4 px-3 overflow-y-auto space-y-1">
        <div className="px-3 pb-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
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
                `flex items-center px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? 'bg-[#E5092E] text-white shadow-lg shadow-[#E5092E]/25'
                    : 'text-gray-400 hover:text-white hover:bg-[#16161D]'
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
      <div className="p-3.5 border-t border-[#1C1C24] bg-[#111116]/80">
        <div className="flex items-center space-x-3">
          {activeGuild?.iconUrl ? (
            <img src={activeGuild.iconUrl} alt={activeGuild.name} className="w-8 h-8 rounded-xl border border-[#242430]" />
          ) : (
            <div className="w-8 h-8 rounded-xl bg-[#1C1C24] border border-[#242430] flex items-center justify-center text-xs font-bold text-gray-300">
              {activeGuild?.name.slice(0, 2).toUpperCase() || 'CX'}
            </div>
          )}
          <div className="truncate">
            <p className="text-xs font-bold text-white truncate">{activeGuild?.name || 'Serveur'}</p>
            <p className="text-[10px] text-emerald-400 flex items-center font-medium">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full mr-1 animate-pulse" />
              Cortex Connecté
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};
