import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, UserGuild } from '../context/AuthContext';
import { Server, ArrowRight, ShieldAlert } from 'lucide-react';

export const GuildSelect: React.FC = () => {
  const { user, setActiveGuildId } = useAuth();
  const navigate = useNavigate();

  const handleSelect = (guild: UserGuild) => {
    setActiveGuildId(guild.id);
    navigate(`/dashboard/${guild.id}`);
  };

  const guilds = user?.guilds || [];

  return (
    <div className="min-h-screen bg-[#0B0F19] p-8 flex flex-col items-center justify-center">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-100 mb-2">Sélectionnez un serveur</h1>
          <p className="text-gray-400 text-sm">
            Choisissez le serveur de votre club scientifique à configurer et administrer.
          </p>
        </div>

        {guilds.length === 0 ? (
          <div className="bg-[#111827] border border-gray-800 rounded-2xl p-8 text-center">
            <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-200 mb-2">Aucun serveur administrable trouvé</h2>
            <p className="text-sm text-gray-400 max-w-md mx-auto mb-6">
              Le bot SciClub doit être présent sur votre serveur et vous devez posséder la permission <strong>Gérer le serveur</strong> ou <strong>Administrateur</strong>.
            </p>
            <a
              href={`https://discord.com/api/oauth2/authorize?client_id=${import.meta.env.VITE_DISCORD_CLIENT_ID || '123456789012345678'}&permissions=268435456&scope=bot%20applications.commands`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
            >
              Inviter le bot sur un serveur
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {guilds.map(guild => (
              <div
                key={guild.id}
                onClick={() => handleSelect(guild)}
                className="bg-[#111827] border border-gray-800 hover:border-blue-500/50 hover:bg-[#1E293B]/50 p-5 rounded-xl cursor-pointer transition flex items-center justify-between group shadow-lg"
              >
                <div className="flex items-center space-x-4">
                  {guild.iconUrl ? (
                    <img src={guild.iconUrl} alt={guild.name} className="w-12 h-12 rounded-xl" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center text-lg font-bold text-gray-300">
                      <Server className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-gray-100 group-hover:text-blue-400 transition">
                      {guild.name}
                    </h3>
                    <p className="text-xs text-emerald-400 font-medium">Bot actif</p>
                  </div>
                </div>

                <div className="w-8 h-8 rounded-lg bg-gray-800 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center text-gray-400 transition">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
