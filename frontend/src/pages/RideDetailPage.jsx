import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
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
        animation: pulse-ring 1.5s ease-out infinite;
    "></div>
    <style>
        @keyframes pulse-ring {
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

function ProfileCard({ profile, compact = false }) {
    if (!profile) return null;
    const badges = profile.badges || [];

    return (
        <div className={`bg-sawaari-dark rounded-xl border border-sawaari-border ${compact ? 'p-3' : 'p-4'}`}>
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-emerald-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {profile.username?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-white font-semibold text-sm truncate">{profile.username}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${profile.gender === 'Female' ? 'bg-pink-500/10 text-pink-400' : profile.gender === 'Male' ? 'bg-blue-500/10 text-blue-400' : 'bg-gray-500/10 text-gray-400'}`}>
                            {profile.gender === 'Female' ? '👩' : profile.gender === 'Male' ? '👨' : '🧑'} {profile.gender}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {profile.avg_rating && (
                            <span className="text-xs text-amber-400 font-medium">⭐ {profile.avg_rating}</span>
                        )}
                        <span className="text-xs text-sawaari-muted">{profile.trip_count || 0} trips</span>
                    </div>
                </div>
            </div>
            {badges.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {badges.map(b => (
                        <span key={b} className={`text-[10px] font-medium px-2 py-0.5 rounded-full border
                            ${b.includes('Aadhaar') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                b.includes('New') ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                    'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                            {b}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function RideDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [ride, setRide] = useState(null);
    const [ownerProfile, setOwnerProfile] = useState(null);
    const [members, setMembers] = useState([]);
    const [isMember, setIsMember] = useState(false);
    const [isOwner, setIsOwner] = useState(false);
    const [requestStatus, setRequestStatus] = useState(null);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState('');
    const [msg, setMsg] = useState('');

    // Trip start
    const [showStartTrip, setShowStartTrip] = useState(false);
    const [vehicleReg, setVehicleReg] = useState('');
    const [tripStartPrompt, setTripStartPrompt] = useState(false);

    // SOS
    const [showSOS, setShowSOS] = useState(false);
    const [sosCountdown, setSosCountdown] = useState(0);
    const [sosTriggered, setSosTriggered] = useState(false);
    const [sosData, setSosData] = useState(null);
    const [sosLocation, setSosLocation] = useState(null);
    const sosTimerRef = useRef(null);

    // GPS Tracking
    const [trackingData, setTrackingData] = useState(null);
    const watchIdRef = useRef(null);
    const trackingIntervalRef = useRef(null);
    const latestLocationRef = useRef(null);

    // Rating
    const [showRating, setShowRating] = useState(false);
    const [ratings, setRatings] = useState({});
    const [ratedUsers, setRatedUsers] = useState([]);

    const fetchRide = useCallback(async () => {
        try {
            const res = await api.get(`/rides/${id}/detail`);
            setRide(res.data.ride);
            setOwnerProfile(res.data.owner_profile);
            setMembers(res.data.members || []);
            setIsMember(res.data.is_member);
            setIsOwner(res.data.is_owner);
            setRequestStatus(res.data.user_request_status);

            // Check if ride is completed and user needs to rate
            if (res.data.ride.trip_completed && res.data.is_member) {
                const ratingRes = await api.get(`/rides/${id}/check-ratings`);
                setRatedUsers(ratingRes.data.ratedUserIds || []);
                const unrated = (res.data.members || []).filter(m =>
                    m.id !== user?.id && !(ratingRes.data.ratedUserIds || []).includes(m.id)
                );
                if (unrated.length > 0) setShowRating(true);
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load ride');
        } finally {
            setLoading(false);
        }
    }, [id, user?.id]);

    const fetchRequests = useCallback(async () => {
        if (!isOwner) return;
        try {
            const res = await api.get(`/rides/${id}/requests`);
            setRequests(res.data.requests || []);
        } catch { /* silent */ }
    }, [id, isOwner]);

    useEffect(() => { fetchRide(); }, [fetchRide]);
    useEffect(() => { if (isOwner) fetchRequests(); }, [fetchRequests, isOwner]);

    // Check if trip should show "Has your trip started?" prompt for owner
    // Asks again every 10 minutes if dismissed
    useEffect(() => {
        if (!ride || !isOwner || ride.trip_started || ride.trip_completed) return;
        if (!ride.ride_time || !ride.date) return;

        const rideDateTime = new Date(`${ride.date}T${ride.ride_time}:00`);
        const now = new Date();

        if (now >= rideDateTime) {
            setTripStartPrompt(true);
        } else {
            const diff = rideDateTime - now;
            const timer = setTimeout(() => setTripStartPrompt(true), diff);
            return () => clearTimeout(timer);
        }
    }, [ride, isOwner]);

    // "Not Yet" → ask again every 10 minutes
    const notYetTimerRef = useRef(null);
    function handleNotYet() {
        setTripStartPrompt(false);
        if (notYetTimerRef.current) clearTimeout(notYetTimerRef.current);
        notYetTimerRef.current = setTimeout(() => {
            setTripStartPrompt(true);
        }, 10 * 60 * 1000); // 10 minutes
    }
    useEffect(() => {
        return () => { if (notYetTimerRef.current) clearTimeout(notYetTimerRef.current); };
    }, []);

    // GPS tracking for ride owner when trip is active
    useEffect(() => {
        if (!ride?.trip_started || ride?.trip_completed || !isOwner) return;
        if (!navigator.geolocation) return;

        // Check tracking expiry: scheduled time + 3 hours
        if (ride.ride_time && ride.date) {
            const rideDateTime = new Date(`${ride.date}T${ride.ride_time}:00`);
            const expiry = new Date(rideDateTime.getTime() + 3 * 60 * 60 * 1000);
            if (new Date() > expiry) return; // Don't track if expired
        }

        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setTrackingData(loc);
                latestLocationRef.current = loc;
            },
            (err) => console.error('GPS error:', err),
            { enableHighAccuracy: true, maximumAge: 10000 }
        );
        watchIdRef.current = watchId;

        // Send to server every 30 seconds
        const interval = setInterval(async () => {
            if (latestLocationRef.current) {
                try {
                    await api.post(`/rides/${id}/track`, latestLocationRef.current);
                } catch { /* silent */ }
            }
        }, 30000);
        trackingIntervalRef.current = interval;

        return () => {
            navigator.geolocation.clearWatch(watchId);
            clearInterval(interval);
        };
    }, [ride?.trip_started, ride?.trip_completed, isOwner, id, ride?.ride_time, ride?.date]);

    // Fetch tracking for members
    useEffect(() => {
        if (!ride?.trip_started || ride?.trip_completed || isOwner) return;
        const fetchTracking = async () => {
            try {
                const res = await api.get(`/rides/${id}/tracking`);
                if (res.data.latest) setTrackingData(res.data.latest);
            } catch { /* silent */ }
        };
        fetchTracking();
        const interval = setInterval(fetchTracking, 10000);
        return () => clearInterval(interval);
    }, [ride?.trip_started, ride?.trip_completed, isOwner, id]);

    async function handleRequestJoin() {
        setActionLoading(true); setMsg('');
        try {
            const res = await api.post(`/rides/${id}/request`);
            setMsg(res.data.message);
            setRequestStatus('pending');
            fetchRide();
        } catch (err) {
            setMsg(err.response?.data?.error || 'Failed to send request');
        } finally {
            setActionLoading(false);
        }
    }

    async function handleRespondRequest(requestId, action) {
        try {
            await api.post(`/rides/${id}/requests/${requestId}/respond`, { action });
            fetchRequests(); fetchRide();
            setMsg(action === 'accept' ? 'Request accepted!' : 'Request declined.');
        } catch (err) {
            setMsg(err.response?.data?.error || 'Failed');
        }
    }

    async function handleRemoveMember(userId) {
        try {
            await api.post(`/rides/${id}/remove-member`, { userId });
            fetchRide(); setMsg('Member removed');
        } catch (err) {
            setMsg(err.response?.data?.error || 'Failed');
        }
    }

    async function handleStartTrip() {
        if (!vehicleReg.trim()) return setMsg('Vehicle registration number is required');
        setActionLoading(true);
        try {
            const res = await api.post(`/rides/${id}/start-trip`, { vehicleReg });
            setMsg(res.data.message);
            setShowStartTrip(false);
            setTripStartPrompt(false);
            fetchRide();
        } catch (err) {
            setMsg(err.response?.data?.error || 'Failed to start trip');
        } finally {
            setActionLoading(false);
        }
    }

    async function handleCompleteTrip() {
        setActionLoading(true);
        try {
            await api.post(`/rides/${id}/complete-trip`);
            setMsg('Trip completed!');
            fetchRide();
        } catch (err) {
            setMsg(err.response?.data?.error || 'Failed');
        } finally {
            setActionLoading(false);
        }
    }

    // SOS functions
    function triggerSOS() {
        setShowSOS(true);
        setSosCountdown(5);
        sosTimerRef.current = setInterval(() => {
            setSosCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(sosTimerRef.current);
                    executeSOS();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }

    function cancelSOS() {
        clearInterval(sosTimerRef.current);
        setShowSOS(false);
        setSosCountdown(0);
        setSosTriggered(false);
    }

    async function executeSOS() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    setSosLocation(loc);
                    await finalizeSOS(loc);
                },
                async () => {
                    await finalizeSOS(null);
                }
            );
        } else {
            await finalizeSOS(null);
        }
    }

    async function finalizeSOS(location) {
        try {
            const res = await api.get(`/rides/${id}/sos-data`);
            const data = res.data;
            const loc = location || sosLocation;
            const mapsLink = loc ? `https://maps.google.com/?q=${loc.lat},${loc.lng}` : 'Location unavailable';

            const alert = {
                ...data,
                location: loc,
                mapsLink,
                timestamp: new Date().toISOString(),
            };

            setSosData(alert);
            setSosTriggered(true);

            console.log(`\n🚨 [SOS ALERT TRIGGERED]`);
            console.log(`   User: ${alert.userName}`);
            console.log(`   Location: ${mapsLink}`);
            console.log(`   Vehicle: ${alert.vehicleReg}`);
            console.log(`   Co-passengers: ${alert.coPassengers.join(', ')}`);
            console.log(`   Route: ${alert.source} → ${alert.destination}`);
            console.log(`   Emergency Contact: ${alert.emergencyContact.name} (${alert.emergencyContact.phone})`);
            console.log(`   Sent to: Emergency contact + Nearest police station`);
            console.log(`\n`);
        } catch (err) {
            console.error('SOS error:', err);
        }
    }

    // Rating
    async function handleSubmitRatings() {
        const ratingsArr = Object.entries(ratings).map(([userId, stars]) => ({
            userId: parseInt(userId), stars,
        }));
        try {
            await api.post(`/rides/${id}/rate`, { ratings: ratingsArr });
            setMsg('Ratings submitted! Thank you.');
            setShowRating(false);
            fetchRide();
        } catch (err) {
            setMsg(err.response?.data?.error || 'Failed');
        }
    }

    function copyTrackingLink() {
        const link = `${window.location.origin}/track/${ride.tracking_token}`;
        navigator.clipboard.writeText(link).then(() => setMsg('Tracking link copied!'));
    }

    // Memoize map center to avoid re-renders
    const mapCenter = useMemo(() => {
        if (trackingData) return [trackingData.lat, trackingData.lng];
        return [17.385, 78.4867]; // Default: Hyderabad
    }, [trackingData]);

    if (loading) return (
        <div className="min-h-screen bg-sawaari-dark flex items-center justify-center">
            <div className="text-sawaari-muted animate-pulse">Loading ride details...</div>
        </div>
    );

    if (error && !ride) return (
        <div className="min-h-screen bg-sawaari-dark flex items-center justify-center">
            <div className="card text-center max-w-sm">
                <p className="text-red-400 mb-4">{error}</p>
                <button onClick={() => navigate(-1)} className="btn-primary">← Go Back</button>
            </div>
        </div>
    );

    const isActive = ride?.trip_started && !ride?.trip_completed;

    return (
        <div className="min-h-screen bg-sawaari-dark">
            {/* SOS Full Screen Alert */}
            {sosTriggered && sosData && (
                <div className="fixed inset-0 z-[100] bg-red-900 animate-fade-in flex flex-col items-center justify-center p-6 overflow-y-auto">
                    <div className="max-w-md w-full text-center">
                        <div className="text-7xl mb-4 animate-pulse">🚨</div>
                        <h1 className="text-3xl font-black text-white mb-2">SOS TRIGGERED</h1>
                        <p className="text-red-200 mb-6">Emergency alert has been sent</p>

                        <div className="bg-red-800/50 rounded-2xl p-5 text-left space-y-3 mb-6 border border-red-600/30">
                            <div><span className="text-red-300 text-xs font-semibold uppercase">User</span><p className="text-white font-bold">{sosData.userName}</p></div>
                            <div><span className="text-red-300 text-xs font-semibold uppercase">Location</span>
                                {sosData.location ? (
                                    <a href={sosData.mapsLink} target="_blank" rel="noopener noreferrer" className="block text-blue-300 underline text-sm break-all">{sosData.mapsLink}</a>
                                ) : <p className="text-white text-sm">Location unavailable</p>}
                            </div>
                            <div><span className="text-red-300 text-xs font-semibold uppercase">Vehicle</span><p className="text-white font-bold">{sosData.vehicleReg}</p></div>
                            <div><span className="text-red-300 text-xs font-semibold uppercase">Co-passengers</span><p className="text-white text-sm">{sosData.coPassengers.join(', ') || 'None'}</p></div>
                            <div><span className="text-red-300 text-xs font-semibold uppercase">Route</span><p className="text-white text-sm">{sosData.source} → {sosData.destination}</p></div>
                        </div>

                        <div className="space-y-2 mb-6">
                            <div className="bg-red-800/50 rounded-xl px-4 py-3 border border-red-600/30">
                                <p className="text-red-200 text-xs uppercase font-semibold">Sent to Emergency Contact</p>
                                <p className="text-white font-bold">{sosData.emergencyContact.name} ({sosData.emergencyContact.phone})</p>
                            </div>
                            <div className="bg-red-800/50 rounded-xl px-4 py-3 border border-red-600/30">
                                <p className="text-red-200 text-xs uppercase font-semibold">Nearest Police Station</p>
                                <p className="text-white font-bold animate-pulse">Connecting to nearest police station...</p>
                            </div>
                        </div>

                        <button onClick={cancelSOS}
                            className="w-full py-4 rounded-2xl bg-white text-red-600 font-bold text-lg hover:bg-gray-100 transition-colors">
                            I'm Safe — Cancel SOS
                        </button>
                    </div>
                </div>
            )}

            {/* SOS Countdown */}
            {showSOS && !sosTriggered && (
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

            {/* Rating Modal */}
            {showRating && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowRating(false)} />
                    <div className="relative w-full max-w-md bg-sawaari-card rounded-2xl border border-sawaari-border p-6 animate-slide-up">
                        <h2 className="text-xl font-bold text-white mb-1">Rate Your Co-riders</h2>
                        <p className="text-sawaari-muted text-sm mb-5">How was your ride experience?</p>

                        <div className="space-y-4 max-h-60 overflow-y-auto">
                            {members.filter(m => m.id !== user?.id && !ratedUsers.includes(m.id)).map(m => (
                                <div key={m.id} className="flex items-center justify-between bg-sawaari-dark rounded-xl p-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 text-xs font-bold">{m.username?.[0]?.toUpperCase()}</div>
                                        <span className="text-white text-sm font-medium">{m.username}</span>
                                    </div>
                                    <div className="flex gap-1">
                                        {[1, 2, 3, 4, 5].map(star => (
                                            <button key={star} onClick={() => setRatings(p => ({ ...p, [m.id]: star }))}
                                                className={`text-xl transition-transform hover:scale-110 ${(ratings[m.id] || 0) >= star ? 'text-amber-400' : 'text-sawaari-border'}`}>
                                                ★
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-3 mt-5">
                            <button onClick={() => setShowRating(false)} className="btn-secondary flex-1">Skip</button>
                            <button onClick={handleSubmitRatings} className="btn-primary flex-1"
                                disabled={Object.keys(ratings).length === 0}>
                                Submit ⭐
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="sticky top-0 z-40 bg-sawaari-dark/80 backdrop-blur-xl border-b border-sawaari-border">
                <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate(-1)} className="text-sawaari-muted hover:text-white transition-colors">←</button>
                        <div>
                            <span className="font-bold text-white text-sm">Ride #{id}</span>
                            <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-semibold ${ride?.trip_completed ? 'bg-gray-500/20 text-gray-400' :
                                ride?.trip_started ? 'bg-green-500/20 text-green-400' :
                                    'bg-primary-500/20 text-primary-400'}`}>
                                {ride?.trip_completed ? 'Completed' : ride?.trip_started ? '🟢 Live' : 'Scheduled'}
                            </span>
                        </div>
                    </div>
                    {isMember && !ride?.trip_completed && (
                        <button onClick={() => navigate(`/chat/${id}`)}
                            className="text-sm text-primary-400 font-semibold hover:text-primary-300 transition-colors">
                            💬 Chat
                        </button>
                    )}
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-6 space-y-5 pb-32">
                {/* Feedback */}
                {msg && (
                    <div className={`px-4 py-3 rounded-xl text-sm font-medium animate-fade-in ${msg.toLowerCase().includes('fail') || msg.toLowerCase().includes('error')
                        ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                        : 'bg-green-500/10 border border-green-500/30 text-green-400'}`}>
                        {msg}
                    </div>
                )}

                {/* Trip Start Prompt */}
                {tripStartPrompt && isOwner && !ride?.trip_started && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 animate-slide-up">
                        <h3 className="text-amber-400 font-bold text-lg mb-2">🕐 Has your trip started?</h3>
                        <p className="text-amber-200/70 text-sm mb-4">Your scheduled ride time has arrived.</p>
                        <div className="flex gap-3">
                            <button onClick={() => { setShowStartTrip(true); setTripStartPrompt(false); }}
                                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold text-sm shadow-lg shadow-emerald-500/20 hover:from-emerald-600 hover:to-emerald-700 transition-all active:scale-95">
                                ✅ Yes, Start Trip
                            </button>
                            <button onClick={handleNotYet}
                                className="flex-1 py-3 rounded-xl bg-sawaari-border text-white font-bold text-sm hover:bg-sawaari-card transition-all active:scale-95">
                                ⏳ Not Yet
                            </button>
                        </div>
                        <p className="text-amber-200/40 text-xs mt-2 text-center">We'll ask again in 10 minutes if you're not ready yet</p>
                    </div>
                )}

                {/* Vehicle Reg Input (Start Trip) */}
                {showStartTrip && (
                    <div className="card border-emerald-500/30 animate-slide-up">
                        <h3 className="text-white font-bold mb-3">Enter Vehicle Registration</h3>
                        <input type="text" value={vehicleReg} onChange={e => setVehicleReg(e.target.value.toUpperCase())}
                            placeholder="e.g. TN 11 AB 1234" className="input-field mb-3 tracking-widest uppercase" autoFocus />
                        <p className="text-sawaari-muted text-xs mb-4">Must contain letters and numbers, min 6 characters.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowStartTrip(false)} className="btn-secondary flex-1">Cancel</button>
                            <button onClick={handleStartTrip} disabled={actionLoading || vehicleReg.trim().length < 6}
                                className="btn-primary flex-1">{actionLoading ? 'Starting...' : '🚗 Start Trip'}</button>
                        </div>
                    </div>
                )}

                {/* Ride Info Card */}
                <div className="card">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500/20 to-emerald-500/10 border border-primary-500/20 flex items-center justify-center text-2xl">
                            {ride?.vehicle_type === 'Auto' ? '🛺' : ride?.vehicle_type === 'Cab' ? '🚖' : ride?.vehicle_type === 'Mini Bus' ? '🚌' : '🚗'}
                        </div>
                        <div>
                            <div className="text-white font-bold">{ride?.source} → {ride?.destination}</div>
                            <div className="text-sawaari-muted text-sm">
                                {ride?.date} · {ride?.ride_time || ride?.time_slot} · {ride?.vehicle_type}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-sawaari-dark rounded-xl px-3 py-2 text-center">
                            <div className="text-white font-bold text-lg">{ride?.seats_available}</div>
                            <div className="text-sawaari-muted text-xs">Seats</div>
                        </div>
                        <div className="bg-sawaari-dark rounded-xl px-3 py-2 text-center">
                            <div className="text-white font-bold text-sm">{ride?.vehicle_type}</div>
                            <div className="text-sawaari-muted text-xs">Vehicle</div>
                        </div>
                        <div className="bg-sawaari-dark rounded-xl px-3 py-2 text-center">
                            <div className="text-white font-bold text-sm">{ride?.member_count || 1}</div>
                            <div className="text-sawaari-muted text-xs">Members</div>
                        </div>
                    </div>

                    {ride?.vehicle_reg && (
                        <div className="mt-3 bg-sawaari-dark rounded-xl px-4 py-2 flex items-center gap-2">
                            <span className="text-sawaari-muted text-xs">Vehicle:</span>
                            <span className="text-white font-bold tracking-wider">{ride.vehicle_reg}</span>
                        </div>
                    )}

                    {ride?.pink_mode === 1 && (
                        <div className="mt-3 bg-pink-500/10 border border-pink-500/20 rounded-xl px-4 py-2">
                            <span className="text-pink-400 text-xs font-semibold">🩷 Pink Mode — Female Only</span>
                        </div>
                    )}
                </div>

                {/* Live Map with Leaflet.js */}
                {isActive && trackingData && (
                    <div className="card border-emerald-500/30">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-white font-bold flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" /> Live Location
                            </h3>
                            {isOwner && ride?.tracking_token && (
                                <button onClick={copyTrackingLink}
                                    className="text-xs text-primary-400 font-semibold px-3 py-1 bg-primary-500/10 rounded-full hover:bg-primary-500/20 transition-colors">
                                    📋 Share Link
                                </button>
                            )}
                        </div>
                        <div className="bg-sawaari-dark rounded-xl overflow-hidden" style={{ height: '280px' }}>
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
                                <Marker position={[trackingData.lat, trackingData.lng]} icon={pulsingIcon}>
                                    <Popup>
                                        <div style={{ color: '#1a1a2e', fontWeight: 'bold', fontSize: '13px' }}>
                                            📍 {ride?.source} → {ride?.destination}<br />
                                            <span style={{ fontWeight: 'normal', fontSize: '11px' }}>
                                                {ride?.vehicle_reg && `🚙 ${ride.vehicle_reg}`}
                                            </span>
                                        </div>
                                    </Popup>
                                </Marker>
                                <RecenterMap lat={trackingData.lat} lng={trackingData.lng} />
                            </MapContainer>
                        </div>
                        <p className="text-sawaari-muted text-xs mt-2">
                            📍 {trackingData.lat?.toFixed(5)}, {trackingData.lng?.toFixed(5)}
                        </p>
                    </div>
                )}

                {/* Owner Profile */}
                <div>
                    <h3 className="text-sawaari-muted text-xs font-semibold uppercase tracking-wide mb-2">Ride Owner</h3>
                    <ProfileCard profile={ownerProfile} />
                </div>

                {/* Members */}
                <div>
                    <h3 className="text-sawaari-muted text-xs font-semibold uppercase tracking-wide mb-2">
                        Members ({members.length})
                    </h3>
                    <div className="space-y-2">
                        {members.map(m => (
                            <div key={m.id} className="relative">
                                <ProfileCard profile={m} compact />
                                {isOwner && m.id !== user?.id && !ride?.trip_started && (
                                    <button onClick={() => handleRemoveMember(m.id)}
                                        className="absolute top-3 right-3 text-xs text-red-400 hover:text-red-300 transition-colors">✕ Remove</button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Pending Requests (Owner only) */}
                {isOwner && requests.filter(r => r.status === 'pending').length > 0 && (
                    <div>
                        <h3 className="text-sawaari-muted text-xs font-semibold uppercase tracking-wide mb-2">
                            Pending Requests ({requests.filter(r => r.status === 'pending').length})
                        </h3>
                        <div className="space-y-2">
                            {requests.filter(r => r.status === 'pending').map(req => (
                                <div key={req.id} className="bg-sawaari-dark rounded-xl border border-amber-500/20 p-4">
                                    <ProfileCard profile={req.profile} compact />
                                    <div className="flex gap-3 mt-3">
                                        <button onClick={() => handleRespondRequest(req.id, 'accept')}
                                            className="flex-1 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold text-sm shadow-md shadow-emerald-500/20 active:scale-95 transition-all">
                                            ✅ Accept
                                        </button>
                                        <button onClick={() => handleRespondRequest(req.id, 'decline')}
                                            className="flex-1 py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 font-semibold text-sm active:scale-95 transition-all">
                                            ❌ Decline
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                {!isMember && !isOwner && !ride?.trip_started && !ride?.trip_completed && (
                    <div>
                        {requestStatus === 'pending' ? (
                            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-center">
                                <span className="text-amber-400 font-semibold text-sm">⏳ Request Pending — Waiting for owner approval</span>
                            </div>
                        ) : requestStatus === 'declined' ? (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-center">
                                <span className="text-red-400 font-semibold text-sm">Request not accepted</span>
                            </div>
                        ) : (
                            <button onClick={handleRequestJoin} disabled={actionLoading}
                                className="btn-primary w-full flex items-center justify-center gap-2">
                                {actionLoading ? 'Sending Request...' : '🤝 Request to Join'}
                            </button>
                        )}
                    </div>
                )}

                {/* Owner controls */}
                {isOwner && ride?.trip_started && !ride?.trip_completed && (
                    <button onClick={handleCompleteTrip} disabled={actionLoading}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-gray-600 to-gray-700 text-white font-bold shadow-lg active:scale-95 transition-all">
                        {actionLoading ? 'Completing...' : '🏁 Complete Trip'}
                    </button>
                )}

                {/* Complete → Rate */}
                {ride?.trip_completed && members.length > 1 && !showRating && (
                    <button onClick={() => setShowRating(true)}
                        className="btn-primary w-full">
                        ⭐ Rate Your Co-riders
                    </button>
                )}
            </main>

            {/* SOS Floating Button */}
            {isMember && !ride?.trip_completed && (
                <button onClick={triggerSOS}
                    className="fixed bottom-6 right-6 z-40 w-16 h-16 rounded-full bg-red-600 shadow-2xl shadow-red-600/50 flex items-center justify-center text-white font-black text-sm animate-pulse hover:bg-red-700 active:scale-90 transition-all border-2 border-red-400">
                    SOS
                </button>
            )}
        </div>
    );
}
