import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User } from '../types';
import { brand } from '../config/brand';

const DEMO_KEY = `${brand.storagePrefix}demo-active`;
const DEMO_USER: User = { id: 'demo-user', email: 'demo@labcore.example', name: 'Demo User', role: 'admin' };

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isDemoActive: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginDemo: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemoActive, setIsDemoActive] = useState(false);

  useEffect(() => {
    // Restore demo session
    if (localStorage.getItem(DEMO_KEY) === 'true') {
      setUser(DEMO_USER);
      setIsDemoActive(true);
    }
    setIsLoading(false);
  }, []);

  const login = async (_email: string, _password: string): Promise<void> => {
    // Placeholder — replace with supabase.auth.signInWithPassword() for live mode
    throw new Error('Live authentication not configured. Use "Explore Demo" to continue.');
  };

  const loginDemo = () => {
    localStorage.setItem(DEMO_KEY, 'true');
    setIsDemoActive(true);
    setUser(DEMO_USER);
  };

  const logout = () => {
    localStorage.removeItem(DEMO_KEY);
    setIsDemoActive(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, isDemoActive, login, loginDemo, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
