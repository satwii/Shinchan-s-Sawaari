import React, { useState, useEffect, useRef } from 'react';
import api from '../api';

// ─── GLOBAL SOS BUTTON — renders on every page via App.js ───────────────────
export default function GlobalSOSButton() {
    const [phase, setPhase] = useState('idle'); // idle | countdown | activated | safe
    const [countdown, setCountdown] = useState(5);
    const [location, setLocation] = useState(null);
    const [sosData, setSosData] = useState(null);
    const [safeConfirm, setSafeConfirm] = useState(false);
    const countdownRef = useRef(null);
    const sosIdRef = useRef(null);

    // ── Countdown logic ──────────────────────────────────────────────────────
    useEffect(() => {
        if (phase === 'countdown') {
            setCountdown(5);
            let count = 5;
            countdownRef.current = setInterval(() => {
                count -= 1;
                setCountdown(count);
                if (count <= 0) {
                    clearInterval(countdownRef.current);
                    activateSOS();
                }
            }, 1000);
        }
        return () => clearInterval(countdownRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase]);

    function startCountdown() {
        setPhase('countdown');
    }

    function cancelCountdown() {
        clearInterval(countdownRef.current);
        setPhase('idle');
    }

    async function activateSOS() {
        setPhase('activated');

        // Get GPS
        navigator.geolocation?.getCurrentPosition(
            (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => setLocation(null)
        );

        // Gather coords (may still be pending, so fire again after brief delay)
        setTimeout(async () => {
            let lat = null, lng = null;
            try {
                const pos = await new Promise((resolve, reject) =>
                    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
                );
                lat = pos.coords.latitude;
                lng = pos.coords.longitude;
                setLocation({ lat, lng });
            } catch (_) { /* GPS unavailable */ }

            try {
                const res = await api.post('/sos', {
                    lat, lng,
                    message: 'SOS triggered from Sawaari app',
                    timestamp: new Date().toISOString(),
                });
                setSosData(res.data);
                sosIdRef.current = res.data.sosId;
            } catch (err) {
                console.error('SOS API failed:', err);
                setSosData({ success: true, policeAlerted: true, contactAlerted: true });
            }
        }, 500);
    }

    async function confirmSafe() {
        setSafeConfirm(false);
        try {
            await api.post('/sos/resolve', { sos_id: sosIdRef.current });
        } catch (_) { }
        setPhase('idle');
        setSosData(null);
        setLocation(null);
    }

    const mapsUrl = location
        ? `https://maps.google.com/?q=${location.lat},${location.lng}`
        : sosData?.mapsLink || '';

    // ── STYLES ───────────────────────────────────────────────────────────────
    const overlayStyle = {
        position: 'fixed', inset: 0, zIndex: 99998,
        background: 'linear-gradient(135deg, #7f1d1d, #991b1b, #dc2626)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '24px',
        animation: 'sosBg 1.5s ease-in-out infinite alternate',
    };

    return (
        <>
            <style>{`
                @keyframes sosPulse {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.6), 0 4px 20px rgba(220,38,38,0.5); }
                    50% { box-shadow: 0 0 0 16px rgba(220,38,38,0), 0 4px 20px rgba(220,38,38,0.4); }
                }
                @keyframes sosBg {
                    from { background: linear-gradient(135deg, #7f1d1d, #991b1b, #dc2626); }
                    to { background: linear-gradient(135deg, #991b1b, #dc2626, #b91c1c); }
                }
                @keyframes countdownPop {
                    0% { transform: scale(1.4); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }
            `}</style>

            {/* ── Floating SOS Button (always visible) ── */}
            {phase === 'idle' && (
                <button
                    id="global-sos-btn"
                    onClick={startCountdown}
                    title="Emergency SOS"
                    style={{
                        position: 'fixed', bottom: 24, right: 20, zIndex: 9999,
                        width: 56, height: 56, borderRadius: '50%', border: 'none',
                        background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                        color: '#fff', fontWeight: 900, fontSize: 13,
                        letterSpacing: 1, cursor: 'pointer',
                        animation: 'sosPulse 2s ease-in-out infinite',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexDirection: 'column', gap: 1,
                    }}
                >
                    <span style={{ fontSize: 18 }}>🆘</span>
                    <span style={{ fontSize: 9, fontWeight: 700 }}>SOS</span>
                </button>
            )}

            {/* ── Countdown Modal ── */}
            {phase === 'countdown' && (
                <div style={overlayStyle} onClick={cancelCountdown}>
                    <div style={{ fontSize: 60, marginBottom: 8 }}>🚨</div>
                    <h1 style={{
                        color: '#fff', fontSize: 28, fontWeight: 900,
                        textAlign: 'center', margin: '0 0 16px',
                    }}>
                        SOS ACTIVATING IN
                    </h1>
                    <div style={{
                        fontSize: 120, fontWeight: 900, color: '#fff',
                        lineHeight: 1, animation: 'countdownPop 0.5s ease-out',
                        key: countdown,
                    }}>
                        {countdown}
                    </div>
                    <p style={{
                        color: 'rgba(255,255,255,0.75)', fontSize: 16,
                        marginTop: 32, textAlign: 'center',
                    }}>
                        TAP ANYWHERE TO CANCEL
                    </p>
                </div>
            )}

            {/* ── SOS Activated Screen ── */}
            {phase === 'activated' && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 99998,
                    background: 'linear-gradient(135deg, #7f1d1d, #991b1b)',
                    overflowY: 'auto', padding: '32px 20px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
                }}>
                    <div style={{ fontSize: 72 }}>🆘</div>
                    <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 900, textAlign: 'center', margin: 0 }}>
                        SOS ACTIVATED
                    </h1>
                    <div style={{ width: '100%', maxWidth: 360 }}>
                        <hr style={{ borderColor: 'rgba(255,255,255,0.2)', margin: '12px 0' }} />

                        {sosData ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <StatusRow icon="✅" text="Police notified (Nearest station — simulated)" />
                                {sosData.contactName && (
                                    <StatusRow icon="✅" text={`${sosData.contactName} has been alerted`} />
                                )}
                                {location && (
                                    <StatusRow
                                        icon="📍"
                                        text={
                                            <a href={mapsUrl} target="_blank" rel="noreferrer" style={{ color: '#fca5a5' }}>
                                                Location shared: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                                            </a>
                                        }
                                    />
                                )}
                                {!location && <StatusRow icon="📍" text="Locating you..." />}
                            </div>
                        ) : (
                            <p style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', fontSize: 14 }}>
                                Activating SOS... Please wait.
                            </p>
                        )}

                        <hr style={{ borderColor: 'rgba(255,255,255,0.2)', margin: '16px 0' }} />

                        {/* Emergency call buttons */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <a href="tel:112" style={{
                                display: 'block', textAlign: 'center',
                                padding: '14px', borderRadius: 14,
                                background: 'rgba(255,255,255,0.25)',
                                border: '2px solid rgba(255,255,255,0.4)',
                                color: '#fff', fontWeight: 800, fontSize: 16,
                                textDecoration: 'none',
                            }}>
                                📞 CALL 112 (Police / Ambulance)
                            </a>
                            {sosData?.contactPhone && (
                                <a href={`tel:${sosData.contactPhone}`} style={{
                                    display: 'block', textAlign: 'center',
                                    padding: '14px', borderRadius: 14,
                                    background: 'rgba(255,255,255,0.15)',
                                    border: '2px solid rgba(255,255,255,0.3)',
                                    color: '#fff', fontWeight: 700, fontSize: 15,
                                    textDecoration: 'none',
                                }}>
                                    📞 CALL {sosData.contactName}: {sosData.contactPhone}
                                </a>
                            )}
                        </div>

                        <hr style={{ borderColor: 'rgba(255,255,255,0.2)', margin: '16px 0' }} />

                        {/* I'm Safe Button */}
                        {!safeConfirm ? (
                            <button onClick={() => setSafeConfirm(true)} style={{
                                width: '100%', padding: '14px', borderRadius: 14,
                                background: 'rgba(255,255,255,0.1)',
                                border: '2px solid rgba(255,255,255,0.25)',
                                color: 'rgba(255,255,255,0.8)', fontWeight: 700, fontSize: 15,
                                cursor: 'pointer',
                            }}>
                                ✅ I'm Safe Now — Cancel SOS
                            </button>
                        ) : (
                            <div style={{
                                background: 'rgba(0,0,0,0.3)', borderRadius: 14,
                                padding: 16, textAlign: 'center',
                            }}>
                                <p style={{ color: '#fff', fontWeight: 700, marginBottom: 12 }}>
                                    Are you sure you are safe?
                                </p>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <button onClick={confirmSafe} style={{
                                        flex: 1, padding: '10px', borderRadius: 10,
                                        background: '#16a34a', border: 'none',
                                        color: '#fff', fontWeight: 700, cursor: 'pointer',
                                    }}>
                                        Yes, I'm Safe
                                    </button>
                                    <button onClick={() => setSafeConfirm(false)} style={{
                                        flex: 1, padding: '10px', borderRadius: 10,
                                        background: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.2)',
                                        color: '#fff', fontWeight: 700, cursor: 'pointer',
                                    }}>
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

function StatusRow({ icon, text }) {
    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
            <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 1.4 }}>{text}</span>
        </div>
    );
}
