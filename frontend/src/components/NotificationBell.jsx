import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';

export default function NotificationBell() {
    const { token } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [open, setOpen] = useState(false);
    const panelRef = useRef(null);

    const fetchNotifications = useCallback(async () => {
        if (!token) return;
        try {
            const res = await api.get('/notifications');
            setNotifications(res.data.notifications || []);
            setUnreadCount(res.data.unreadCount || 0);
        } catch { /* silent */ }
    }, [token]);

    // Initial fetch + 30-second polling
    useEffect(() => {
        if (!token) return;
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, [fetchNotifications, token]);

    // Close panel on outside click
    useEffect(() => {
        function onClickOutside(e) {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    async function markRead(id) {
        try {
            await api.put(`/notifications/${id}/read`);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch { /* silent */ }
    }

    async function markAllRead() {
        try {
            await api.put('/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
            setUnreadCount(0);
        } catch { /* silent */ }
    }

    function formatTime(ts) {
        if (!ts) return '';
        const d = new Date(ts);
        const now = new Date();
        const diffMs = now - d;
        const diffMin = Math.floor(diffMs / 60000);
        if (diffMin < 1) return 'just now';
        if (diffMin < 60) return `${diffMin}m ago`;
        const diffH = Math.floor(diffMin / 60);
        if (diffH < 24) return `${diffH}h ago`;
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    }

    if (!token) return null;

    return (
        <div ref={panelRef} style={{ position: 'relative', display: 'inline-block' }}>
            {/* Bell button */}
            <button
                onClick={() => { setOpen(o => !o); if (!open) fetchNotifications(); }}
                title="Notifications"
                style={{
                    position: 'relative',
                    width: 40, height: 40,
                    borderRadius: '50%',
                    border: '1px solid rgba(139,92,246,0.25)',
                    background: open ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.05)',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18,
                    transition: 'all 0.2s',
                    color: '#fff',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,92,246,0.2)'}
                onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
            >
                🔔
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute', top: -3, right: -3,
                        background: '#ef4444', color: '#fff',
                        fontSize: 9, fontWeight: 700,
                        minWidth: 16, height: 16,
                        borderRadius: 8, display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        padding: '0 3px',
                        border: '1.5px solid #0f0a18',
                    }}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown panel */}
            {open && (
                <div style={{
                    position: 'absolute',
                    top: 48, right: 0,
                    width: 320, maxWidth: 'calc(100vw - 24px)',
                    maxHeight: 420,
                    borderRadius: 16,
                    background: 'linear-gradient(180deg, #1a1025 0%, #0f0a18 100%)',
                    border: '1px solid rgba(139,92,246,0.25)',
                    boxShadow: '0 16px 48px rgba(0,0,0,0.6), 0 0 24px rgba(139,92,246,0.1)',
                    display: 'flex', flexDirection: 'column',
                    overflow: 'hidden',
                    zIndex: 9999,
                    animation: 'notifSlideDown 0.2s ease-out',
                }}>
                    <style>{`
                        @keyframes notifSlideDown {
                            from { opacity: 0; transform: translateY(-8px); }
                            to { opacity: 1; transform: translateY(0); }
                        }
                    `}</style>

                    {/* Header */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 14px 10px',
                        borderBottom: '1px solid rgba(255,255,255,0.07)',
                    }}>
                        <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>
                            🔔 Notifications {unreadCount > 0 && <span style={{
                                background: '#ef4444', color: '#fff', fontSize: 9,
                                padding: '1px 5px', borderRadius: 6, marginLeft: 4, fontWeight: 700,
                            }}>{unreadCount}</span>}
                        </span>
                        {unreadCount > 0 && (
                            <button onClick={markAllRead} style={{
                                background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
                                borderRadius: 8, color: '#a78bfa', fontSize: 10, fontWeight: 600,
                                padding: '3px 8px', cursor: 'pointer',
                            }}>Mark all read</button>
                        )}
                    </div>

                    {/* List */}
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                        {notifications.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                                <div style={{ fontSize: 32, marginBottom: 8 }}>🔔</div>
                                No notifications yet
                            </div>
                        ) : (
                            notifications.map(n => (
                                <div
                                    key={n.id}
                                    onClick={() => { if (!n.is_read) markRead(n.id); }}
                                    style={{
                                        display: 'flex', gap: 10,
                                        padding: '12px 14px',
                                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                                        borderLeft: `3px solid ${n.type === 'request_accepted' ? '#10b981' : '#ef4444'}`,
                                        background: n.is_read ? 'transparent' : 'rgba(139,92,246,0.06)',
                                        cursor: n.is_read ? 'default' : 'pointer',
                                        transition: 'background 0.15s',
                                    }}
                                    onMouseEnter={e => { if (!n.is_read) e.currentTarget.style.background = 'rgba(139,92,246,0.1)'; }}
                                    onMouseLeave={e => { if (!n.is_read) e.currentTarget.style.background = 'rgba(139,92,246,0.06)'; }}
                                >
                                    <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>
                                        {n.type === 'request_accepted' ? '✅' : '❌'}
                                    </span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{
                                            color: n.is_read ? 'rgba(255,255,255,0.5)' : '#fff',
                                            fontSize: 12,
                                            fontWeight: n.is_read ? 400 : 600,
                                            lineHeight: 1.4,
                                            margin: 0,
                                        }}>
                                            {n.message}
                                        </p>
                                        <p style={{
                                            color: 'rgba(255,255,255,0.3)', fontSize: 10,
                                            marginTop: 4,
                                        }}>
                                            {formatTime(n.created_at)}
                                            {!n.is_read && <span style={{
                                                marginLeft: 8, color: '#8b5cf6', fontWeight: 700,
                                            }}>● unread</span>}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
