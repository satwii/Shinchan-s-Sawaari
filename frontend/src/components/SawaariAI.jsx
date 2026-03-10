import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';

// ─── SOS TRIGGER WORDS ──────────────────────────────────────────────────────
const SOS_WORDS = {
    en: ['help', 'danger', 'emergency', 'save me', 'sos', "i'm in danger", 'someone is following me', 'i feel unsafe', 'someone following me'],
    ta: ['உதவி', 'ஆபத்து', 'காப்பாற்று', 'பயமாக இருக்கு'],
    te: ['సహాయం', 'ప్రమాదం', 'కాపాడు', 'భయంగా ఉంది'],
    ml: ['സഹായം', 'അപകടം', 'രക്ഷിക്കൂ', 'പേടിയാകുന്നു'],
    hi: ['मदद', 'खतरा', 'बचाओ', 'डर लग रहा है', 'मुझे मदद चाहिए'],
};

const SOS_MESSAGES = {
    'ta-IN': 'SOS அனுப்பப்பட்டது. உதவி வருகிறது. அமைதியாக இருங்கள்.',
    'te-IN': 'SOS పంపబడింది. సహాయం వస్తోంది. ప్రశాంతంగా ఉండండి.',
    'ml-IN': 'SOS അയച്ചു. സഹായം വരുന്നു. ശാന്തമായിരിക്കൂ.',
    'hi-IN': 'SOS भेज दिया। मदद आ रही है। शांत रहें।',
    'en-IN': 'SOS sent. Help is on the way. Stay calm.',
};

function isSOS(text) {
    const lower = text.toLowerCase();
    for (const lang of Object.values(SOS_WORDS)) {
        for (const word of lang) {
            if (lower.includes(word.toLowerCase())) return true;
        }
    }
    return false;
}

function detectSOSLanguage(text) {
    const lower = text.toLowerCase();
    if (SOS_WORDS.ta.some(w => lower.includes(w))) return 'ta-IN';
    if (SOS_WORDS.te.some(w => lower.includes(w))) return 'te-IN';
    if (SOS_WORDS.ml.some(w => lower.includes(w))) return 'ml-IN';
    if (SOS_WORDS.hi.some(w => lower.includes(w.toLowerCase()))) return 'hi-IN';
    return 'en-IN';
}

function detectTextLanguage(text) {
    // Detect language from Unicode character ranges
    if (/[\u0B80-\u0BFF]/.test(text)) return 'ta-IN'; // Tamil
    if (/[\u0C00-\u0C7F]/.test(text)) return 'te-IN'; // Telugu
    if (/[\u0D00-\u0D7F]/.test(text)) return 'ml-IN'; // Malayalam
    if (/[\u0900-\u097F]/.test(text)) return 'hi-IN'; // Devanagari (Hindi)
    if (/[\u0C80-\u0CFF]/.test(text)) return 'kn-IN'; // Kannada
    return 'en-IN';
}

// ─── RIDE CARD IN CHAT ─────────────────────────────────────────────────────
function MiniRideCard({ ride, onJoin }) {
    return (
        <div style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12, padding: '10px 12px', marginTop: 6,
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <span style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>
                        {ride.source} → {ride.destination}
                    </span>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 }}>
                        {ride.date} · {ride.ride_time || 'Flexible'} · {ride.vehicle_type}
                    </div>
                </div>
                <span style={{
                    background: 'rgba(16,185,129,0.15)', color: '#34d399',
                    fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600,
                }}>
                    {ride.seats_available - (ride.member_count || 0)} seats
                </span>
            </div>
            {ride.owner_profile && (
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 4 }}>
                    👤 {ride.owner_profile.username}
                    {ride.owner_profile.avg_rating && ` ⭐ ${ride.owner_profile.avg_rating}`}
                    {ride.owner_profile.aadhaar_verified && ' ✓'}
                </div>
            )}
            {onJoin && (
                <button onClick={() => onJoin(ride.id)} style={{
                    marginTop: 8, width: '100%', padding: '6px 0',
                    background: 'linear-gradient(135deg, #8b5cf6, #a855f7)',
                    border: 'none', borderRadius: 8, color: '#fff',
                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}>
                    Request to Join
                </button>
            )}
        </div>
    );
}

// ─── SOS OVERLAY ────────────────────────────────────────────────────────────
function SOSOverlay({ lang, onClose }) {
    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', animation: 'sosPulse 1s ease-in-out infinite alternate',
        }}>
            <style>{`@keyframes sosPulse { from { opacity: 1; } to { opacity: 0.85; } }`}</style>
            <div style={{ fontSize: 80, marginBottom: 20 }}>🆘</div>
            <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, textAlign: 'center', margin: '0 20px' }}>
                {SOS_MESSAGES[lang] || SOS_MESSAGES['en-IN']}
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 16 }}>
                Emergency contacts have been alerted
            </p>
            <button onClick={onClose} style={{
                marginTop: 40, padding: '12px 32px', background: 'rgba(255,255,255,0.2)',
                border: '2px solid rgba(255,255,255,0.4)', borderRadius: 12,
                color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>
                Dismiss
            </button>
        </div>
    );
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────
export default function SawaariAI() {
    const { token } = useAuth();
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [recording, setRecording] = useState(false);
    const [showSOS, setShowSOS] = useState(false);
    const [sosLang, setSosLang] = useState('en-IN');
    const mediaRecorder = useRef(null);
    const audioChunks = useRef([]);
    const chatEndRef = useRef(null);
    const recordingTimer = useRef(null);

    // Don't render if not logged in
    if (!token) return null;

    const scrollToBottom = () => {
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    };

    // ── Send message to AI ──────────────────────────────────────────────────
    const sendToAgent = async (text, detectedLanguage = 'en-IN') => {
        if (!text.trim()) return;

        // Frontend SOS check — BEFORE any API call
        if (isSOS(text)) {
            const lang = detectedLanguage !== 'en-IN' ? detectedLanguage : detectSOSLanguage(text);
            setSosLang(lang);
            setShowSOS(true);
            setMessages(prev => [
                ...prev,
                { role: 'user', content: text },
                { role: 'assistant', content: SOS_MESSAGES[lang] || SOS_MESSAGES['en-IN'], isSOS: true },
            ]);
            // Fire SOS API
            try { await api.get('/rides/0/sos-data'); } catch { }
            return;
        }

        const userMsg = { role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);
        setLoading(true);
        scrollToBottom();

        try {
            const history = [...messages, userMsg].slice(-10).map(m => ({
                role: m.role, content: m.content,
            }));

            const res = await api.post('/agent', {
                message: text,
                detectedLanguage,
                conversationHistory: history,
            });

            const data = res.data;
            const aiMsg = {
                role: 'assistant',
                content: data.reply,
                action: data.action,
                rideResults: data.rideResults,
            };
            setMessages(prev => [...prev, aiMsg]);

            // If AI triggers SOS
            if (data.action === 'TRIGGER_SOS') {
                setSosLang(detectedLanguage);
                setShowSOS(true);
            }
        } catch (err) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Sawaari AI is unavailable — please use the app directly.',
                isError: true,
            }]);
        } finally {
            setLoading(false);
            scrollToBottom();
        }
    };

    // ── Handle text submit ─────────────────────────────────────────────────
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!input.trim() || loading) return;
        const text = input.trim();
        setInput('');
        // Detect language from typed Unicode script
        const typedLang = detectTextLanguage(text);
        sendToAgent(text, typedLang);
    };

    // ── Handle join request from chat ──────────────────────────────────────
    const handleJoinRide = async (rideId) => {
        try {
            await api.post(`/rides/${rideId}/request`);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: '✅ Join request sent! Waiting for owner approval.',
            }]);
        } catch (err) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: err.response?.data?.error || 'Failed to send join request.',
                isError: true,
            }]);
        }
        scrollToBottom();
    };

    // ── Voice recording ────────────────────────────────────────────────────
    const startRecording = async () => {
        // Try Web Speech API first (browser-native, free, instant)
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            try {
                const recognition = new SpeechRecognition();
                recognition.continuous = false;
                recognition.interimResults = false;
                // Support multiple Indian languages
                recognition.lang = 'en-IN'; // Default, but it auto-detects within the language

                setRecording(true);
                mediaRecorder.current = recognition; // Store reference for stopRecording

                recognition.onresult = (event) => {
                    const transcript = event.results[0][0].transcript;
                    const confidence = event.results[0][0].confidence;
                    setRecording(false);

                    if (transcript && transcript.trim()) {
                        console.log(`🎤 Web Speech: "${transcript}" (confidence: ${(confidence * 100).toFixed(0)}%)`);
                        // Detect language from the text
                        const detectedLang = detectTextLanguage(transcript);
                        setMessages(prev => [...prev, {
                            role: 'user', content: `🎤 ${transcript}`, isVoice: true,
                        }]);
                        scrollToBottom();
                        setTimeout(() => sendToAgent(transcript, detectedLang), 300);
                    } else {
                        setMessages(prev => [...prev, {
                            role: 'assistant', content: "Didn't catch that — try speaking again or type instead.", isError: true,
                        }]);
                        scrollToBottom();
                    }
                };

                recognition.onerror = (event) => {
                    console.error('Web Speech error:', event.error);
                    setRecording(false);
                    if (event.error === 'not-allowed') {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: 'Microphone access denied. Please allow microphone access and try again.',
                            isError: true,
                        }]);
                    } else {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Couldn't hear you clearly — try again or type instead.",
                            isError: true,
                        }]);
                    }
                    scrollToBottom();
                };

                recognition.onend = () => {
                    setRecording(false);
                };

                recognition.start();

                // Auto-stop after 10 seconds
                recordingTimer.current = setTimeout(() => {
                    try { recognition.stop(); } catch (e) { /* ignore */ }
                }, 10000);

                return;
            } catch (err) {
                console.warn('Web Speech API failed, falling back to MediaRecorder:', err);
            }
        }

        // Fallback: MediaRecorder → Azure transcription
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            audioChunks.current = [];

            mr.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunks.current.push(e.data);
            };

            mr.onstop = async () => {
                stream.getTracks().forEach(t => t.stop());
                clearTimeout(recordingTimer.current);
                setRecording(false);

                const blob = new Blob(audioChunks.current, { type: 'audio/webm' });
                if (blob.size < 100) {
                    setMessages(prev => [...prev, {
                        role: 'assistant', content: "Didn't catch that — try typing instead.", isError: true,
                    }]);
                    scrollToBottom();
                    return;
                }

                // Send to Sarvam AI for transcription (native Indian script)
                setLoading(true);
                try {
                    const formData = new FormData();
                    formData.append('audio', blob, 'recording.webm');
                    const res = await api.post('/transcribe', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                    });

                    if (res.data.transcript && res.data.transcript.trim()) {
                        const transcript = res.data.transcript.trim();
                        const detectedLang = res.data.detectedLanguage || 'en-IN';
                        setMessages(prev => [...prev, {
                            role: 'user', content: `🎤 ${transcript}`, isVoice: true,
                        }]);
                        scrollToBottom();
                        setTimeout(() => sendToAgent(transcript, detectedLang), 800);
                    } else {
                        setMessages(prev => [...prev, {
                            role: 'assistant', content: "Didn't catch that — try typing instead.", isError: true,
                        }]);
                        setLoading(false);
                    }
                } catch {
                    setMessages(prev => [...prev, {
                        role: 'assistant', content: "Couldn't transcribe — try typing instead.", isError: true,
                    }]);
                    setLoading(false);
                }
                scrollToBottom();
            };

            mr.start();
            mediaRecorder.current = mr;
            setRecording(true);

            // Auto-stop after 10 seconds
            recordingTimer.current = setTimeout(() => {
                if (mr.state === 'recording') mr.stop();
            }, 10000);
        } catch (err) {
            console.error('Microphone error:', err);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Microphone access denied. Please allow microphone access and try again.',
                isError: true,
            }]);
            scrollToBottom();
        }
    };

    const stopRecording = () => {
        clearTimeout(recordingTimer.current);
        if (mediaRecorder.current) {
            // Check if it's a SpeechRecognition instance or MediaRecorder
            if (typeof mediaRecorder.current.stop === 'function') {
                try {
                    if (mediaRecorder.current.state === 'recording') {
                        // MediaRecorder
                        mediaRecorder.current.stop();
                    } else {
                        // SpeechRecognition (no .state === 'recording')
                        mediaRecorder.current.stop();
                    }
                } catch (e) {
                    // SpeechRecognition .stop() may throw if already stopped
                    mediaRecorder.current.stop();
                }
            }
        }
    };

    // ── RENDER ─────────────────────────────────────────────────────────────
    return (
        <>
            {/* SOS Overlay */}
            {showSOS && <SOSOverlay lang={sosLang} onClose={() => setShowSOS(false)} />}

            {/* Floating Button */}
            <button
                onClick={() => setOpen(!open)}
                title="Sawaari AI"
                style={{
                    position: 'fixed', bottom: 90, right: 20, zIndex: 9990,
                    width: 56, height: 56, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #8b5cf6, #7c3aed, #6d28d9)',
                    border: 'none', cursor: 'pointer',
                    boxShadow: '0 4px 20px rgba(139,92,246,0.5), 0 0 40px rgba(139,92,246,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: open ? 'none' : 'aiPulse 2s ease-in-out infinite',
                    transition: 'transform 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
                <span style={{ fontSize: 24, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>
                    {open ? '✕' : '🤖'}
                </span>
            </button>

            {/* Pulse animation */}
            <style>{`
                @keyframes aiPulse {
                    0%, 100% { box-shadow: 0 4px 20px rgba(139,92,246,0.5), 0 0 0 0 rgba(139,92,246,0.3); }
                    50% { box-shadow: 0 4px 20px rgba(139,92,246,0.5), 0 0 0 12px rgba(139,92,246,0); }
                }
                @keyframes slideUp {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                @keyframes micPulse {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
                    50% { box-shadow: 0 0 0 10px rgba(239,68,68,0); }
                }
                @keyframes typingDot {
                    0%, 80%, 100% { transform: scale(0); }
                    40% { transform: scale(1); }
                }
            `}</style>

            {/* Chat Panel */}
            {open && (
                <div style={{
                    position: 'fixed', bottom: 160, right: 20, zIndex: 9989,
                    width: 370, maxWidth: 'calc(100vw - 40px)',
                    height: 520, maxHeight: 'calc(100vh - 200px)',
                    borderRadius: 20,
                    background: 'linear-gradient(180deg, #1a1025 0%, #0f0a18 100%)',
                    border: '1px solid rgba(139,92,246,0.3)',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(139,92,246,0.15)',
                    display: 'flex', flexDirection: 'column',
                    overflow: 'hidden',
                    animation: 'slideUp 0.3s ease-out',
                }}>
                    {/* Header */}
                    <div style={{
                        padding: '14px 16px',
                        background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(168,85,247,0.08))',
                        borderBottom: '1px solid rgba(139,92,246,0.2)',
                        display: 'flex', alignItems: 'center', gap: 10,
                    }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: 12,
                            background: 'linear-gradient(135deg, #8b5cf6, #a855f7)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 18,
                        }}>🤖</div>
                        <div style={{ flex: 1 }}>
                            <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>Sawaari AI</div>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>
                                Multilingual Ride Assistant
                            </div>
                        </div>
                        <button onClick={() => setOpen(false)} style={{
                            background: 'rgba(255,255,255,0.1)', border: 'none',
                            borderRadius: 8, width: 28, height: 28,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'rgba(255,255,255,0.5)', fontSize: 14, cursor: 'pointer',
                        }}>✕</button>
                    </div>

                    {/* Messages */}
                    <div style={{
                        flex: 1, overflowY: 'auto', padding: '12px 14px',
                        display: 'flex', flexDirection: 'column', gap: 10,
                    }}>
                        {messages.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '40px 16px' }}>
                                <div style={{ fontSize: 40, marginBottom: 12 }}>🤖</div>
                                <p style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>
                                    Hi! I'm Sawaari AI
                                </p>
                                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
                                    I can help you find rides, register rides, and more — in Tamil, Telugu, Malayalam, Hindi, or English. Speak or type!
                                </p>
                                <div style={{
                                    display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 16,
                                }}>
                                    {['Find a ride to HITEC City', 'Ameerpet to Gachibowli ride', 'How does Pink Mode work?'].map((q, i) => (
                                        <button key={i} onClick={() => { setInput(q); }}
                                            style={{
                                                background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)',
                                                borderRadius: 10, padding: '6px 12px', color: '#a78bfa',
                                                fontSize: 11, cursor: 'pointer', fontWeight: 500,
                                            }}
                                        >{q}</button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {messages.map((msg, i) => (
                            <div key={i} style={{
                                display: 'flex',
                                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                            }}>
                                <div style={{
                                    maxWidth: '85%',
                                    padding: '10px 14px',
                                    borderRadius: msg.role === 'user'
                                        ? '16px 16px 4px 16px'
                                        : '16px 16px 16px 4px',
                                    background: msg.role === 'user'
                                        ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)'
                                        : msg.isSOS
                                            ? 'linear-gradient(135deg, #dc2626, #b91c1c)'
                                            : msg.isError
                                                ? 'rgba(239,68,68,0.15)'
                                                : 'rgba(255,255,255,0.08)',
                                    color: '#fff',
                                    fontSize: 13,
                                    lineHeight: 1.5,
                                    border: msg.isError ? '1px solid rgba(239,68,68,0.3)' : 'none',
                                }}>
                                    {msg.content}
                                    {/* Ride cards */}
                                    {msg.rideResults && msg.rideResults.length > 0 && (
                                        <div style={{ marginTop: 8 }}>
                                            {msg.rideResults.map((ride, j) => (
                                                <MiniRideCard key={j} ride={ride} onJoin={handleJoinRide} />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Typing indicator */}
                        {loading && (
                            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                                <div style={{
                                    padding: '12px 18px', borderRadius: '16px 16px 16px 4px',
                                    background: 'rgba(255,255,255,0.08)',
                                    display: 'flex', gap: 4, alignItems: 'center',
                                }}>
                                    {[0, 1, 2].map(i => (
                                        <div key={i} style={{
                                            width: 7, height: 7, borderRadius: '50%',
                                            background: '#a78bfa',
                                            animation: `typingDot 1.4s ${i * 0.2}s infinite ease-in-out both`,
                                        }} />
                                    ))}
                                </div>
                            </div>
                        )}

                        <div ref={chatEndRef} />
                    </div>

                    {/* Input Area */}
                    <form onSubmit={handleSubmit} style={{
                        padding: '10px 12px',
                        borderTop: '1px solid rgba(139,92,246,0.15)',
                        background: 'rgba(0,0,0,0.3)',
                        display: 'flex', gap: 8, alignItems: 'center',
                    }}>
                        {/* Mic button */}
                        <button
                            type="button"
                            onClick={recording ? stopRecording : startRecording}
                            disabled={loading && !recording}
                            style={{
                                width: 40, height: 40, borderRadius: '50%', border: 'none',
                                background: recording
                                    ? '#ef4444'
                                    : 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(168,85,247,0.2))',
                                color: '#fff', fontSize: 18, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0,
                                animation: recording ? 'micPulse 1s ease-in-out infinite' : 'none',
                                transition: 'all 0.2s',
                            }}
                        >
                            {recording ? '⏹' : '🎤'}
                        </button>

                        {/* Text input */}
                        <input
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            placeholder={recording ? 'Listening...' : 'Type or speak...'}
                            disabled={recording || loading}
                            style={{
                                flex: 1, padding: '10px 14px',
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(139,92,246,0.2)',
                                borderRadius: 12, color: '#fff', fontSize: 13,
                                outline: 'none',
                            }}
                        />

                        {/* Send button */}
                        <button
                            type="submit"
                            disabled={!input.trim() || loading || recording}
                            style={{
                                width: 40, height: 40, borderRadius: '50%', border: 'none',
                                background: input.trim() && !loading
                                    ? 'linear-gradient(135deg, #8b5cf6, #a855f7)'
                                    : 'rgba(255,255,255,0.08)',
                                color: '#fff', fontSize: 16, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0, transition: 'all 0.2s',
                            }}
                        >
                            ➤
                        </button>
                    </form>
                </div>
            )}
        </>
    );
}
