import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LogOut, ChevronDown, Server } from 'lucide-react';

export const Header: React.FC = () => {
  const { user, activeGuild, setActiveGuildId, logout } = useAuth();
  const navigate = useNavigate();

  const handleGuildChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newGuildId = e.target.value;
    setActiveGuildId(newGuildId);
    navigate(`/dashboard/${newGuildId}`);
  };

  const avatarUrl = user?.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
    : 'https://cdn.discordapp.com/embed/avatars/0.png';

  return (
    <header className="h-16 bg-[#0B0B0D]/90 backdrop-blur-md border-b border-[#1C1C24] flex items-center justify-between px-8 sticky top-0 z-20">
      {/* Sélecteur de Serveur */}
      <div className="flex items-center space-x-3">
        <Server className="w-5 h-5 text-[#E5092E]" />
        <div className="relative">
          <select
            value={activeGuild?.id || ''}
            onChange={handleGuildChange}
            className="appearance-none bg-[#16161D] text-gray-200 text-xs font-semibold py-2 pl-3 pr-8 rounded-xl border border-[#242430] hover:border-[#E5092E] focus:outline-none focus:ring-2 focus:ring-[#E5092E] cursor-pointer"
          >
            {user?.guilds.filter(g => g.hasBot).map(g => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-2.5 pointer-events-none" />
        </div>
      </div>

      {/* Profil Utilisateur & Déconnexion */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-3">
          <img src={avatarUrl} alt={user?.username} className="w-8 h-8 rounded-full border border-gray-700" />
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-gray-200">{user?.username}</p>
            <p className="text-[10px] text-gray-400">Administrateur</p>
          </div>
        </div>

        <button
          onClick={logout}
          title="Se déconnecter"
          className="p-2 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-900/20 transition"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
