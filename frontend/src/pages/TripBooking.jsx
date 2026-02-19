import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';

export default function TripBooking() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const isFemale = user?.gender === 'Female';
    const [trip, setTrip] = useState(null);
    const [seats, setSeats] = useState(1);
    const [mode, setMode] = useState('UPI');
    const [bookingId, setBookingId] = useState(null);
    const [timeLeft, setTimeLeft] = useState(30);
    const [loading, setLoading] = useState(true);
    const [paying, setPaying] = useState(false);
    const [booking, setBooking] = useState(false);

    // Navigate away when timer hits 0
    const handleExpiry = useCallback(() => {
        alert('⏰ Booking expired — payment window closed. Seats have been released.');
        setBookingId(null);
        navigate('/rider/dashboard');
    }, [navigate]);

    useEffect(() => {
        api.get(`/ts/trips/${id}`)
            .then(r => setTrip(r.data.trip))
            .catch(() => navigate('/rider/dashboard'))
            .finally(() => setLoading(false));
    }, [id, navigate]);

    // Countdown after booking created
    useEffect(() => {
        if (!bookingId || timeLeft <= 0) return;
        const t = setInterval(() => setTimeLeft(s => s - 1), 1000);
        return () => clearInterval(t);
    }, [bookingId, timeLeft]);

    useEffect(() => {
        if (bookingId && timeLeft === 0) handleExpiry();
    }, [timeLeft, bookingId, handleExpiry]);

    async function handleBook() {
        setBooking(true);
        try {
            const res = await api.post('/ts/bookings', { trip_id: id, seats });
            setBookingId(res.data.booking_id);
            setTimeLeft(30);
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to book');
        } finally {
            setBooking(false);
        }
    }

    async function handlePay() {
        setPaying(true);
        try {
            await api.post('/ts/payments', {
                booking_id: bookingId,
                amount: seats * trip.price_per_seat,
                mode,
            });
            alert('✅ Payment successful! Booking confirmed.');
            navigate('/rider/bookings');
        } catch (err) {
            alert(err.response?.data?.error || 'Payment failed');
        } finally {
            setPaying(false);
        }
    }

    if (loading) return (
        <div className="min-h-screen bg-sawaari-dark flex items-center justify-center">
            <div className="text-sawaari-muted animate-pulse">Loading trip...</div>
        </div>
    );

    if (!trip) return null;

    const total = seats * trip.price_per_seat;
    const timerPct = (timeLeft / 30) * 100;

    return (
        <div className="min-h-screen bg-sawaari-dark">
            <header className="sticky top-0 z-50 bg-sawaari-dark/80 backdrop-blur-xl border-b border-sawaari-border">
                <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center gap-3">
                    <button onClick={() => navigate('/rider/dashboard')} className="text-sawaari-muted hover:text-white transition-colors">←</button>
                    <div>
                        <span className="text-xs text-sawaari-muted block">Sawaari · DriveShare</span>
                        <span className="text-white font-bold text-sm">🎫 Book Trip</span>
                    </div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-6 space-y-4 animate-fade-in">
                {/* Trip summary card */}
                <div className={`card border ${trip.pink_mode ? 'border-pink-500/30' : 'border-sawaari-border'}`}>
                    {trip.pink_mode && <p className="text-xs text-pink-400 bg-pink-500/10 border border-pink-500/20 rounded-full px-3 py-1 inline-block mb-3">🩷 Pink Mode — Female priority trip</p>}
                    <h2 className="text-white text-xl font-bold">{trip.source} → {trip.destination}</h2>
                    <p className="text-sawaari-muted text-sm mt-1">{trip.trip_date} · {trip.trip_time}</p>
                    <div className="grid grid-cols-3 gap-3 mt-4">
                        <div className="bg-sawaari-dark/50 rounded-xl p-3 text-center">
                            <p className="text-white font-bold">{trip.driver_name}</p>
                            <p className="text-sawaari-muted text-xs mt-0.5">Driver</p>
                        </div>
                        <div className="bg-sawaari-dark/50 rounded-xl p-3 text-center">
                            <p className="text-white font-bold">{trip.available_seats}</p>
                            <p className="text-sawaari-muted text-xs mt-0.5">Seats Left</p>
                        </div>
                        <div className="bg-sawaari-dark/50 rounded-xl p-3 text-center">
                            <p className="text-white font-bold">₹{trip.price_per_seat}</p>
                            <p className="text-sawaari-muted text-xs mt-0.5">Per Seat</p>
                        </div>
                    </div>
                </div>

                {/* Booking form */}
                {!bookingId ? (
                    <div className="card space-y-4">
                        <h3 className="text-white font-semibold">Select Seats</h3>
                        <div className="flex items-center gap-4">
                            <button onClick={() => setSeats(s => Math.max(1, s - 1))}
                                className="w-10 h-10 rounded-xl border border-sawaari-border text-white text-xl hover:border-primary-500/50 transition-colors">
                                −
                            </button>
                            <span className="text-white text-2xl font-bold flex-1 text-center">{seats}</span>
                            <button onClick={() => setSeats(s => Math.min(trip.available_seats, s + 1))}
                                className="w-10 h-10 rounded-xl border border-sawaari-border text-white text-xl hover:border-primary-500/50 transition-colors">
                                +
                            </button>
                        </div>

                        {trip.price_per_seat > 0 && (
                            <div className="flex items-center justify-between bg-sawaari-dark/50 rounded-xl p-4">
                                <span className="text-sawaari-muted text-sm">{seats} seat{seats > 1 ? 's' : ''} × ₹{trip.price_per_seat}</span>
                                <span className="text-white font-bold text-lg">₹{total}</span>
                            </div>
                        )}

                        {/* Pink mode block for non-female */}
                        {trip.pink_mode && !isFemale && (
                            <div className="bg-pink-500/10 border border-pink-500/30 rounded-xl px-4 py-3 text-center">
                                <p className="text-pink-400 text-sm font-semibold">🩷 This is a Pink Mode trip</p>
                                <p className="text-pink-300/60 text-xs mt-1">Only female riders can book this trip for safety.</p>
                            </div>
                        )}

                        <button onClick={handleBook} disabled={booking || (trip.pink_mode && !isFemale)}
                            className={`w-full py-4 text-base rounded-xl font-semibold transition-all
                                ${trip.pink_mode && !isFemale
                                    ? 'bg-sawaari-border/40 text-sawaari-muted cursor-not-allowed'
                                    : trip.pink_mode
                                        ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white shadow-lg shadow-pink-500/20 hover:shadow-pink-500/40'
                                        : 'btn-primary'}`}>
                            {booking
                                ? 'Creating booking...'
                                : trip.pink_mode && !isFemale
                                    ? '🔒 Pink Mode — Female Only'
                                    : `Reserve ${seats} Seat${seats > 1 ? 's' : ''}`}
                        </button>
                        <p className="text-sawaari-muted text-xs text-center">⚡ Payment must be completed within 30 seconds of booking</p>
                    </div>
                ) : (
                    /* Payment section */
                    <div className="card space-y-5">
                        {/* Countdown timer */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-white font-semibold">⏳ Complete Payment</span>
                                <span className={`text-lg font-bold tabular-nums ${timeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-amber-400'}`}>
                                    {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
                                </span>
                            </div>
                            <div className="w-full h-2 bg-sawaari-border rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-1000 ${timeLeft <= 10 ? 'bg-red-500' : 'bg-amber-500'}`}
                                    style={{ width: `${timerPct}%` }}
                                />
                            </div>
                        </div>

                        <div className="bg-sawaari-dark/50 rounded-xl p-4">
                            <div className="flex justify-between text-sm text-sawaari-muted mb-1">
                                <span>Seats booked</span><span className="text-white">{seats}</span>
                            </div>
                            {trip.price_per_seat > 0 && (
                                <>
                                    <div className="flex justify-between text-sm text-sawaari-muted mb-1">
                                        <span>Price per seat</span><span className="text-white">₹{trip.price_per_seat}</span>
                                    </div>
                                    <div className="border-t border-sawaari-border mt-2 pt-2 flex justify-between font-bold">
                                        <span className="text-white">Total</span><span className="text-primary-400 text-lg">₹{total}</span>
                                    </div>
                                </>
                            )}
                            {trip.price_per_seat === 0 && <p className="text-emerald-400 font-semibold text-sm">🎉 This trip is FREE — just confirm!</p>}
                        </div>

                        {/* Payment mode */}
                        {trip.price_per_seat > 0 && (
                            <div>
                                <label className="label">Payment Method</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['UPI', 'Card', 'Cash'].map(m => (
                                        <button key={m} type="button" onClick={() => setMode(m)}
                                            className={`py-3 rounded-xl border font-medium text-sm transition-all
                            ${mode === m ? 'bg-gradient-to-r from-primary-500 to-primary-600 border-transparent text-white' : 'border-sawaari-border text-sawaari-muted hover:text-white'}`}>
                                            {m === 'UPI' ? '📱' : m === 'Card' ? '💳' : '💵'} {m}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button onClick={handlePay} disabled={paying || timeLeft <= 0}
                            className="btn-primary w-full py-4 text-base">
                            {paying ? 'Processing...' : trip.price_per_seat > 0 ? `Pay ₹${total} Now` : 'Confirm Booking'}
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}
