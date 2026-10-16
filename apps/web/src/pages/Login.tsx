import React from 'react';
import { Rocket, ShieldCheck, Cpu, Sparkles } from 'lucide-react';

export const Login: React.FC = () => {
  const handleLogin = () => {
    window.location.href = '/api/auth/login';
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-[#111827] border border-gray-800 rounded-2xl p-8 shadow-2xl relative z-10 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 mx-auto flex items-center justify-center text-white mb-6 shadow-xl shadow-blue-500/20">
          <Rocket className="w-8 h-8" />
        </div>

        <h1 className="text-2xl font-bold text-gray-100 mb-2">SciClub Manager</h1>
        <p className="text-gray-400 text-sm mb-8">
          Plateforme complète d'administration Discord pour les clubs scientifiques scolaires et universitaires.
        </p>

        <div className="space-y-3 mb-8 text-left bg-gray-900/60 p-4 rounded-xl border border-gray-800">
          <div className="flex items-center text-xs text-gray-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 mr-2 shrink-0" />
            <span>Gestion sécurisée des rôles & permissions</span>
          </div>
          <div className="flex items-center text-xs text-gray-300">
            <Cpu className="w-4 h-4 text-blue-400 mr-2 shrink-0" />
            <span>Pilotage des projets IA, robotique & sciences</span>
          </div>
          <div className="flex items-center text-xs text-gray-300">
            <Sparkles className="w-4 h-4 text-purple-400 mr-2 shrink-0" />
            <span>Configuration déclarative & synchronisation JSON</span>
          </div>
        </div>

        <button
          onClick={handleLogin}
          className="w-full flex items-center justify-center px-6 py-3.5 rounded-xl text-sm font-semibold text-white bg-[#5865F2] hover:bg-[#4752C4] transition shadow-lg shadow-indigo-500/20 active:scale-[0.98]"
        >
          <svg className="w-5 h-5 mr-3 fill-current" viewBox="0 0 24 24">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
          </svg>
          Connexion avec Discord
        </button>

        <p className="mt-6 text-[11px] text-gray-500">
          En vous connectant, vous autorisez SciClub Manager à vérifier vos autorisations administratives sur vos serveurs Discord.
        </p>
      </div>
    </div>
  );
};
