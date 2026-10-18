import React from 'react';
import { ShieldCheck, Cpu, Sparkles, Atom } from 'lucide-react';

export const Login: React.FC = () => {
  const handleLogin = () => {
    window.location.href = '/api/auth/login';
  };

  return (
    <div className="min-h-screen bg-[#0B0B0D] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[#E5092E]/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#E5092E]/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-md w-full bg-[#121217] border border-[#242430] rounded-3xl p-8 sm:p-10 shadow-2xl relative z-10 text-center">
        {/* Cortex Logo Emblem */}
        <div className="mb-6 flex flex-col items-center">
          <img
            src="/cortex-emblem.png"
            alt="CORTEX"
            className="w-20 h-20 rounded-full mb-3 drop-shadow-[0_0_25px_rgba(229,9,46,0.6)] hover:scale-105 transition duration-300"
          />
          <h1 className="text-3xl font-extrabold tracking-wider text-white flex items-center justify-center">
            CORT<span className="text-[#E5092E] font-black tracking-tight inline-flex flex-col justify-center leading-none mx-0.5"><span className="h-[3.5px] w-4 bg-[#E5092E] my-[1px] rounded-sm"></span><span className="h-[3.5px] w-4 bg-[#E5092E] my-[1px] rounded-sm"></span><span className="h-[3.5px] w-4 bg-[#E5092E] my-[1px] rounded-sm"></span></span>X
          </h1>
          <p className="text-[11px] tracking-[0.3em] text-[#E5092E] font-semibold uppercase mt-0.5">
            SCIENTIFIC CLUB
          </p>
        </div>

        <p className="text-gray-400 text-xs sm:text-sm mb-8 leading-relaxed">
          Plateforme d'administration et de gestion intelligente du club scientifique et de son écosystème Discord.
        </p>

        <div className="space-y-3 mb-8 text-left bg-[#16161D] p-4 rounded-2xl border border-[#242430]">
          <div className="flex items-center text-xs text-gray-300">
            <Atom className="w-4 h-4 text-[#E5092E] mr-2.5 shrink-0" />
            <span>Pôles scientifiques, ateliers & événements</span>
          </div>
          <div className="flex items-center text-xs text-gray-300">
            <Cpu className="w-4 h-4 text-white mr-2.5 shrink-0" />
            <span>Pilotage des projets IA, robotique & code</span>
          </div>
          <div className="flex items-center text-xs text-gray-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 mr-2.5 shrink-0" />
            <span>Gestion automatisée des rôles & permissions</span>
          </div>
        </div>

        <button
          onClick={handleLogin}
          className="w-full flex items-center justify-center px-6 py-3.5 rounded-xl text-sm font-bold text-white bg-[#5865F2] hover:bg-[#4752C4] transition shadow-lg shadow-indigo-500/20 active:scale-[0.98]"
        >
          <svg className="w-5 h-5 mr-3 fill-current" viewBox="0 0 24 24">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
          </svg>
          Connexion avec Discord
        </button>

        <p className="mt-6 text-[11px] text-gray-500">
          Accès réservé aux membres encadrants et administrateurs du Cortex Scientific Club.
        </p>
      </div>
    </div>
  );
};
