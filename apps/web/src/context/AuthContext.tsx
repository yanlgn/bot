import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch } from '../api/client';

export interface UserGuild {
  id: string;
  name: string;
  icon: string | null;
  iconUrl: string | null;
  owner: boolean;
  hasBot: boolean;
}

export interface UserProfile {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  guilds: UserGuild[];
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  activeGuild: UserGuild | null;
  setActiveGuildId: (guildId: string) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeGuildId, setActiveGuildIdState] = useState<string | null>(() => {
    return localStorage.getItem('sciclub_active_guild');
  });

  const refreshUser = async () => {
    try {
      setLoading(true);

      // Récupérer et stocker le token transmis dans l'URL après le callback OAuth2
      const urlParams = new URLSearchParams(window.location.search);
      const tokenFromUrl = urlParams.get('auth_token');
      if (tokenFromUrl) {
        localStorage.setItem('cortex_token', tokenFromUrl);
        urlParams.delete('auth_token');
        const cleanSearch = urlParams.toString();
        const cleanUrl = window.location.pathname + (cleanSearch ? `?${cleanSearch}` : '');
        window.history.replaceState({}, document.title, cleanUrl);
      }

      const data = await apiFetch<UserProfile>('/me');
      setUser(data);

      if (data.guilds.length > 0 && !activeGuildId) {
        setActiveGuildIdState(data.guilds[0]!.id);
        localStorage.setItem('sciclub_active_guild', data.guilds[0]!.id);
      }
    } catch {
      setUser(null);
      localStorage.removeItem('cortex_token');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const setActiveGuildId = (id: string) => {
    setActiveGuildIdState(id);
    localStorage.setItem('sciclub_active_guild', id);
  };

  const logout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {}
    setUser(null);
    localStorage.removeItem('cortex_token');
    localStorage.removeItem('sciclub_active_guild');
    window.location.href = '/login';
  };

  const activeGuild = user?.guilds.find(g => g.id === activeGuildId) || (user?.guilds[0] ?? null);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        activeGuild,
        setActiveGuildId,
        logout,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé au sein d\'un AuthProvider');
  }
  return context;
};
