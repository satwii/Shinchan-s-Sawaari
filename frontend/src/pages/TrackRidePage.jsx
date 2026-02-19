import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix default marker icon in leaflet+webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
    iconUrl: require('leaflet/dist/images/marker-icon.png'),
    shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Custom pulsing marker icon for live location
const pulsingIcon = L.divIcon({
    className: '',
    html: `<div style="
        width: 22px; height: 22px; background: #10b981; border-radius: 50%;
        border: 3px solid #fff; box-shadow: 0 0 12px rgba(16,185,129,0.6), 0 0 30px rgba(16,185,129,0.3);
        animation: pulse-ring-track 1.5s ease-out infinite;
    "></div>
    <style>
        @keyframes pulse-ring-track {
            0% { box-shadow: 0 0 0 0 rgba(16,185,129,0.5); }
            70% { box-shadow: 0 0 0 12px rgba(16,185,129,0); }
            100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
        }
    </style>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
});

// Component to recenter map when position changes
function RecenterMap({ lat, lng }) {
    const map = useMap();
    useEffect(() => {
        if (lat && lng) map.setView([lat, lng], map.getZoom(), { animate: true });
    }, [lat, lng, map]);
    return null;
}

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function TrackRidePage() {
    const { token } = useParams();
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    // SOS state
    const [sosCountdown, setSosCountdown] = useState(0);
    const [showSOSCountdown, setShowSOSCountdown] = useState(false);
    const [sosTriggered, setSosTriggered] = useState(false);

    const fetchTracking = async () => {
        try {
            const res = await fetch(`${API_URL}/api/rides/track/${token}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            setData(json);
        } catch (err) {
            setError(err.message || 'Tracking not found');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTracking();
        const interval = setInterval(fetchTracking, 10000);
        return () => clearInterval(interval);
        // eslint-disable-next-line
    }, [token]);

    // SOS functions
    function triggerSOS() {
        setShowSOSCountdown(true);
        setSosCountdown(5);
        const interval = setInterval(() => {
            setSosCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    setSosTriggered(true);
                    setShowSOSCountdown(false);
                    console.log('🚨 [SOS TRIGGERED FROM PUBLIC TRACKING PAGE]');
                    console.log(`   Tracking Token: ${token}`);
                    console.log(`   Ride: ${data?.ride?.source} → ${data?.ride?.destination}`);
                    if (data?.latest) {
                        console.log(`   Location: https://maps.google.com/?q=${data.latest.lat},${data.latest.lng}`);
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }

    function cancelSOS() {
        setShowSOSCountdown(false);
        setSosCountdown(0);
        setSosTriggered(false);
    }

    // Memoize map center to avoid re-renders
    const mapCenter = useMemo(() => {
        if (data?.latest) return [data.latest.lat, data.latest.lng];
        return [17.385, 78.4867]; // Default: Hyderabad
    }, [data?.latest]);

    if (loading) return (
        <div className="min-h-screen bg-sawaari-dark flex items-center justify-center">
            <div className="text-sawaari-muted animate-pulse">Loading tracking...</div>
        </div>
    );

    if (error) return (
        <div className="min-h-screen bg-sawaari-dark flex items-center justify-center p-6">
            <div className="card text-center max-w-sm">
                <div className="text-4xl mb-3">📍</div>
                <p className="text-red-400 mb-2">{error}</p>
                <p className="text-sawaari-muted text-sm">This tracking link may be invalid or the ride has ended.</p>
            </div>
        </div>
    );

    const ride = data?.ride;
    const latest = data?.latest;

    return (
        <div className="min-h-screen bg-sawaari-dark">
            {/* SOS Countdown Overlay */}
            {showSOSCountdown && (
                <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-6 animate-fade-in">
                    <div className="text-center">
                        <div className="text-8xl font-black text-red-500 mb-4 animate-pulse">{sosCountdown}</div>
                        <h2 className="text-2xl font-bold text-white mb-2">SOS Triggering...</h2>
                        <p className="text-gray-400 mb-8">Emergency alert will be sent in {sosCountdown} seconds</p>
                        <button onClick={cancelSOS}
                            className="px-8 py-4 rounded-2xl bg-sawaari-border text-white text-lg font-bold hover:bg-sawaari-card transition-colors">
                            ✕ Cancel SOS
                        </button>
                    </div>
                </div>
            )}

            {/* SOS Triggered Alert */}
            {sosTriggered && (
                <div className="fixed inset-0 z-[100] bg-red-900 animate-fade-in flex flex-col items-center justify-center p-6">
                    <div className="max-w-md w-full text-center">
                        <div className="text-7xl mb-4 animate-pulse">🚨</div>
                        <h1 className="text-3xl font-black text-white mb-2">SOS TRIGGERED</h1>
                        <p className="text-red-200 mb-6">Emergency alert has been sent</p>

                        <div className="bg-red-800/50 rounded-2xl p-5 text-left space-y-3 mb-6 border border-red-600/30">
                            <div>
                                <span className="text-red-300 text-xs font-semibold uppercase">Route</span>
                                <p className="text-white font-bold">{ride?.source} → {ride?.destination}</p>
                            </div>
                            {ride?.vehicle_reg && (
                                <div>
                                    <span className="text-red-300 text-xs font-semibold uppercase">Vehicle</span>
                                    <p className="text-white font-bold">{ride.vehicle_reg}</p>
                                </div>
                            )}
                            {latest && (
                                <div>
                                    <span className="text-red-300 text-xs font-semibold uppercase">Last Known Location</span>
                                    <a href={`https://maps.google.com/?q=${latest.lat},${latest.lng}`}
                                        target="_blank" rel="noopener noreferrer"
                                        className="block text-blue-300 underline text-sm">
                                        View on Google Maps
                                    </a>
                                </div>
                            )}
                        </div>

                        <button onClick={cancelSOS}
                            className="w-full py-4 rounded-2xl bg-white text-red-600 font-bold text-lg hover:bg-gray-100 transition-colors">
                            I'm Safe — Cancel SOS
                        </button>
                    </div>
                </div>
            )}

            <header className="bg-sawaari-card border-b border-sawaari-border px-4 py-4">
                <div className="max-w-2xl mx-auto">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/30">
                            <span className="text-2xl">🚗</span>
                        </div>
                        <div>
                            <h1 className="text-white font-bold">Sawaari Live Tracking</h1>
                            <p className="text-sawaari-muted text-xs">Shared ride location</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-6 space-y-5 pb-24">
                {/* Ride info */}
                <div className="card">
                    <div className="flex items-center gap-2 mb-3">
                        <span className={`w-2 h-2 rounded-full ${ride?.trip_started && !ride?.trip_completed ? 'bg-green-400 animate-pulse' : ride?.trip_completed ? 'bg-gray-400' : 'bg-amber-400'}`} />
                        <span className={`text-xs font-semibold ${ride?.trip_started && !ride?.trip_completed ? 'text-green-400' : ride?.trip_completed ? 'text-gray-400' : 'text-amber-400'}`}>
                            {ride?.trip_started && !ride?.trip_completed ? 'Active — Live Tracking' : ride?.trip_completed ? 'Trip Completed' : 'Scheduled'}
                        </span>
                    </div>

                    <h2 className="text-white font-bold text-lg mb-1">{ride?.source} → {ride?.destination}</h2>
                    <p className="text-sawaari-muted text-sm">{ride?.date} · {ride?.ride_time || 'Scheduled'} · {ride?.vehicle_type}</p>

                    {ride?.vehicle_reg && (
                        <div className="mt-3 bg-sawaari-dark rounded-xl px-4 py-2 inline-block">
                            <span className="text-sawaari-muted text-xs">Vehicle: </span>
                            <span className="text-white font-bold tracking-wider">{ride.vehicle_reg}</span>
                        </div>
                    )}

                    <div className="mt-3 text-sawaari-muted text-xs">
                        By <span className="text-white font-medium">{ride?.owner_username}</span>
                    </div>
                </div>

                {/* Leaflet Map */}
                {latest && (
                    <div className="card border-emerald-500/30">
                        <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" /> Live Location
                        </h3>
                        <div className="bg-sawaari-dark rounded-xl overflow-hidden" style={{ height: '350px' }}>
                            <MapContainer
                                center={mapCenter}
                                zoom={15}
                                style={{ height: '100%', width: '100%' }}
                                zoomControl={true}
                                scrollWheelZoom={true}
                            >
                                <TileLayer
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                />
                                <Marker position={[latest.lat, latest.lng]} icon={pulsingIcon}>
                                    <Popup>
                                        <div style={{ color: '#1a1a2e', fontWeight: 'bold', fontSize: '13px' }}>
                                            📍 {ride?.source} → {ride?.destination}<br />
                                            <span style={{ fontWeight: 'normal', fontSize: '11px' }}>
                                                {ride?.vehicle_reg && `🚙 ${ride.vehicle_reg}`}
                                            </span>
                                        </div>
                                    </Popup>
                                </Marker>
                                <RecenterMap lat={latest.lat} lng={latest.lng} />
                            </MapContainer>
                        </div>
                        <p className="text-sawaari-muted text-xs mt-2">
                            📍 {latest.lat?.toFixed(5)}, {latest.lng?.toFixed(5)} · Last updated: {new Date(latest.timestamp).toLocaleTimeString()}
                        </p>
                    </div>
                )}

                {!latest && !ride?.trip_completed && (
                    <div className="card text-center">
                        <div className="text-4xl mb-3">⏳</div>
                        <p className="text-white font-medium">Waiting for location data</p>
                        <p className="text-sawaari-muted text-sm mt-1">Location updates will appear once the trip starts.</p>
                    </div>
                )}

                {ride?.trip_completed && (
                    <div className="card text-center">
                        <div className="text-4xl mb-3">🏁</div>
                        <p className="text-white font-medium">Trip Completed</p>
                        <p className="text-sawaari-muted text-sm mt-1">Live tracking has ended for this ride.</p>
                    </div>
                )}

                {/* Footer */}
                <p className="text-center text-sawaari-muted text-xs">
                    🔒 Sawaari — Safe. Smart. Shared.
                </p>
            </main>

            {/* SOS Floating Button (visible on public tracking page) */}
            {ride?.trip_started && !ride?.trip_completed && (
                <button onClick={triggerSOS}
                    className="fixed bottom-6 right-6 z-40 w-16 h-16 rounded-full bg-red-600 shadow-2xl shadow-red-600/50 flex items-center justify-center text-white font-black text-sm animate-pulse hover:bg-red-700 active:scale-90 transition-all border-2 border-red-400">
                    SOS
                </button>
            )}
        </div>
    );
}
