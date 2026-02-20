import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import api from '../api';

const SOCKET_URL = process.env.REACT_APP_API_URL || 'https://sawaari-09bb.onrender.com';

function formatTime(isoStr) {
    if (!isoStr) return '';
    return new Date(isoStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Today';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function MessageBubble({ msg, isOwn }) {
    return (
        <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2 animate-fade-in`}>
            <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[75%]`}>
                {!isOwn && (
                    <span className="text-xs text-sawaari-muted font-medium mb-1 ml-1">{msg.username}</span>
                )}
                <div className={isOwn ? 'bubble-sent' : 'bubble-received'}>
                    <p className="text-sm leading-relaxed break-words">{msg.content}</p>
                </div>
                <span className="text-[10px] text-sawaari-muted mt-1 mx-1">{formatTime(msg.sentAt || msg.sent_at)}</span>
            </div>
        </div>
    );
}

export default function ChatPage() {
    const { rideId } = useParams();
    const navigate = useNavigate();
    const { user, token } = useAuth();

    const [messages, setMessages] = useState([]);
    const [members, setMembers] = useState([]);
    const [input, setInput] = useState('');
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState('');
    const [callMsg, setCallMsg] = useState('');
    const [showMembers, setShowMembers] = useState(false);


    const socketRef = useRef(null);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // Load history & members
    useEffect(() => {
        async function loadData() {
            try {
                const [msgRes, memRes] = await Promise.all([
                    api.get(`/rides/${rideId}/messages`),
                    api.get(`/rides/${rideId}/members`),
                ]);
                setMessages(msgRes.data.messages || []);
                setMembers(memRes.data.members || []);
            } catch (err) {
                setError(err.response?.data?.error || 'Failed to load chat. You may not be a member of this ride.');
            }
        }
        loadData();
    }, [rideId]);

    // Socket connection
    useEffect(() => {
        if (!token) return;

        const socket = io(SOCKET_URL, {
            auth: { token },
            transports: ['websocket', 'polling'],
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            setConnected(true);
            socket.emit('join_ride_room', { rideId: parseInt(rideId) });
        });

        socket.on('disconnect', () => setConnected(false));

        socket.on('joined_room', () => {
            console.log(`Joined chat room for ride ${rideId}`);
        });

        socket.on('new_message', (msg) => {
            setMessages((prev) => {
                // Avoid duplicate if message was already in history
                if (prev.some((m) => m.id === msg.id)) return prev;
                return [...prev, msg];
            });
        });

        socket.on('error', (data) => {
            setError(data?.message || 'Socket error');
        });

        socket.on('connect_error', (err) => {
            console.error('Socket connect error:', err.message);
            setConnected(false);
        });

        return () => {
            socket.disconnect();
        };
    }, [token, rideId]);

    function handleSend(e) {
        e.preventDefault();
        if (!input.trim() || !connected) return;
        socketRef.current?.emit('send_message', {
            rideId: parseInt(rideId),
            content: input.trim(),
        });
        setInput('');
        inputRef.current?.focus();
    }

    function handleCall() {
        setCallMsg('📞 Connecting call...');
        setTimeout(() => setCallMsg(''), 4000);
    }

    // Group messages by date
    function renderMessages() {
        let lastDate = null;
        return messages.map((msg) => {
            const msgDate = formatDate(msg.sentAt || msg.sent_at);
            const showDateSep = msgDate !== lastDate;
            lastDate = msgDate;
            return (
                <React.Fragment key={msg.id}>
                    {showDateSep && (
                        <div className="flex items-center gap-3 my-4">
                            <div className="flex-1 h-px bg-sawaari-border" />
                            <span className="text-xs text-sawaari-muted font-medium px-3 py-1 bg-sawaari-dark rounded-full">
                                {msgDate}
                            </span>
                            <div className="flex-1 h-px bg-sawaari-border" />
                        </div>
                    )}
                    <MessageBubble
                        msg={msg}
                        isOwn={msg.userId === user?.id || msg.username === user?.username}
                    />
                </React.Fragment>
            );
        });
    }

    return (
        <div className="flex flex-col h-screen bg-sawaari-dark">
            {/* ── HEADER ────────────────────────────────────────────── */}
            <header className="flex-shrink-0 bg-sawaari-card border-b border-sawaari-border px-4 py-3 z-10">
                <div className="max-w-2xl mx-auto flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="text-sawaari-muted hover:text-white transition-colors p-1 flex-shrink-0"
                    >
                        ←
                    </button>

                    {/* Ride info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h1 className="font-bold text-white text-sm truncate">Ride #{rideId} Chat</h1>
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
                        </div>
                        <p className="text-xs text-sawaari-muted">
                            {members.length} member{members.length !== 1 ? 's' : ''} · {connected ? 'Live' : 'Connecting...'}
                        </p>
                    </div>

                    {/* Members button */}
                    <button
                        onClick={() => setShowMembers((s) => !s)}
                        className="flex-shrink-0 p-2 rounded-xl hover:bg-sawaari-border transition-colors"
                        title="View members"
                    >
                        <svg className="w-5 h-5 text-sawaari-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </button>

                    {/* Call button — stub */}
                    <button
                        onClick={handleCall}
                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl text-xs font-medium hover:bg-green-500/20 transition-colors"
                    >
                        📞 Call
                    </button>
                </div>

                {/* Call status */}
                {callMsg && (
                    <div className="max-w-2xl mx-auto mt-2 text-center text-xs text-green-400 bg-green-500/10 rounded-lg py-2 animate-fade-in">
                        {callMsg}
                    </div>
                )}

                {/* Members panel */}
                {showMembers && (
                    <div className="max-w-2xl mx-auto mt-3 bg-sawaari-dark rounded-xl border border-sawaari-border p-3 animate-fade-in">
                        <p className="text-xs font-semibold text-sawaari-muted uppercase tracking-wide mb-2">Members</p>
                        <div className="space-y-2">
                            {members.map((m) => (
                                <div key={m.id} className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-full bg-primary-500/20 flex items-center justify-center text-xs font-bold text-primary-400">
                                        {m.username?.[0]?.toUpperCase()}
                                    </div>
                                    <span className="text-sm text-white font-medium">{m.username}</span>
                                    <span className="text-xs text-sawaari-muted">({m.gender})</span>
                                    {m.username === user?.username && (
                                        <span className="ml-auto badge bg-primary-500/10 text-primary-400 border border-primary-500/20 text-xs">you</span>
                                    )}
                                </div>
                            ))}
                        </div>
                        <p className="text-[10px] text-sawaari-muted mt-3 text-center">
                            🔒 Phone numbers are never shared
                        </p>
                    </div>
                )}
            </header>

            {/* Error state */}
            {error && (
                <div className="max-w-2xl mx-auto w-full px-4 py-3">
                    <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl text-center">
                        {error}
                    </div>
                </div>
            )}

            {/* ── MESSAGES ──────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-4 py-4 max-w-2xl w-full mx-auto">
                {messages.length === 0 && !error && (
                    <div className="text-center py-16">
                        <div className="text-5xl mb-3">💬</div>
                        <p className="text-white font-semibold mb-1">Chat is all yours!</p>
                        <p className="text-sawaari-muted text-sm">Be the first to say something to your co-riders</p>
                    </div>
                )}
                {renderMessages()}
                <div ref={messagesEndRef} />
            </div>

            {/* ── INPUT BAR ─────────────────────────────────────────── */}
            <div className="flex-shrink-0 bg-sawaari-card border-t border-sawaari-border px-4 py-3">
                <form onSubmit={handleSend} className="max-w-2xl mx-auto flex items-end gap-3">
                    <div className="flex-1">
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={connected ? 'Type a message…' : 'Connecting...'}
                            disabled={!connected}
                            className="input-field resize-none"
                            maxLength={1000}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend(e);
                                }
                            }}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={!input.trim() || !connected}
                        className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white shadow-md shadow-primary-500/20 hover:from-primary-600 hover:to-primary-700 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <svg className="w-5 h-5 rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                    </button>
                </form>
            </div>
        </div>
    );
}
