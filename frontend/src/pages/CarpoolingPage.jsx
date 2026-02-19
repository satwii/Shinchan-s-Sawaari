import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import RideCard from '../components/RideCard';
import RegisterRideModal from '../components/RegisterRideModal';

const TIME_SLOTS = ['Early Morning', 'Morning', 'Afternoon', 'Evening', 'Night'];
const TIME_SLOT_ICONS = {
    'Early Morning': '🌄',
    'Morning': '🌅',
    'Afternoon': '☀️',
    'Evening': '🌇',
    'Night': '🌙',
};

export default function CarpoolingPage() {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [pinkMode, setPinkMode] = useState(false);
    const [source, setSource] = useState('');
    const [destination, setDestination] = useState('');
    const [date, setDate] = useState('');
    const [timeSlot, setTimeSlot] = useState('');
    const [maleCount, setMaleCount] = useState(0);
    const [femaleCount, setFemaleCount] = useState(0);

    const [rides, setRides] = useState([]);
    const [searched, setSearched] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [myRides, setMyRides] = useState([]);
    const [showRegister, setShowRegister] = useState(false);
    const [joiningId, setJoiningId] = useState(null);
    const [joinMsg, setJoinMsg] = useState('');

    const today = new Date().toISOString().split('T')[0];

    const fetchMyRides = useCallback(async () => {
        try {
            const res = await api.get('/rides/my');
            setMyRides(res.data.rides || []);
        } catch { /* silent */ }
    }, []);

    useEffect(() => { fetchMyRides(); }, [fetchMyRides]);

    async function handleSearch(e) {
        if (e?.preventDefault) e.preventDefault();
        setError('');
        if (!source.trim() || !destination.trim()) return setError('Please enter source and destination');
        setLoading(true);
        setSearched(true);
        try {
            const res = await api.post('/rides/search', {
                source: source.trim(),
                destination: destination.trim(),
                date: date || undefined,
                timeSlot: timeSlot || undefined,
                pinkMode,
            });
            setRides(res.data.rides || []);
        } catch (err) {
            setError(err.response?.data?.error || 'Search failed');
            setRides([]);
        } finally {
            setLoading(false);
        }
    }

    async function handleJoin(rideId) {
        setJoiningId(rideId);
        setJoinMsg('');
        try {
            const res = await api.post(`/rides/${rideId}/join`);
            setJoinMsg(res.data.message || 'Joined!');
            await Promise.all([handleSearch(), fetchMyRides()]);
            if (res.data.chatEnabled) {
                setTimeout(() => navigate(`/chat/${rideId}`), 1200);
            }
        } catch (err) {
            setJoinMsg(err.response?.data?.error || 'Failed to join');
        } finally {
            setJoiningId(null);
        }
    }

    function handleRegisterSuccess() {
        setShowRegister(false);
        fetchMyRides();
    }

    return (
        <div className={`min-h-screen transition-colors duration-500 ${pinkMode ? 'bg-[#0d0a10]' : 'bg-sawaari-dark'}`}>
            {/* Header */}
            <header className={`sticky top-0 z-50 backdrop-blur-xl border-b transition-colors duration-500
        ${pinkMode ? 'bg-[#0d0a10]/90 border-pink-500/20' : 'bg-sawaari-dark/80 border-sawaari-border'}`}>
                <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/home')}
                            className="text-sawaari-muted hover:text-white transition-colors">←</button>
                        <div>
                            <span className="text-xs text-sawaari-muted block leading-tight">Sawaari</span>
                            <span className="font-bold text-white text-sm">🤝 Carpooling</span>
                        </div>
                    </div>

                    {/* Pink Mode Toggle */}
                    <button
                        onClick={() => setPinkMode(m => !m)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold
              transition-all duration-300 border
              ${pinkMode
                                ? 'bg-pink-500 border-pink-400 text-white shadow-lg shadow-pink-500/40'
                                : 'bg-sawaari-card border-sawaari-border text-sawaari-muted hover:border-pink-500/40 hover:text-pink-400'}`}
                    >
                        <span>🩷</span>
                        <span>{pinkMode ? 'Pink ON' : 'Pink Mode'}</span>
                        <span className={`w-2 h-2 rounded-full ${pinkMode ? 'bg-white' : 'bg-sawaari-muted'}`} />
                    </button>
                </div>
            </header>

            {/* Pink Mode Banner */}
            {pinkMode && (
                <div className="bg-gradient-to-r from-pink-500/10 via-pink-500/5 to-transparent border-b border-pink-500/20 px-4 py-2.5 animate-fade-in">
                    <p className="text-pink-400 text-xs font-medium text-center">
                        🩷 Pink Mode Active — Showing rides by Female users only
                    </p>
                </div>
            )}

            <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
                {/* Search Form */}
                <section className={`card transition-all duration-300
          ${pinkMode ? 'border-pink-500/30' : 'border-sawaari-border/60'}`}>
                    <h2 className="font-bold text-white text-lg mb-4 flex items-center gap-2">
                        <span>🔍</span> Find a Carpool
                    </h2>

                    <form onSubmit={handleSearch} className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="label">From</label>
                                <input type="text" value={source} onChange={e => setSource(e.target.value)}
                                    placeholder="Source area" className="input-field" />
                            </div>
                            <div>
                                <label className="label">To</label>
                                <input type="text" value={destination} onChange={e => setDestination(e.target.value)}
                                    placeholder="Destination" className="input-field" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="label">Date</label>
                                <input type="date" value={date} min={today} onChange={e => setDate(e.target.value)}
                                    className="input-field" />
                            </div>
                            <div>
                                <label className="label">Time of Day</label>
                                <select value={timeSlot} onChange={e => setTimeSlot(e.target.value)} className="input-field">
                                    <option value="">Any time</option>
                                    {TIME_SLOTS.map(slot => (
                                        <option key={slot} value={slot}>{TIME_SLOT_ICONS[slot]} {slot}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="label">People with you</label>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">👨</span>
                                    <input type="number" min="0" max="20" value={maleCount}
                                        onChange={e => setMaleCount(parseInt(e.target.value) || 0)}
                                        className="input-field pl-9" placeholder="Males" />
                                </div>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">👩</span>
                                    <input type="number" min="0" max="20" value={femaleCount}
                                        onChange={e => setFemaleCount(parseInt(e.target.value) || 0)}
                                        className="input-field pl-9" placeholder="Females" />
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl">
                                {error}
                            </div>
                        )}

                        <button type="submit" disabled={loading}
                            className={`btn-primary w-full ${pinkMode ? '!from-pink-500 !to-pink-600 shadow-pink-500/25' : ''}`}>
                            {loading
                                ? <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Searching...
                                </span>
                                : '🔍  Search Carpools'}
                        </button>
                    </form>
                </section>

                {/* Join feedback */}
                {joinMsg && (
                    <div className={`px-4 py-3 rounded-xl text-sm font-medium animate-fade-in
            ${joinMsg.toLowerCase().includes('join') || joinMsg.toLowerCase().includes('success')
                            ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                            : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
                        {joinMsg}
                    </div>
                )}

                {/* Search Results */}
                {searched && (
                    <section className="animate-slide-up">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="font-bold text-white">
                                {loading ? 'Searching...' : `${rides.length} carpool${rides.length !== 1 ? 's' : ''} found`}
                            </h2>
                            {pinkMode && (
                                <span className="badge bg-pink-500/10 text-pink-400 border border-pink-500/20">🩷 Pink filtered</span>
                            )}
                        </div>

                        {!loading && rides.length === 0 && (
                            <div className="card text-center py-10">
                                <div className="text-5xl mb-3">🤝</div>
                                <p className="text-white font-semibold mb-1">No carpools found</p>
                                <p className="text-sawaari-muted text-sm">
                                    {pinkMode ? 'No rides by female users on this route.' : 'Be the first to register a carpool on this route!'}
                                </p>
                                <button onClick={() => setShowRegister(true)}
                                    className={`mt-4 btn-primary px-6 ${pinkMode ? '!from-pink-500 !to-pink-600' : ''}`}>
                                    + Register Your Ride
                                </button>
                            </div>
                        )}

                        {!loading && rides.map(ride => (
                            <RideCard key={ride.id} ride={ride} pinkMode={pinkMode}
                                onJoin={handleJoin} joining={joiningId === ride.id}
                                currentUserId={user?.id} />
                        ))}
                    </section>
                )}

                {/* My Rides */}
                {myRides.length > 0 && (
                    <section className="animate-slide-up">
                        <h2 className="font-bold text-white mb-3">Your Carpools</h2>
                        {myRides.map(ride => (
                            <RideCard key={ride.id} ride={ride} pinkMode={pinkMode}
                                isMyRide onChat={() => navigate(`/chat/${ride.id}`)}
                                chatEnabled={ride.member_count > 1}
                                currentUserId={user?.id} />
                        ))}
                    </section>
                )}

                <div className="h-24" />
            </main>

            {/* FAB — Register Ride */}
            <button
                onClick={() => setShowRegister(true)}
                className={`fixed bottom-6 right-6 z-40 flex items-center gap-2 px-5 py-3.5 rounded-2xl
          font-semibold text-white shadow-2xl transition-all duration-300 active:scale-95
          ${pinkMode
                        ? 'bg-gradient-to-r from-pink-500 to-pink-600 shadow-pink-500/40'
                        : 'bg-gradient-to-r from-primary-500 to-primary-600 shadow-primary-500/40'}`}
            >
                <span className="text-xl">+</span>
                <span>Register Ride</span>
            </button>

            {/* Register Modal */}
            {showRegister && (
                <RegisterRideModal
                    pinkMode={pinkMode}
                    prefill={{ source, destination, date, timeSlot }}
                    onClose={() => setShowRegister(false)}
                    onSuccess={handleRegisterSuccess}
                />
            )}
        </div>
    );
}
