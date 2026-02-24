import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { User } from "../types";
import { authApi } from "./api";
import {
  DEMO_USER,
  disableDemoMode,
  enableDemoMode as enableDemoStorage,
  isDemoMode,
} from "./demo-data";

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  enterDemoMode: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  isDemo: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isDemoMode()) {
      setToken("demo-token");
      setUser(DEMO_USER);
      setIsDemo(true);
      setIsLoading(false);
      return;
    }

    const storedToken =
      localStorage.getItem("token") || localStorage.getItem("dmp-token");
    const storedUser =
      localStorage.getItem("user") || localStorage.getItem("dmp-user");
    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        // Invalid user data
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const handleLogout = () => {
      setToken(null);
      setUser(null);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "token" && !event.newValue) {
        handleLogout();
      }
    };

    window.addEventListener("auth:logout", handleLogout);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("auth:logout", handleLogout);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const login = async (email: string, password: string) => {
    const data = await authApi.login(email, password);
    if (data?.token && data?.user) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
    } else {
      throw new Error(
        "Sign-in server is not available. Use Preview Demo to explore without signing in.",
      );
    }
  };

  const enterDemoMode = useCallback(() => {
    enableDemoStorage();
    setToken("demo-token");
    setUser(DEMO_USER);
    setIsDemo(true);
  }, []);

  const logout = () => {
    if (isDemo) {
      disableDemoMode();
      setIsDemo(false);
    } else {
      authApi.logout();
    }
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        enterDemoMode,
        isAuthenticated: !!token,
        isLoading,
        isDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
