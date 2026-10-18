import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, UserGuild } from '../context/AuthContext';
import { Server, ArrowRight, ShieldAlert, Plus, ExternalLink, RefreshCw } from 'lucide-react';

const CORTEX_CLIENT_ID = '1350228159005724772';

export const GuildSelect: React.FC = () => {
  const { user, setActiveGuildId, refreshUser, loading } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [loading, user, navigate]);

  const handleSelect = (guild: UserGuild) => {
    if (!guild.hasBot) return;
    setActiveGuildId(guild.id);
    navigate(`/dashboard/${guild.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0B0D] flex flex-col items-center justify-center">
        <img src="/cortex-emblem.png" alt="CORTEX" className="w-16 h-16 rounded-full animate-pulse mb-4" />
        <p className="text-gray-400 text-sm font-medium">Chargement de vos serveurs...</p>
      </div>
    );
  }

  const guilds = user?.guilds || [];
  const activeGuilds = guilds.filter(g => g.hasBot);
  const otherGuilds = guilds.filter(g => !g.hasBot);

  return (
    <div className="min-h-screen bg-[#0B0B0D] p-6 sm:p-12 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-[#E5092E]/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-[400px] h-[400px] bg-[#E5092E]/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-3xl w-full relative z-10">
        {/* Header Branding */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <img src="/cortex-emblem.png" alt="CORTEX" className="w-14 h-14 rounded-full drop-shadow-[0_0_15px_rgba(229,9,46,0.5)]" />
            <div className="text-left">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-wider text-white flex items-center">
                CORT<span className="text-[#E5092E] font-black tracking-tight inline-flex flex-col justify-center leading-none mx-0.5"><span className="h-[3px] w-3.5 bg-[#E5092E] my-[1px] rounded-sm"></span><span className="h-[3px] w-3.5 bg-[#E5092E] my-[1px] rounded-sm"></span><span className="h-[3px] w-3.5 bg-[#E5092E] my-[1px] rounded-sm"></span></span>X
              </h2>
              <p className="text-[10px] tracking-[0.25em] text-gray-400 font-light uppercase">
                SCIENTIFIC CLUB
              </p>
            </div>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-100 mb-2">Sélectionnez votre serveur</h1>
          <p className="text-gray-400 text-xs sm:text-sm max-w-lg mx-auto">
            Gérez vos pôles scientifiques, événements, rôles et projets depuis le tableau de bord Cortex.
          </p>
          <div className="mt-3 flex justify-center">
            <button
              onClick={() => refreshUser()}
              disabled={loading}
              className="inline-flex items-center text-xs text-gray-400 hover:text-white transition px-3 py-1 rounded-md bg-[#16161D] border border-[#242430] hover:border-[#E5092E]"
            >
              <RefreshCw className={`w-3 h-3 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Actualiser la liste
            </button>
          </div>
        </div>

        {guilds.length === 0 ? (
          <div className="bg-[#121217] border border-[#242430] rounded-2xl p-8 text-center shadow-2xl relative">
            <div className="w-16 h-16 rounded-2xl bg-[#E5092E]/10 border border-[#E5092E]/20 flex items-center justify-center mx-auto mb-4 text-[#E5092E]">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Aucun serveur administrable détecté</h2>
            <p className="text-xs sm:text-sm text-gray-400 max-w-md mx-auto mb-6 leading-relaxed">
              Pour administrer un club avec Cortex, vous devez posséder la permission <strong>Gérer le serveur</strong> ou <strong>Administrateur</strong> sur votre serveur Discord.
            </p>
            <a
              href={`https://discord.com/oauth2/authorize?client_id=${CORTEX_CLIENT_ID}&scope=bot%20applications.commands&permissions=8`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center px-6 py-3 text-sm font-bold text-white bg-[#E5092E] hover:bg-[#CC0727] rounded-xl transition shadow-lg shadow-[#E5092E]/25 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Inviter le bot Cortex sur un serveur
            </a>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Serveurs où Cortex est déjà installé */}
            {activeGuilds.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-1">
                  Serveurs Actifs ({activeGuilds.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeGuilds.map(guild => (
                    <div
                      key={guild.id}
                      onClick={() => handleSelect(guild)}
                      className="bg-[#121217] border border-[#242430] hover:border-[#E5092E] hover:bg-[#16161D] p-5 rounded-2xl cursor-pointer transition-all duration-200 flex items-center justify-between group shadow-xl hover:shadow-[#E5092E]/10"
                    >
                      <div className="flex items-center space-x-4 min-w-0">
                        {guild.iconUrl ? (
                          <img src={guild.iconUrl} alt={guild.name} className="w-12 h-12 rounded-xl object-cover border border-[#242430]" />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-[#1C1C24] border border-[#242430] flex items-center justify-center text-lg font-bold text-gray-300 shrink-0">
                            <Server className="w-6 h-6 text-[#E5092E]" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm sm:text-base text-gray-100 group-hover:text-white transition truncate">
                            {guild.name}
                          </h4>
                          <span className="inline-flex items-center text-[10px] text-emerald-400 font-semibold mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
                            Cortex Actif
                          </span>
                        </div>
                      </div>

                      <div className="w-9 h-9 rounded-xl bg-[#1C1C24] group-hover:bg-[#E5092E] group-hover:text-white flex items-center justify-center text-gray-400 transition shrink-0 ml-3">
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Serveurs administrables où Cortex n'est pas encore présent */}
            {otherGuilds.length > 0 && (
              <div className="pt-2">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-1">
                  Serveurs où ajouter Cortex ({otherGuilds.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {otherGuilds.map(guild => (
                    <div
                      key={guild.id}
                      className="bg-[#101014]/80 border border-[#1E1E26] p-5 rounded-2xl flex items-center justify-between opacity-80 hover:opacity-100 transition"
                    >
                      <div className="flex items-center space-x-4 min-w-0">
                        {guild.iconUrl ? (
                          <img src={guild.iconUrl} alt={guild.name} className="w-12 h-12 rounded-xl object-cover grayscale opacity-70" />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-[#181820] border border-[#242430] flex items-center justify-center text-gray-500 shrink-0">
                            <Server className="w-6 h-6" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <h4 className="font-semibold text-sm text-gray-300 truncate">
                            {guild.name}
                          </h4>
                          <span className="text-[10px] text-gray-500">Non configuré</span>
                        </div>
                      </div>

                      <a
                        href={`https://discord.com/oauth2/authorize?client_id=${CORTEX_CLIENT_ID}&scope=bot%20applications.commands&permissions=8&guild_id=${guild.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-white bg-[#1C1C24] hover:bg-[#E5092E] border border-[#242430] hover:border-[#E5092E] rounded-lg transition shrink-0 ml-3"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Ajouter
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
