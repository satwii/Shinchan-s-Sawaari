import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';

export default function RiderDashboard() {
    const { user } = useAuth();
    const [source, setSource] = useState('');
    const [destination, setDestination] = useState('');
    const [pinkMode, setPinkMode] = useState(false);
    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const navigate = useNavigate();

    const isFemale = user?.gender === 'Female';

    async function handleSearch(e) {
        e.preventDefault();
        setLoading(true);
        setSearched(true);
        try {
            const params = { source, destination };
            if (pinkMode) params.pink_mode = 'true';
            const res = await api.get('/ts/trips', { params });
            setTrips(res.data.trips || []);
        } catch (err) {
            console.error('Search error:', err);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className={`min-h-screen transition-colors duration-500 ${pinkMode ? 'bg-[#0d0a10]' : 'bg-sawaari-dark'}`}>
            <header className={`sticky top-0 z-50 backdrop-blur-xl border-b transition-colors duration-500
                ${pinkMode ? 'bg-[#0d0a10]/90 border-pink-500/20' : 'bg-sawaari-dark/80 border-sawaari-border'}`}>
                <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/home')} className="text-sawaari-muted hover:text-white transition-colors">←</button>
                        <div>
                            <span className="text-xs text-sawaari-muted block">Sawaari · DriveShare</span>
                            <span className="text-white font-bold text-sm">🎫 Find a Carpool</span>
                        </div>
                    </div>

                    {/* Pink Mode Toggle — visible to all but only functional for females */}
                    {isFemale && (
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
                    )}
                </div>
            </header>

            {/* Pink Mode Banner */}
            {pinkMode && (
                <div className="bg-gradient-to-r from-pink-500/10 via-pink-500/5 to-transparent border-b border-pink-500/20 px-4 py-2.5 animate-fade-in">
                    <p className="text-pink-400 text-xs font-medium text-center">
                        🩷 Pink Mode Active — Showing female-friendly trips only
                    </p>
                </div>
            )}

            <main className="max-w-2xl mx-auto px-4 py-6 space-y-5 animate-fade-in">
                {/* Search form */}
                <form onSubmit={handleSearch} className={`card space-y-4 transition-all duration-300
                    ${pinkMode ? 'border-pink-500/30' : 'border-sawaari-border/60'}`}>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="label">From</label>
                            <input type="text" value={source} onChange={e => setSource(e.target.value)}
                                placeholder="Source" className="input-field" />
                        </div>
                        <div>
                            <label className="label">To</label>
                            <input type="text" value={destination} onChange={e => setDestination(e.target.value)}
                                placeholder="Destination" className="input-field" />
                        </div>
                    </div>
                    <button type="submit" disabled={loading}
                        className={`btn-primary w-full ${pinkMode ? '!from-pink-500 !to-pink-600 shadow-pink-500/25' : ''}`}>
                        {loading ? 'Searching...' : '🔍 Search Trips'}
                    </button>
                </form>

                {/* My Bookings shortcut */}
                <button onClick={() => navigate('/rider/bookings')}
                    className="w-full py-3 rounded-xl border border-sawaari-border text-sm text-sawaari-muted hover:text-white hover:border-primary-500/50 transition-all flex items-center justify-center gap-2">
                    🎫 View My Bookings
                </button>

                {/* Results */}
                {searched && !loading && trips.length === 0 && (
                    <div className="card text-center py-10">
                        <div className="text-4xl mb-3">🔍</div>
                        <p className="text-white font-semibold">No trips found</p>
                        <p className="text-sawaari-muted text-sm mt-1">
                            {pinkMode ? 'No female-friendly trips on this route. Try with Pink Mode off.' : 'Try different locations or broader search terms'}
                        </p>
                    </div>
                )}

                {searched && (
                    <div className="flex items-center justify-between mb-1">
                        <h2 className="font-bold text-white text-sm">
                            {loading ? 'Searching...' : `${trips.length} trip${trips.length !== 1 ? 's' : ''} found`}
                        </h2>
                        {pinkMode && trips.length > 0 && (
                            <span className="badge bg-pink-500/10 text-pink-400 border border-pink-500/20 text-xs">🩷 Pink filtered</span>
                        )}
                    </div>
                )}

                {trips.map(trip => (
                    <TripCard key={trip.id} trip={trip} pinkMode={pinkMode}
                        onSelect={() => navigate(`/rider/book/${trip.id}`)} />
                ))}
            </main>
        </div>
    );
}

function TripCard({ trip, pinkMode, onSelect }) {
    return (
        <div className={`card animate-slide-up border transition-all duration-300
            ${trip.pink_mode ? 'border-pink-500/30' : 'border-sawaari-border'}
            ${pinkMode ? 'hover:border-pink-500/50' : 'hover:border-primary-500/30'}`}>
            {trip.pink_mode && (
                <div className="flex items-center gap-1 mb-2">
                    <span className="text-xs bg-pink-500/20 text-pink-400 px-2 py-0.5 rounded-full border border-pink-500/20 font-semibold">🩷 Pink Mode</span>
                </div>
            )}
            <div className="flex items-start justify-between mb-3">
                <div>
                    <p className="text-white font-bold text-lg">{trip.source} → {trip.destination}</p>
                    <p className="text-sawaari-muted text-xs mt-0.5">{trip.trip_date} · {trip.trip_time}</p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${trip.status_name === 'Full' ? 'text-red-400 border-red-500/30 bg-red-500/10' : 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'}`}>
                    {trip.status_name}
                </span>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-4">
                <InfoCell label="Driver" value={trip.driver_name} />
                <InfoCell label="Seats" value={`${trip.available_seats} left`} />
                <InfoCell label="Price" value={trip.price_per_seat > 0 ? `₹${trip.price_per_seat}` : 'Free'} />
                <InfoCell label="Vehicle" value={trip.vehicle_type || trip.model} />
            </div>

            <button onClick={onSelect} disabled={trip.status_name === 'Full'}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all
        ${trip.status_name === 'Full'
                        ? 'bg-sawaari-border/40 text-sawaari-muted cursor-not-allowed'
                        : trip.pink_mode
                            ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white shadow-lg shadow-pink-500/20 hover:shadow-pink-500/40'
                            : 'btn-primary'
                    }`}>
                {trip.status_name === 'Full' ? 'No Seats Available' : `Book Seat${trip.price_per_seat > 0 ? ` — ₹${trip.price_per_seat}/seat` : ''}`}
            </button>
        </div>
    );
}

function InfoCell({ label, value }) {
    return (
        <div className="bg-sawaari-dark/50 rounded-xl p-2 text-center">
            <p className="text-white text-xs font-semibold truncate">{value}</p>
            <p className="text-sawaari-muted text-[10px] mt-0.5">{label}</p>
        </div>
    );
}
