import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('pe_token');
    const savedUser = localStorage.getItem('pe_user');
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch { /* ignore */ }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token, refresh_token, user: userData } = res.data;
    localStorage.setItem('pe_token', token);
    localStorage.setItem('pe_refresh', refresh_token);
    localStorage.setItem('pe_user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  }, []);

  const register = useCallback(async (data) => {
    const res = await api.post('/auth/register', data);
    const { token, refresh_token, user: userData } = res.data;
    localStorage.setItem('pe_token', token);
    localStorage.setItem('pe_refresh', refresh_token);
    localStorage.setItem('pe_user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  }, []);

  const setAuthFromGoogle = useCallback((userData, token) => {
    localStorage.setItem('pe_token', token);
    localStorage.setItem('pe_user', JSON.stringify(userData));
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch {}
    localStorage.removeItem('pe_token');
    localStorage.removeItem('pe_refresh');
    localStorage.removeItem('pe_user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setAuthFromGoogle }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
