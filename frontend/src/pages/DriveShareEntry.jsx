import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';

export default function DriveShareEntry() {
    const { user, login } = useAuth();
    const navigate = useNavigate();

    const [step, setStep] = useState('choose'); // 'choose' | 'driver-details'
    const [licenseNo, setLicenseNo] = useState('');
    const [issueDate, setIssueDate] = useState('');
    const [expiryDate, setExpiryDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // NO auto-redirect useEffect — role selection ALWAYS shows on every visit

    async function handleSelectRole(role) {
        setError('');
        // FIX 1: If user is already a driver, go directly to dashboard (skip license form)
        if (role === 'driver' && user?.role === 'driver') {
            navigate('/driver/dashboard', { replace: true });
            return;
        }

        if (role === 'rider') {
            // If user already has a role, navigate directly (no API call needed)
            if (user?.role === 'rider') {
                navigate('/rider/dashboard', { replace: true });
                return;
            }
            if (user?.role === 'driver') {
                // Driver who wants to find a ride as passenger — allow direct access
                navigate('/rider/search', { replace: true });
                return;
            }
            // New user — set rider role via API
            setLoading(true);
            try {
                const res = await api.post('/auth/set-driveshare-role', { role: 'rider' });
                login(res.data.token, res.data.user);
                navigate('/rider/dashboard', { replace: true });
            } catch (err) {
                setError(err.response?.data?.error || 'Failed to set role');
            } finally {
                setLoading(false);
            }
        } else {
            // Driver path — show license form for new drivers
            // Already-registered drivers are handled above (direct navigate)
            setStep('driver-details');
        }
    }

    async function handleDriverSubmit(e) {
        e.preventDefault();
        setError('');
        if (!licenseNo.trim()) return setError('License number is required');

        setLoading(true);
        try {
            const res = await api.post('/auth/set-driveshare-role', {
                role: 'driver',
                licenseNo: licenseNo.trim(),
                issueDate: issueDate || undefined,
                expiryDate: expiryDate || undefined,
            });
            // Backend returns success + token whether new or already-registered
            login(res.data.token, res.data.user);
            navigate('/driver/dashboard', { replace: true });
        } catch (err) {
            // Last-resort: if our user context says driver, navigate anyway
            if (user?.role === 'driver') {
                navigate('/driver/dashboard', { replace: true });
            } else {
                setError(err.response?.data?.error || 'Failed to register as driver');
            }
        } finally {
            setLoading(false);
        }
    }

    // Always show the role choice screen — no early return

    return (
        <div className="min-h-screen bg-sawaari-dark flex items-center justify-center p-4">
            <div className="w-full max-w-md animate-slide-up">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-pink-500/30">
                        <span className="text-3xl">🚗</span>
                    </div>
                    <h1 className="text-2xl font-extrabold text-white">
                        Sawaari · <span className="text-pink-400">DriveShare</span>
                    </h1>
                    <p className="text-sawaari-muted text-sm mt-1">How would you like to ride?</p>
                </div>

                {/* ── STEP 1: ROLE SELECTION ──────────────────────────── */}
                {step === 'choose' && (
                    <div className="space-y-4">
                        {/* Driver Card */}
                        <button
                            onClick={() => handleSelectRole('driver')}
                            disabled={loading}
                            className={`w-full card p-6 text-left group transition-all active:scale-[0.98] hover:border-blue-500/50`}
                        >
                            <div className="flex items-start gap-4">
                                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform shadow-lg shadow-blue-500/20">
                                    <span className="text-2xl">🚗</span>
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-white font-bold text-lg">I'm a Driver</h3>
                                    <p className="text-sawaari-muted text-sm mt-1 leading-relaxed">
                                        Offer rides and earn money. Create trips with your vehicle, set prices, and manage bookings.
                                    </p>
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-1 rounded-lg border border-blue-500/20">Create trips</span>
                                        <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-1 rounded-lg border border-blue-500/20">Set price</span>
                                        <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-1 rounded-lg border border-blue-500/20">Earn money</span>
                                    </div>
                                </div>
                                <span className="text-sawaari-muted group-hover:text-primary-400 transition-colors text-xl">→</span>
                            </div>
                        </button>

                        {/* Rider Card */}
                        <button
                            onClick={() => handleSelectRole('rider')}
                            disabled={loading}
                            className={`w-full card p-6 text-left group transition-all active:scale-[0.98] hover:border-emerald-500/50`}
                        >
                            <div className="flex items-start gap-4">
                                <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform shadow-lg shadow-emerald-500/20">
                                    <span className="text-2xl">🎫</span>
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-white font-bold text-lg">I'm a Rider</h3>
                                    <p className="text-sawaari-muted text-sm mt-1 leading-relaxed">
                                        Find affordable rides near you. Search by route and timing, book seats, and pay securely.
                                    </p>
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-lg border border-emerald-500/20">Search trips</span>
                                        <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-lg border border-emerald-500/20">Book seats</span>
                                        <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-lg border border-emerald-500/20">Safe rides</span>
                                    </div>
                                </div>
                                <span className="text-sawaari-muted group-hover:text-primary-400 transition-colors text-xl">→</span>
                            </div>
                        </button>

                        {loading && (
                            <div className="text-center py-4">
                                <div className="inline-block w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                                <p className="text-sawaari-muted text-sm mt-2">Setting up your account...</p>
                            </div>
                        )}

                        {error && (
                            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-center">{error}</p>
                        )}

                        <button onClick={() => navigate('/home')} className="w-full text-sm text-sawaari-muted hover:text-white transition-colors py-2">← Back to Home</button>
                    </div>
                )}

                {/* ── STEP 2: DRIVER LICENSE DETAILS ──────────────────── */}
                {step === 'driver-details' && (
                    <div className="card">
                        <form onSubmit={handleDriverSubmit} className="space-y-4">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <span className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center text-lg">🪪</span>
                                    Driver Registration
                                </h2>
                                <p className="text-sawaari-muted text-sm mt-1">We need your driving license to get you started</p>
                            </div>

                            <div>
                                <label className="label">License Number *</label>
                                <input
                                    type="text"
                                    value={licenseNo}
                                    onChange={e => setLicenseNo(e.target.value)}
                                    placeholder="DL-0120110012345"
                                    className="input-field"
                                    autoFocus
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="label">Issue Date</label>
                                    <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className="input-field" />
                                </div>
                                <div>
                                    <label className="label">Expiry Date</label>
                                    <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="input-field" />
                                </div>
                            </div>

                            {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}

                            <button type="submit" disabled={loading} className="btn-primary w-full">
                                {loading ? 'Registering...' : 'Register as Driver 🚗'}
                            </button>

                            <button
                                type="button"
                                onClick={() => { setStep('choose'); setError(''); }}
                                className="w-full text-sm text-sawaari-muted hover:text-white transition-colors"
                            >← Choose a different role</button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
