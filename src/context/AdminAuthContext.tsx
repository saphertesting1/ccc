import React, { createContext, useContext, useState, useEffect } from 'react';
import { AdminUser } from '../types/index.js';
import { api } from '../services/api.js';

interface AdminAuthContextType {
  admin: AdminUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, passwordPlain: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('ccc_admin_token') || sessionStorage.getItem('ccc_admin_token');
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function verifySession() {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const user = await api.getAdminMe();
        if (user) {
          setAdmin(user);
        } else {
          // Token invalid
          localStorage.removeItem('ccc_admin_token');
          sessionStorage.removeItem('ccc_admin_token');
          setToken(null);
          setAdmin(null);
        }
      } catch {
        setToken(null);
        setAdmin(null);
      } finally {
        setIsLoading(false);
      }
    }
    verifySession();
  }, [token]);

  const login = async (username: string, passwordPlain: string) => {
    const res = await api.adminLogin(username, passwordPlain);
    localStorage.setItem('ccc_admin_token', res.token);
    setToken(res.token);
    setAdmin(res.admin);
  };

  const logout = async () => {
    await api.adminLogout();
    localStorage.removeItem('ccc_admin_token');
    sessionStorage.removeItem('ccc_admin_token');
    setToken(null);
    setAdmin(null);
  };

  return (
    <AdminAuthContext.Provider
      value={{
        admin,
        token,
        isAuthenticated: Boolean(admin && token),
        isLoading,
        login,
        logout
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  return context;
};
