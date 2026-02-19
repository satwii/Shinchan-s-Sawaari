import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function DriverTrips() {
    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const fetchTrips = () => {
        setLoading(true);
        api.get('/ts/driver/trips')
            .then(r => setTrips(r.data.trips || []))
            .catch(() => { })
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchTrips(); }, []);

    async function cancelTrip(id) {
        if (!window.confirm('Cancel this trip? All bookings will be refunded.')) return;
        try {
            await api.put(`/ts/driver/trips/${id}/cancel`);
            fetchTrips();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to cancel trip');
        }
    }

    return (
        <div className="min-h-screen bg-sawaari-dark">
            <header className="sticky top-0 z-50 bg-sawaari-dark/80 backdrop-blur-xl border-b border-sawaari-border">
                <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/home')} className="text-sawaari-muted hover:text-white transition-colors">←</button>
                        <div>
                            <span className="text-xs text-sawaari-muted block">Sawaari · DriveShare</span>
                            <span className="text-white font-bold text-sm">🗺️ My Trips</span>
                        </div>
                    </div>
                    <button onClick={() => navigate('/driver/create-trip')} className="btn-primary text-xs py-2 px-4">➕ New</button>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-6 space-y-4 animate-fade-in">
                {loading && <div className="text-sawaari-muted text-center animate-pulse py-10">Loading trips...</div>}

                {!loading && trips.length === 0 && (
                    <div className="card text-center py-12">
                        <div className="text-5xl mb-4">🚗</div>
                        <p className="text-white font-semibold">No trips yet</p>
                        <p className="text-sawaari-muted text-sm mt-1">Create your first trip to start accepting bookings</p>
                        <button onClick={() => navigate('/driver/create-trip')} className="btn-primary mt-4 px-8">Create Trip</button>
                    </div>
                )}

                {trips.map(trip => (
                    <div key={trip.id} className={`card animate-slide-up border ${trip.pink_mode ? 'border-pink-500/30' : 'border-sawaari-border'}`}>
                        {trip.pink_mode ? (
                            <div className="flex items-center gap-1 mb-2">
                                <span className="text-xs bg-pink-500/20 text-pink-400 px-2 py-0.5 rounded-full border border-pink-500/20 font-semibold">🩷 Pink Mode</span>
                            </div>
                        ) : null}
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <p className="text-white font-bold">{trip.source} → {trip.destination}</p>
                                <p className="text-sawaari-muted text-xs mt-0.5">{trip.trip_date} · {trip.trip_time}</p>
                            </div>
                            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border
                ${trip.status_name === 'Open' ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' :
                                    trip.status_name === 'Full' ? 'text-red-400 border-red-500/30 bg-red-500/10' :
                                        trip.status_name === 'Completed' ? 'text-blue-400 border-blue-500/30 bg-blue-500/10' :
                                            'text-sawaari-muted border-sawaari-border'}`}>
                                {trip.status_name}
                            </span>
                        </div>

                        <div className="grid grid-cols-3 gap-3 mb-3">
                            <div className="text-center bg-sawaari-dark/50 rounded-xl p-2">
                                <p className="text-white font-semibold">{trip.available_seats}</p>
                                <p className="text-sawaari-muted text-[10px] mt-0.5">Seats Left</p>
                            </div>
                            <div className="text-center bg-sawaari-dark/50 rounded-xl p-2">
                                <p className="text-white font-semibold">₹{trip.price_per_seat}</p>
                                <p className="text-sawaari-muted text-[10px] mt-0.5">Per Seat</p>
                            </div>
                            <div className="text-center bg-sawaari-dark/50 rounded-xl p-2">
                                <p className="text-white font-semibold">{trip.vehicle_type}</p>
                                <p className="text-sawaari-muted text-[10px] mt-0.5">{trip.model}</p>
                            </div>
                        </div>

                        {trip.status_name !== 'Cancelled' && trip.status_name !== 'Completed' && (
                            <button onClick={() => cancelTrip(trip.id)}
                                className="w-full py-2.5 rounded-xl border border-red-500/30 text-red-400 text-sm hover:bg-red-500/10 transition-colors">
                                Cancel Trip
                            </button>
                        )}
                    </div>
                ))}
            </main>
        </div>
    );
}
