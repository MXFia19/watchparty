import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

interface User {
  id: string;
  pseudo: string;
  discordUsername?: string;
  discordAvatar?: string;
}

interface UserContextType {
  user: User | null;
  loading: boolean;
  login: (pseudo: string) => Promise<void>;
  logout: () => void;
  linkDiscord: () => void;
  getAvatarUrl: () => string;
}

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restaurer l'user depuis localStorage
    const saved = localStorage.getItem('wp_user');
    let currentUser: User | null = null;
    if (saved) {
      try { currentUser = JSON.parse(saved); } catch {}
    }

    // Vérifier si Discord vient d'être lié (retour OAuth)
    const params = new URLSearchParams(window.location.search);
    if (params.get('discord_linked') === '1' && currentUser) {
      const discordUsername = params.get('discord_username') || undefined;
      const discordAvatar = params.get('discord_avatar') || undefined;
      currentUser = { ...currentUser, discordUsername, discordAvatar };
      localStorage.setItem('wp_user', JSON.stringify(currentUser));
      // Nettoyer l'URL
      window.history.replaceState({}, '', window.location.pathname);
    }

    setUser(currentUser);
    setLoading(false);
  }, []);

  const login = async (pseudo: string) => {
    const res = await fetch(`${SERVER_URL}/api/users/anonymous`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pseudo }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur création utilisateur');
    }
    const newUser: User = await res.json();
    setUser(newUser);
    localStorage.setItem('wp_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('wp_user');
  };

  const linkDiscord = () => {
    if (!user) return;
    window.location.href = `${SERVER_URL}/api/auth/discord?userId=${user.id}`;
  };

  const getAvatarUrl = () => {
    if (user?.discordAvatar) return user.discordAvatar;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.pseudo || '?')}&background=5b7fff&color=fff&size=128`;
  };

  return (
    <UserContext.Provider value={{ user, loading, login, logout, linkDiscord, getAvatarUrl }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used inside UserProvider');
  return ctx;
}
