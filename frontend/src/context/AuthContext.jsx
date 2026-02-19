import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        const stored = localStorage.getItem('sawaari_user');
        return stored ? JSON.parse(stored) : null;
    });
    const [token, setToken] = useState(() => localStorage.getItem('sawaari_token'));

    // Refresh user data on mount if token exists
    useEffect(() => {
        if (token && !user?.username) {
            // Partial user — try to refresh
            api.get('/auth/me').then(res => {
                if (res.data.user) {
                    setUser(res.data.user);
                    localStorage.setItem('sawaari_user', JSON.stringify(res.data.user));
                }
            }).catch(() => {
                // Token invalid — logout
                logout();
            });
        }
        // eslint-disable-next-line
    }, []);

    const login = useCallback((newToken, newUser) => {
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('sawaari_token', newToken);
        localStorage.setItem('sawaari_user', JSON.stringify(newUser));
    }, []);

    const logout = useCallback(() => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('sawaari_token');
        localStorage.removeItem('sawaari_user');
    }, []);

    const refreshUser = useCallback(async () => {
        try {
            const res = await api.get('/auth/me');
            if (res.data.user) {
                setUser(res.data.user);
                localStorage.setItem('sawaari_user', JSON.stringify(res.data.user));
            }
        } catch { /* silent */ }
    }, []);

    return (
        <AuthContext.Provider value={{ user, token, login, logout, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
