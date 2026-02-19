import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function DriverDashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        api.get('/ts/driver/stats')
            .then(res => setStats(res.data))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    if (loading) return (
        <div className="min-h-screen bg-sawaari-dark flex items-center justify-center">
            <div className="text-sawaari-muted animate-pulse text-lg">Loading dashboard...</div>
        </div>
    );

    return (
        <div className="min-h-screen bg-sawaari-dark">
            <header className="sticky top-0 z-50 bg-sawaari-dark/80 backdrop-blur-xl border-b border-sawaari-border">
                <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center gap-3">
                    <button onClick={() => navigate('/home')} className="text-sawaari-muted hover:text-white transition-colors">←</button>
                    <div>
                        <span className="text-xs text-sawaari-muted block">Sawaari · DriveShare</span>
                        <span className="text-white font-bold text-sm">🚗 Driver Dashboard</span>
                    </div>
                    <span className="text-xs text-primary-400/70 bg-primary-500/10 border border-primary-500/20 px-2 py-0.5 rounded-full">
                        Carpooling
                    </span>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-6 space-y-5 animate-fade-in">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="card bg-gradient-to-br from-emerald-600/20 to-teal-600/10 border-emerald-500/20 text-center">
                        <p className="text-sawaari-muted text-xs mb-1">Total Earnings</p>
                        <p className="text-white text-2xl font-bold">₹{stats?.earnings?.toFixed(2) || '0.00'}</p>
                    </div>
                    <div className="card bg-gradient-to-br from-primary-600/20 to-pink-600/10 border-primary-500/20 text-center">
                        <p className="text-sawaari-muted text-xs mb-1">Active Trips</p>
                        <p className="text-white text-2xl font-bold">{stats?.total_trips || 0}</p>
                    </div>
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-3 gap-3">
                    <button onClick={() => navigate('/driver/create-trip')}
                        className="btn-primary py-3 text-sm">
                        ➕ Create Trip
                    </button>
                    <button onClick={() => navigate('/driver/trips')}
                        className="py-3 text-sm rounded-xl border border-sawaari-border text-white hover:border-primary-500/50 transition-colors">
                        🗺️ My Trips
                    </button>
                    <button onClick={() => navigate('/driver/bookings')}
                        className="py-3 text-sm rounded-xl border border-sawaari-border text-white hover:border-primary-500/50 transition-colors">
                        📋 Bookings
                    </button>
                </div>

                {/* Today's Trips */}
                <section>
                    <h2 className="text-white font-bold mb-3 flex items-center gap-2">
                        <span>📅</span> Today's Trips
                        <span className="badge">{stats?.todays_trips?.length || 0}</span>
                    </h2>
                    {!stats?.todays_trips?.length
                        ? <p className="text-sawaari-muted text-sm card text-center py-6">No trips today</p>
                        : stats.todays_trips.map(t => <TripCard key={t.id} trip={t} onManage={() => navigate('/driver/trips')} />)
                    }
                </section>

                {/* Upcoming Trips */}
                <section>
                    <h2 className="text-white font-bold mb-3 flex items-center gap-2">
                        <span>🔜</span> Upcoming Trips
                        <span className="badge">{stats?.upcoming_trips?.length || 0}</span>
                    </h2>
                    {!stats?.upcoming_trips?.length
                        ? <p className="text-sawaari-muted text-sm card text-center py-6">No upcoming trips</p>
                        : stats.upcoming_trips.map(t => <TripCard key={t.id} trip={t} onManage={() => navigate('/driver/trips')} />)
                    }
                </section>
            </main>
        </div>
    );
}

function TripCard({ trip, onManage }) {
    return (
        <div className={`card mb-3 animate-slide-up border ${trip.pink_mode ? 'border-pink-500/30' : 'border-sawaari-border'}`}>
            {trip.pink_mode ? (
                <div className="flex items-center gap-1 mb-2">
                    <span className="text-xs bg-pink-500/20 text-pink-400 px-2 py-0.5 rounded-full border border-pink-500/20 font-semibold">🩷 Pink Mode</span>
                </div>
            ) : null}
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-white font-semibold">{trip.source} → {trip.destination}</p>
                    <p className="text-sawaari-muted text-xs mt-0.5">{trip.trip_date} at {trip.trip_time}</p>
                </div>
                <span className={`badge text-xs ${trip.status_name === 'Full' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                    {trip.status_name}
                </span>
            </div>
            <div className="mt-3 flex items-center justify-between">
                <p className="text-sawaari-muted text-sm">💺 {trip.available_seats} seats left</p>
                <button onClick={onManage} className="text-primary-400 text-xs hover:text-primary-300 transition-colors">Manage →</button>
            </div>
        </div>
    );
}
