'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';

interface User {
  id: number;
  username: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

const setCookie = (name: string, value: string, days: number = 7) => {
  if (typeof window === 'undefined') return;
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
};

const getCookie = (name: string): string | null => {
  if (typeof window === 'undefined') return null;
  const nameEQ = `${name}=`;
  const parts = document.cookie.split(';');
  for (let c of parts) {
    c = c.trim();
    if (c.startsWith(nameEQ)) return c.slice(nameEQ.length);
  }
  return null;
};

const deleteCookie = (name: string) => {
  if (typeof window === 'undefined') return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
};

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // define logout first so callbacks can depend on it
  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    deleteCookie('auth_token');
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_user');
    }
  }, []);

  const verifyToken = useCallback(
    async (authToken: string) => {
      try {
        const res = await fetch(
          'https://bookquest-f7t2.onrender.com/api/auth/verify',
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          logout();
        }
      } catch (err) {
        console.error('Token verification failed:', err);
        logout();
      }
    },
    [logout]
  );

  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = getCookie('auth_token');
        const storedUser =
          typeof window !== 'undefined'
            ? localStorage.getItem('auth_user')
            : null;

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          await verifyToken(storedToken);
        }
      } catch (err) {
        console.error('Failed to initialize auth:', err);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_user');
        }
        deleteCookie('auth_token');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    void initAuth();
  }, [verifyToken]);

  const login = async (username: string, password: string) => {
    const res = await fetch(
      'https://bookquest-f7t2.onrender.com/api/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');

    setToken(data.token);
    setUser(data.user);
    setCookie('auth_token', data.token, 7);
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_user', JSON.stringify(data.user));
    }
  };

  const signup = async (username: string, email: string, password: string) => {
    const res = await fetch(
      'https://bookquest-f7t2.onrender.com/api/auth/signup',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Signup failed');

    setToken(data.token);
    setUser(data.user);
    setCookie('auth_token', data.token, 7);
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_user', JSON.stringify(data.user));
    }
  };

  const value: AuthContextType = {
    user,
    token,
    loading,
    login,
    signup,
    logout,
    isAuthenticated: !!user && !!token,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
