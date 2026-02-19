import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Restore session from localStorage
        const storedToken = localStorage.getItem('sawaari_token');
        const storedUser = localStorage.getItem('sawaari_user');
        if (storedToken && storedUser) {
            try {
                setToken(storedToken);
                setUser(JSON.parse(storedUser));
            } catch {
                localStorage.removeItem('sawaari_token');
                localStorage.removeItem('sawaari_user');
            }
        }
        setLoading(false);
    }, []);

    function login(newToken, newUser) {
        localStorage.setItem('sawaari_token', newToken);
        localStorage.setItem('sawaari_user', JSON.stringify(newUser));
        setToken(newToken);
        setUser(newUser);
    }

    function logout() {
        localStorage.removeItem('sawaari_token');
        localStorage.removeItem('sawaari_user');
        setToken(null);
        setUser(null);
    }

    return (
        <AuthContext.Provider value={{ user, token, loading, login, logout, isAuthenticated: !!token }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
