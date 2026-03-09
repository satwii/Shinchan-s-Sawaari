import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';

export default function WalletBadge() {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [balance, setBalance] = useState(null);

    const fetchBalance = useCallback(async () => {
        if (!token) return;
        try {
            const res = await api.get('/wallet');
            setBalance(res.data.balance ?? 0);
        } catch { /* silent */ }
    }, [token]);

    useEffect(() => {
        fetchBalance();
        const interval = setInterval(fetchBalance, 60000); // refresh every 60s
        return () => clearInterval(interval);
    }, [fetchBalance]);

    if (!token || balance === null) return null;

    return (
        <button
            onClick={() => navigate('/wallet')}
            title="Sawaari Money Wallet"
            style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'rgba(139,92,246,0.12)',
                border: '1px solid rgba(139,92,246,0.3)',
                borderRadius: 20, padding: '5px 12px',
                cursor: 'pointer', transition: 'all 0.2s',
                color: '#c4b5fd', fontSize: 12, fontWeight: 700,
                whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,92,246,0.25)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(139,92,246,0.12)'}
        >
            <span>💰</span>
            <span>₹{Number(balance).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
        </button>
    );
}
