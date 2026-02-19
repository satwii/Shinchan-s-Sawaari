import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import RideCard from '../components/RideCard';
import RegisterRideModal from '../components/RegisterRideModal';
import LocationAutocomplete from '../components/LocationAutocomplete';

export default function FairSharePage() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [source, setSource] = useState('');
    const [destination, setDestination] = useState('');
    const [sourceLat, setSourceLat] = useState(null);
    const [sourceLng, setSourceLng] = useState(null);
    const [destinationLat, setDestinationLat] = useState(null);
    const [destinationLng, setDestinationLng] = useState(null);
    const [date, setDate] = useState('');
    const [pinkMode, setPinkMode] = useState(false);
    const [rides, setRides] = useState([]);
    const [myRides, setMyRides] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchDone, setSearchDone] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [activeTab, setActiveTab] = useState('search'); // 'search' | 'myrides'
    const [msg, setMsg] = useState('');

    const isFemale = user?.gender === 'Female';

    const fetchMyRides = useCallback(async () => {
        try {
            const res = await api.get('/rides/my');
            setMyRides(res.data.rides || []);
        } catch { /* silent */ }
    }, []);

    useEffect(() => { fetchMyRides(); }, [fetchMyRides]);

    async function handleSearch(e) {
        e.preventDefault();
        if (!source.trim() || !destination.trim()) {
            setMsg('Please enter both source and destination');
            return;
        }
        setLoading(true);
        setMsg('');
        try {
            const res = await api.post('/rides/search', {
                source: source.trim(),
                destination: destination.trim(),
                date: date || undefined,
                pinkMode: pinkMode || undefined,
                sourceLat, sourceLng,
                destinationLat, destinationLng,
            });
            setRides(res.data.rides || []);
            setSearchDone(true);
        } catch (err) {
            setMsg(err.response?.data?.error || 'Search failed');
        } finally {
            setLoading(false);
        }
    }

    async function handleRequestJoin(rideId) {
        try {
            const res = await api.post(`/rides/${rideId}/request`);
            setMsg(res.data.message || 'Request sent!');
            // Refresh search results
            if (searchDone) {
                const res2 = await api.post('/rides/search', {
                    source: source.trim(), destination: destination.trim(),
                    date: date || undefined, pinkMode: pinkMode || undefined,
                    sourceLat, sourceLng, destinationLat, destinationLng,
                });
                setRides(res2.data.rides || []);
            }
            fetchMyRides();
        } catch (err) {
            setMsg(err.response?.data?.error || 'Failed to send request');
        }
    }

    function handleRegistered(ride) {
        setMsg('Ride registered! 🚗');
        fetchMyRides();
    }

    const today = new Date().toISOString().split('T')[0];

    return (
        <div className="min-h-screen bg-sawaari-dark">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-sawaari-dark/80 backdrop-blur-xl border-b border-sawaari-border">
                <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/home')} className="text-sawaari-muted hover:text-white transition-colors">←</button>
                        <div>
                            <h1 className="text-lg font-bold text-white">FairShare</h1>
                            <p className="text-sawaari-muted text-xs">Share rides, split costs</p>
                        </div>
                    </div>
                    <button onClick={() => setShowModal(true)}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white text-sm font-semibold shadow-lg shadow-primary-500/20 hover:from-primary-600 hover:to-primary-700 active:scale-95 transition-all">
                        + New Ride
                    </button>
                </div>

                {/* Tabs */}
                <div className="max-w-2xl mx-auto px-4 pb-2">
                    <div className="flex gap-1 bg-sawaari-card rounded-xl p-1">
                        {[
                            { key: 'search', label: '🔍 Search', count: null },
                            { key: 'myrides', label: '🚗 My Rides', count: myRides.length },
                        ].map(tab => (
                            <button key={tab.key}
                                onClick={() => {
                                    setActiveTab(tab.key);
                                    if (tab.key === 'myrides') fetchMyRides();
                                }}
                                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all
                                    ${activeTab === tab.key
                                        ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md shadow-primary-500/20'
                                        : 'text-sawaari-muted hover:text-white'}`}>
                                {tab.label} {tab.count ? `(${tab.count})` : ''}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-5 pb-20">
                {/* Messages */}
                {msg && (
                    <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium animate-fade-in ${msg.toLowerCase().includes('fail') || msg.toLowerCase().includes('error')
                        ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                        : 'bg-green-500/10 border border-green-500/30 text-green-400'}`}>
                        {msg}
                    </div>
                )}

                {/* Search Tab */}
                {activeTab === 'search' && (
                    <>
                        <form onSubmit={handleSearch} className="card mb-5">
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                                        <div className="w-0.5 h-8 bg-gradient-to-b from-emerald-400/50 to-primary-500/50 rounded-full" />
                                        <div className="w-2.5 h-2.5 rounded-full bg-primary-500" />
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <LocationAutocomplete
                                            value={source}
                                            onChange={(v) => { setSource(v); setSourceLat(null); setSourceLng(null); }}
                                            onSelect={({ name, lat, lon }) => { setSource(name); setSourceLat(lat); setSourceLng(lon); }}
                                            placeholder="From where?"
                                        />
                                        <LocationAutocomplete
                                            value={destination}
                                            onChange={(v) => { setDestination(v); setDestinationLat(null); setDestinationLng(null); }}
                                            onSelect={({ name, lat, lon }) => { setDestination(name); setDestinationLat(lat); setDestinationLng(lon); }}
                                            placeholder="Where to?"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <input type="date" value={date} onChange={e => setDate(e.target.value)}
                                        min={today} className="input-field flex-1" placeholder="Date (optional)" />

                                    {isFemale && (
                                        <button type="button" onClick={() => setPinkMode(!pinkMode)}
                                            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap
                                                ${pinkMode
                                                    ? 'bg-gradient-to-r from-pink-500 to-primary-500 text-white shadow-md shadow-pink-500/20'
                                                    : 'bg-sawaari-dark border border-sawaari-border text-sawaari-muted'}`}>
                                            🩷 Pink
                                        </button>
                                    )}
                                </div>
                            </div>

                            <button type="submit" disabled={loading} className="btn-primary w-full mt-4">
                                {loading ? 'Searching...' : '🔍 Search Rides'}
                            </button>
                        </form>

                        {/* Results */}
                        {searchDone && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-white font-bold text-sm">
                                        {rides.length} ride{rides.length !== 1 ? 's' : ''} found
                                    </h2>
                                    {rides.length > 0 && (
                                        <span className="text-sawaari-muted text-xs">
                                            {source} → {destination}
                                        </span>
                                    )}
                                </div>

                                {rides.length === 0 ? (
                                    <div className="card text-center py-10">
                                        <div className="text-5xl mb-3">🔍</div>
                                        <p className="text-white font-medium mb-1">No rides found</p>
                                        <p className="text-sawaari-muted text-sm mb-4">Try a different route or date</p>
                                        <button onClick={() => setShowModal(true)}
                                            className="btn-primary inline-flex items-center gap-2">
                                            + Register Your Own
                                        </button>
                                    </div>
                                ) : (
                                    rides.map(ride => (
                                        <RideCard
                                            key={ride.id}
                                            ride={ride}
                                            currentUser={user}
                                            onRequestJoin={handleRequestJoin}
                                        />
                                    ))
                                )}
                            </div>
                        )}

                        {!searchDone && (
                            <div className="text-center py-10">
                                <div className="text-5xl mb-3">🚗</div>
                                <p className="text-white font-medium mb-1">Find your ride</p>
                                <p className="text-sawaari-muted text-sm">Search for rides on your route or register a new one</p>
                            </div>
                        )}
                    </>
                )}

                {/* My Rides Tab */}
                {activeTab === 'myrides' && (
                    <div className="space-y-4">
                        {myRides.length === 0 ? (
                            <div className="card text-center py-10">
                                <div className="text-5xl mb-3">🚗</div>
                                <p className="text-white font-medium mb-1">No rides yet</p>
                                <p className="text-sawaari-muted text-sm mb-4">Register or join a ride to get started</p>
                                <button onClick={() => setShowModal(true)} className="btn-primary inline-flex items-center gap-2">
                                    + Register Your First Ride
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Active Rides */}
                                {myRides.filter(r => r.trip_started && !r.trip_completed).length > 0 && (
                                    <div>
                                        <h3 className="text-emerald-400 text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> Active
                                        </h3>
                                        {myRides.filter(r => r.trip_started && !r.trip_completed).map(ride => (
                                            <MyRideCard key={ride.id} ride={ride} />
                                        ))}
                                    </div>
                                )}

                                {/* Upcoming Rides */}
                                {myRides.filter(r => !r.trip_started && !r.trip_completed).length > 0 && (
                                    <div>
                                        <h3 className="text-sawaari-muted text-xs font-semibold uppercase tracking-wide mb-2">Upcoming</h3>
                                        {myRides.filter(r => !r.trip_started && !r.trip_completed).map(ride => (
                                            <MyRideCard key={ride.id} ride={ride} />
                                        ))}
                                    </div>
                                )}

                                {/* Completed Rides */}
                                {myRides.filter(r => r.trip_completed).length > 0 && (
                                    <div>
                                        <h3 className="text-sawaari-muted text-xs font-semibold uppercase tracking-wide mb-2">Completed</h3>
                                        {myRides.filter(r => r.trip_completed).map(ride => (
                                            <MyRideCard key={ride.id} ride={ride} />
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </main>

            <RegisterRideModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                onRegistered={handleRegistered}
            />
        </div>
    );
}

function MyRideCard({ ride }) {
    const navigate = useNavigate();
    const isActive = ride.trip_started && !ride.trip_completed;
    const isCompleted = ride.trip_completed;

    return (
        <div
            onClick={() => navigate(`/ride/${ride.id}`)}
            className={`card mb-3 cursor-pointer transition-all hover:border-primary-500/30 hover:shadow-lg group
                ${isActive ? 'border-emerald-500/20' : isCompleted ? 'opacity-70' : ''}`}
        >
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className="text-lg">
                        {ride.vehicle_type === 'Auto' ? '🛺' : ride.vehicle_type === 'Cab' ? '🚖' : ride.vehicle_type === 'Mini Bus' ? '🚌' : '🚗'}
                    </span>
                    <div>
                        <div className="text-white font-semibold text-sm">{ride.source} → {ride.destination}</div>
                        <div className="text-sawaari-muted text-xs">{ride.date} · {ride.ride_time || ride.time_slot}</div>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isActive ? 'bg-emerald-500/10 text-emerald-400' :
                        isCompleted ? 'bg-gray-500/10 text-gray-400' :
                            'bg-primary-500/10 text-primary-400'}`}>
                        {isActive ? '🟢 Live' : isCompleted ? 'Done' : 'Scheduled'}
                    </span>
                    {ride.is_owner === 1 && (
                        <span className="text-[10px] text-amber-400 font-medium">Owner</span>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-sawaari-muted">
                <span>👥 {ride.member_count || 1} members</span>
                <span>🪑 {ride.seats_available} seats</span>
                {ride.pending_requests > 0 && ride.is_owner === 1 && (
                    <span className="text-amber-400 font-semibold animate-pulse">
                        🔔 {ride.pending_requests} request{ride.pending_requests > 1 ? 's' : ''}
                    </span>
                )}
                {ride.vehicle_reg && <span>🚙 {ride.vehicle_reg}</span>}
            </div>
        </div>
    );
}
