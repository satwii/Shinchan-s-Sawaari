import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function DriverBookings() {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        api.get('/ts/driver/bookings')
            .then(r => setBookings(r.data.bookings || []))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const statusColor = s =>
        s === 'confirmed' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' :
            s === 'pending' ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' :
                'text-sawaari-muted bg-sawaari-border/20 border-sawaari-border';

    return (
        <div className="min-h-screen bg-sawaari-dark">
            <header className="sticky top-0 z-50 bg-sawaari-dark/80 backdrop-blur-xl border-b border-sawaari-border">
                <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center gap-3">
                    <button onClick={() => navigate('/home')} className="text-sawaari-muted hover:text-white transition-colors">←</button>
                    <div>
                        <span className="text-xs text-sawaari-muted block">Sawaari · DriveShare</span>
                        <span className="text-white font-bold text-sm">🎫 Booking Requests</span>
                    </div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-6 space-y-4 animate-fade-in">
                {loading && <div className="text-sawaari-muted text-center animate-pulse py-10">Loading...</div>}

                {!loading && bookings.length === 0 && (
                    <div className="card text-center py-12">
                        <div className="text-5xl mb-4">🎫</div>
                        <p className="text-white font-semibold">No bookings yet</p>
                        <p className="text-sawaari-muted text-sm mt-1">Bookings from riders will appear here</p>
                    </div>
                )}

                {bookings.map(b => (
                    <div key={b.booking_id} className="card animate-slide-up">
                        <div className="flex items-start justify-between mb-2">
                            <div>
                                <p className="text-white font-bold">{b.source} → {b.destination}</p>
                                <p className="text-sawaari-muted text-xs">{b.trip_date} · {b.trip_time}</p>
                            </div>
                            <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold capitalize ${statusColor(b.status)}`}>
                                {b.status}
                            </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-3">
                            <InfoCell label="Rider" value={b.rider_name} />
                            <InfoCell label="Seats" value={b.seats_booked} />
                            <InfoCell label="Booked" value={new Date(b.booking_date).toLocaleDateString()} />
                        </div>
                    </div>
                ))}
            </main>
        </div>
    );
}

function InfoCell({ label, value }) {
    return (
        <div className="bg-sawaari-dark/50 rounded-xl p-2 text-center">
            <p className="text-white text-sm font-semibold truncate">{value}</p>
            <p className="text-sawaari-muted text-[10px] mt-0.5">{label}</p>
        </div>
    );
}
