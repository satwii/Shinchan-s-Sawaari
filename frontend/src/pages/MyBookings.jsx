import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function MyBookings() {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // FIX 4: Cancellation summary modal state
    const [cancelSummary, setCancelSummary] = useState(null); // { fee_amount, fee_percent, refund_amount, message }
    const [pendingCancelId, setPendingCancelId] = useState(null);
    const [cancelling, setCancelling] = useState(false);

    const fetchBookings = () => {
        setLoading(true);
        api.get('/ts/rider/bookings')
            .then(r => setBookings(r.data.bookings || []))
            .catch(() => { })
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchBookings(); }, []);

    async function handleCancelClick(id) {
        setPendingCancelId(id);
        setCancelSummary('confirm'); // Show confirm prompt first
    }

    async function handleCancelConfirm() {
        if (!pendingCancelId) return;
        setCancelling(true);
        try {
            const res = await api.put(`/ts/rider/bookings/${pendingCancelId}/cancel`);
            // Show the fee summary BEFORE refreshing bookings
            setCancelSummary(res.data);
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to cancel');
            setCancelSummary(null);
            setPendingCancelId(null);
        } finally {
            setCancelling(false);
        }
    }

    function handleSummaryOk() {
        setCancelSummary(null);
        setPendingCancelId(null);
        fetchBookings(); // Only refresh AFTER user clicks OK
    }

    const statusColor = s =>
        s === 'confirmed' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' :
            s === 'pending' ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' :
                'text-sawaari-muted bg-sawaari-border/20 border-sawaari-border';

    function fmt(n) {
        return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }

    return (
        <div className="min-h-screen bg-sawaari-dark">
            <header className="sticky top-0 z-50 bg-sawaari-dark/80 backdrop-blur-xl border-b border-sawaari-border">
                <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center gap-3">
                    <button onClick={() => navigate('/home')} className="text-sawaari-muted hover:text-white transition-colors">←</button>
                    <div>
                        <span className="text-xs text-sawaari-muted block">Sawaari · DriveShare</span>
                        <span className="text-white font-bold text-sm">🎫 My Bookings</span>
                    </div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-6 space-y-4 animate-fade-in">
                {loading && <div className="text-sawaari-muted text-center animate-pulse py-10">Loading bookings...</div>}

                {!loading && bookings.length === 0 && (
                    <div className="card text-center py-12">
                        <div className="text-5xl mb-4">🎫</div>
                        <p className="text-white font-semibold">No bookings yet</p>
                        <p className="text-sawaari-muted text-sm mt-1">Search for trips and book your first seat!</p>
                        <button onClick={() => navigate('/rider/dashboard')} className="btn-primary mt-4 px-8">Find Trips</button>
                    </div>
                )}

                {bookings.map(b => (
                    <div key={b.booking_id} className="card animate-slide-up">
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <p className="text-white font-bold">{b.source} → {b.destination}</p>
                                <p className="text-sawaari-muted text-xs mt-0.5">{b.trip_date} · {b.trip_time}</p>
                            </div>
                            <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold capitalize ${statusColor(b.status)}`}>
                                {b.status}
                            </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mb-3">
                            <div className="bg-sawaari-dark/50 rounded-xl p-2 text-center">
                                <p className="text-white text-sm font-semibold">{b.driver_name}</p>
                                <p className="text-sawaari-muted text-[10px] mt-0.5">Driver</p>
                            </div>
                            <div className="bg-sawaari-dark/50 rounded-xl p-2 text-center">
                                <p className="text-white text-sm font-semibold">{b.seats_booked}</p>
                                <p className="text-sawaari-muted text-[10px] mt-0.5">Seats</p>
                            </div>
                            <div className="bg-sawaari-dark/50 rounded-xl p-2 text-center">
                                {b.payment_status ? (
                                    <>
                                        <p className="text-emerald-400 text-sm font-semibold">₹{b.amount}</p>
                                        <p className="text-sawaari-muted text-[10px] mt-0.5">{b.payment_mode}</p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-amber-400 text-sm font-semibold">Unpaid</p>
                                        <p className="text-sawaari-muted text-[10px] mt-0.5">Payment</p>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Pay now if pending */}
                        {b.status === 'pending' && (
                            <button onClick={() => navigate(`/rider/book/${b.trip_id}`)}
                                className="w-full mb-2 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm hover:bg-amber-500/20 transition-colors">
                                ⚡ Complete Payment
                            </button>
                        )}

                        {(b.status === 'pending' || b.status === 'confirmed') && (
                            <button onClick={() => handleCancelClick(b.booking_id)}
                                className="w-full py-2.5 rounded-xl border border-red-500/30 text-red-400 text-sm hover:bg-red-500/10 transition-colors">
                                Cancel Booking
                            </button>
                        )}
                    </div>
                ))}
            </main>

            {/* FIX 4: Confirm cancel modal */}
            {cancelSummary === 'confirm' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { setCancelSummary(null); setPendingCancelId(null); }} />
                    <div className="relative w-full max-w-sm bg-sawaari-card rounded-2xl border border-red-500/30 shadow-2xl animate-slide-up p-6 space-y-4">
                        <div className="text-center">
                            <div className="text-4xl mb-2">⚠️</div>
                            <h3 className="text-white font-bold text-lg">Cancel this booking?</h3>
                            <p className="text-sawaari-muted text-sm mt-1">
                                A cancellation fee may apply based on time until departure.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => { setCancelSummary(null); setPendingCancelId(null); }}
                                className="flex-1 py-3 rounded-xl border border-sawaari-border text-white text-sm font-semibold hover:bg-sawaari-card transition-all"
                            >
                                Keep Booking
                            </button>
                            <button
                                onClick={handleCancelConfirm}
                                disabled={cancelling}
                                className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-all disabled:opacity-50"
                            >
                                {cancelling ? 'Cancelling...' : 'Yes, Cancel'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* FIX 4: Cancellation result summary modal — shown BEFORE ride card disappears */}
            {cancelSummary && cancelSummary !== 'confirm' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                    <div className="relative w-full max-w-sm bg-sawaari-card rounded-2xl border border-emerald-500/30 shadow-2xl animate-slide-up p-6 space-y-4">
                        <div className="text-center">
                            <div className="text-4xl mb-2">✅</div>
                            <h3 className="text-white font-bold text-lg">Booking Cancelled</h3>
                        </div>
                        <div className="bg-sawaari-dark rounded-xl p-4 space-y-2.5 border border-sawaari-border">
                            {cancelSummary.fee_amount > 0 ? (
                                <>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-sawaari-muted">Cancellation fee ({fmt(cancelSummary.fee_percent)}%)</span>
                                        <span className="text-red-400 font-bold">-₩{fmt(cancelSummary.fee_amount)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-sawaari-muted">Sent to ride owner</span>
                                        <span className="text-orange-400">₩{fmt(cancelSummary.fee_amount)}</span>
                                    </div>
                                    <div className="border-t border-sawaari-border pt-2 mt-2">
                                        <p className="text-xs text-sawaari-muted text-center">{cancelSummary.message}</p>
                                    </div>
                                </>
                            ) : (
                                <p className="text-emerald-400 font-semibold text-sm text-center">
                                    ✅ No cancellation fee charged
                                </p>
                            )}
                        </div>
                        <button
                            onClick={handleSummaryOk}
                            className="btn-primary w-full"
                        >
                            OK
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
