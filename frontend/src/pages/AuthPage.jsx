import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';

const STEPS = {
    PHONE: 0,
    AADHAAR: 1,
    OTP: 2,
    PROFILE: 3,
    EMERGENCY: 4,
};

const STEP_LABELS = ['Phone', 'Aadhaar', 'Verify', 'Profile', 'Emergency'];

function ProgressBar({ currentStep, isLogin }) {
    const steps = isLogin ? ['Phone', 'Aadhaar', 'Verify'] : STEP_LABELS;
    return (
        <div className="flex items-center justify-center gap-1 mb-6">
            {steps.map((label, i) => {
                const isActive = i === currentStep;
                const isDone = i < currentStep;
                return (
                    <div key={label} className="flex items-center gap-1">
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-300
                            ${isActive ? 'bg-gradient-to-r from-primary-500 to-pink-500 text-white shadow-lg shadow-primary-500/30' :
                                isDone ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                    'bg-sawaari-border/40 text-sawaari-muted'}`}>
                            {isDone ? '✓' : (i + 1)}
                            <span className="hidden sm:inline">{label}</span>
                        </div>
                        {i < steps.length - 1 && (
                            <div className={`w-4 h-0.5 rounded-full transition-all duration-300 ${isDone ? 'bg-emerald-500/50' : 'bg-sawaari-border'}`} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function OtpInput({ value, onChange }) {
    const inputs = useRef([]);
    const digits = value.split('');

    function handleChange(i, val) {
        if (!/^\d*$/.test(val)) return;
        const next = digits.slice();
        next[i] = val.slice(-1);
        onChange(next.join(''));
        if (val && i < 5) inputs.current[i + 1]?.focus();
    }

    function handleKeyDown(i, e) {
        if (e.key === 'Backspace' && !digits[i] && i > 0) {
            inputs.current[i - 1]?.focus();
        }
    }

    function handlePaste(e) {
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pasted.length === 6) { onChange(pasted); inputs.current[5]?.focus(); }
        e.preventDefault();
    }

    return (
        <div className="flex gap-2 justify-center my-4" onPaste={handlePaste}>
            {[0, 1, 2, 3, 4, 5].map(i => (
                <input
                    key={i}
                    ref={el => inputs.current[i] = el}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digits[i] || ''}
                    onChange={e => handleChange(i, e.target.value)}
                    onKeyDown={e => handleKeyDown(i, e)}
                    className="w-11 h-12 text-center text-xl font-bold bg-sawaari-border border border-sawaari-border rounded-xl text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all"
                />
            ))}
        </div>
    );
}

export default function AuthPage() {
    const [step, setStep] = useState(STEPS.PHONE);
    const [phone, setPhone] = useState('');
    const [aadhaar, setAadhaar] = useState('');
    const [aadhaarLast4, setAadhaarLast4] = useState('');
    const [otp, setOtp] = useState('');
    const [username, setUsername] = useState('');
    const [gender, setGender] = useState('');
    const [age, setAge] = useState('');
    const [emergencyName, setEmergencyName] = useState('');
    const [emergencyPhone, setEmergencyPhone] = useState('');

    const [isExistingUser, setIsExistingUser] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const navigate = useNavigate();
    const { login } = useAuth();

    // Auto-advance OTP
    useEffect(() => {
        if (step === STEPS.OTP && otp.length === 6) {
            handleVerifyOtp();
        }
        // eslint-disable-next-line
    }, [otp]);

    // Step 1: Check phone
    async function handlePhoneSubmit(e) {
        e.preventDefault();
        setError('');
        const normalized = phone.replace(/\s/g, '');
        if (!normalized || normalized.length < 10) {
            return setError('Please enter a valid 10-digit phone number');
        }
        setLoading(true);
        try {
            const res = await api.post('/auth/check-phone', { phone: `+91${normalized}` });
            setIsExistingUser(res.data.isExistingUser);
            setStep(STEPS.AADHAAR);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to check phone');
        } finally {
            setLoading(false);
        }
    }

    // Step 2: Send Aadhaar OTP
    async function handleAadhaarSubmit(e) {
        e.preventDefault();
        setError('');
        const cleaned = aadhaar.replace(/\s/g, '');
        if (!/^\d{12}$/.test(cleaned)) {
            return setError('Please enter a valid 12-digit Aadhaar number');
        }
        setLoading(true);
        try {
            const res = await api.post('/auth/send-aadhaar-otp', {
                phone: `+91${phone.replace(/\s/g, '')}`,
                aadhaar: cleaned,
            });
            setAadhaarLast4(res.data.aadhaarLast4);
            setStep(STEPS.OTP);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to send OTP');
        } finally {
            setLoading(false);
        }
    }

    // Step 3: Verify OTP
    async function handleVerifyOtp(e) {
        if (e?.preventDefault) e.preventDefault();
        setError('');
        if (otp.length !== 6) return setError('Enter the 6-digit OTP');
        setLoading(true);
        try {
            const res = await api.post('/auth/verify-aadhaar-otp', {
                phone: `+91${phone.replace(/\s/g, '')}`,
                otp,
                aadhaarLast4,
            });

            if (res.data.isLogin) {
                // Returning user — login directly
                login(res.data.token, res.data.user);
                navigate('/home');
            } else {
                // New user — continue to profile
                setStep(STEPS.PROFILE);
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Invalid OTP');
        } finally {
            setLoading(false);
        }
    }

    // Step 4: Profile details
    function handleProfileSubmit(e) {
        e.preventDefault();
        setError('');
        if (!username.trim()) return setError('Username is required');
        if (!gender) return setError('Please select your gender');
        const ageNum = parseInt(age);
        if (!ageNum || ageNum < 15) return setError('You must be at least 15 years old');
        setStep(STEPS.EMERGENCY);
    }

    // Step 5: Emergency contact + final register
    async function handleEmergencySubmit(e) {
        e.preventDefault();
        setError('');
        if (!emergencyName.trim()) return setError('Emergency contact name is required');
        const cleanPhone = emergencyPhone.replace(/\s/g, '');
        if (!cleanPhone || cleanPhone.length < 10) {
            return setError('Valid emergency contact phone number is required');
        }

        setLoading(true);
        try {
            const res = await api.post('/auth/register', {
                phone: `+91${phone.replace(/\s/g, '')}`,
                otp,
                username: username.trim(),
                gender,
                age: parseInt(age),
                emergencyContactName: emergencyName.trim(),
                emergencyContactPhone: `+91${cleanPhone}`,
            });
            login(res.data.token, res.data.user);
            navigate('/home');
        } catch (err) {
            setError(err.response?.data?.error || 'Registration failed');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-sawaari-dark flex items-center justify-center p-4">
            <div className="w-full max-w-sm animate-slide-up">
                {/* Logo */}
                <div className="text-center mb-6">
                    <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-500/30">
                        <span className="text-4xl">🚗</span>
                    </div>
                    <h1 className="text-3xl font-extrabold text-primary-400 tracking-tight">Sawaari</h1>
                    <p className="text-sawaari-muted text-xs tracking-[0.2em] mt-1 uppercase">Hyperlocal Ride Sharing</p>
                </div>

                {/* Progress Bar */}
                <ProgressBar currentStep={step} isLogin={isExistingUser} />

                <div className="card">
                    {/* ── PHONE STEP ─────────────────────────────── */}
                    {step === STEPS.PHONE && (
                        <form onSubmit={handlePhoneSubmit} className="space-y-5">
                            <div>
                                <h2 className="text-xl font-bold text-white">Welcome</h2>
                                <p className="text-sawaari-muted text-sm">Enter your phone number to get started</p>
                            </div>
                            <div>
                                <label className="label">Phone Number</label>
                                <div className="flex items-center gap-2 input-field p-0 overflow-hidden">
                                    <span className="pl-4 text-sawaari-muted text-sm whitespace-nowrap">📱 +91</span>
                                    <input
                                        type="tel"
                                        value={phone}
                                        onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                        placeholder="9876543210"
                                        className="flex-1 bg-transparent px-3 py-3 text-white placeholder-sawaari-muted focus:outline-none"
                                        autoFocus
                                    />
                                </div>
                            </div>
                            {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}
                            <button type="submit" disabled={loading} className="btn-primary w-full">
                                {loading ? 'Checking...' : 'Continue →'}
                            </button>
                            <p className="text-sawaari-muted text-xs text-center">By continuing, you agree to Sawaari's Terms of Use and Privacy Policy.</p>
                        </form>
                    )}

                    {/* ── AADHAAR STEP ───────────────────────────── */}
                    {step === STEPS.AADHAAR && (
                        <form onSubmit={handleAadhaarSubmit} className="space-y-5">
                            <div>
                                <h2 className="text-xl font-bold text-white">
                                    {isExistingUser ? 'Welcome Back!' : 'Verify Identity'}
                                </h2>
                                <p className="text-sawaari-muted text-sm">
                                    Enter your 12-digit Aadhaar number for secure verification
                                </p>
                            </div>
                            <div>
                                <label className="label">Aadhaar Number</label>
                                <div className="flex items-center gap-2 input-field p-0 overflow-hidden">
                                    <span className="pl-4 text-sawaari-muted text-sm whitespace-nowrap">🆔</span>
                                    <input
                                        type="text"
                                        value={aadhaar}
                                        onChange={e => {
                                            const v = e.target.value.replace(/\D/g, '').slice(0, 12);
                                            // Auto-format with spaces
                                            setAadhaar(v);
                                        }}
                                        placeholder="XXXX XXXX XXXX"
                                        className="flex-1 bg-transparent px-3 py-3 text-white placeholder-sawaari-muted focus:outline-none tracking-widest"
                                        autoFocus
                                        maxLength={12}
                                    />
                                </div>
                                <p className="text-sawaari-muted text-xs mt-2">
                                    🔒 Only last 4 digits are stored. Full Aadhaar number is never saved.
                                </p>
                            </div>
                            {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}
                            <button type="submit" disabled={loading || aadhaar.replace(/\s/g, '').length !== 12} className="btn-primary w-full">
                                {loading ? 'Sending OTP...' : 'Send OTP →'}
                            </button>
                            <button type="button" onClick={() => { setStep(STEPS.PHONE); setError(''); }}
                                className="w-full text-sm text-sawaari-muted hover:text-white transition-colors">← Change number</button>
                        </form>
                    )}

                    {/* ── OTP STEP ───────────────────────────────── */}
                    {step === STEPS.OTP && (
                        <form onSubmit={handleVerifyOtp} className="space-y-4">
                            <div>
                                <h2 className="text-xl font-bold text-white">Verify OTP</h2>
                                <p className="text-sawaari-muted text-sm">
                                    Sent to Aadhaar-linked number (XXXX-XXXX-{aadhaarLast4})
                                </p>
                                <div className="mt-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                                    <p className="text-amber-400 text-xs font-medium">💡 Demo OTP: <span className="font-bold">123456</span></p>
                                </div>
                            </div>
                            <OtpInput value={otp} onChange={setOtp} />
                            {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}
                            <button type="submit" disabled={loading || otp.length !== 6} className="btn-primary w-full">
                                {loading ? 'Verifying...' : 'Verify OTP'}
                            </button>
                            <button type="button" onClick={() => { setStep(STEPS.AADHAAR); setOtp(''); setError(''); }}
                                className="w-full text-sm text-sawaari-muted hover:text-white transition-colors">← Change Aadhaar</button>
                        </form>
                    )}

                    {/* ── PROFILE STEP ──────────────────────────── */}
                    {step === STEPS.PROFILE && (
                        <form onSubmit={handleProfileSubmit} className="space-y-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-emerald-400 text-lg">✓</span>
                                    <span className="text-emerald-400 text-xs font-semibold">Aadhaar Verified</span>
                                </div>
                                <h2 className="text-xl font-bold text-white">Create Your Profile</h2>
                                <p className="text-sawaari-muted text-sm">Just a few details to get you on the road</p>
                            </div>

                            <div>
                                <label className="label">Username</label>
                                <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                                    placeholder="Choose a username" className="input-field" autoFocus />
                            </div>

                            <div>
                                <label className="label">Gender</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[['Male', '👨'], ['Female', '👩'], ['Prefer not to say', '🧑']].map(([g, icon]) => (
                                        <button key={g} type="button" onClick={() => setGender(g)}
                                            className={`py-2.5 rounded-xl border text-sm font-medium transition-all
                                                ${gender === g
                                                    ? 'bg-gradient-to-r from-primary-500 to-pink-500 border-transparent text-white'
                                                    : 'bg-sawaari-border/40 border-sawaari-border text-sawaari-muted hover:text-white'}`}>
                                            <span>{icon}</span> <span className="block text-xs mt-0.5">{g === 'Prefer not to say' ? 'Other' : g}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="label">Age</label>
                                <input type="number" value={age} onChange={e => setAge(e.target.value)}
                                    placeholder="19" min="15" max="100" className="input-field" />
                                {age && parseInt(age) < 15 && (
                                    <p className="text-red-400 text-xs mt-1">You must be at least 15 years old</p>
                                )}
                            </div>

                            {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}
                            <button type="submit" disabled={loading} className="btn-primary w-full">
                                Next → Emergency Contact
                            </button>
                        </form>
                    )}

                    {/* ── EMERGENCY CONTACT STEP ────────────────── */}
                    {step === STEPS.EMERGENCY && (
                        <form onSubmit={handleEmergencySubmit} className="space-y-4">
                            <div>
                                <h2 className="text-xl font-bold text-white">Emergency Contact</h2>
                                <p className="text-sawaari-muted text-sm">Required for your safety during rides</p>
                            </div>

                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                                <p className="text-amber-400 text-xs font-medium">
                                    ⚠️ This contact will be alerted via SOS if you trigger an emergency during a ride.
                                    This step is mandatory and cannot be skipped.
                                </p>
                            </div>

                            <div>
                                <label className="label">Contact Name</label>
                                <input type="text" value={emergencyName} onChange={e => setEmergencyName(e.target.value)}
                                    placeholder="e.g. Mom, Dad, Sister" className="input-field" autoFocus />
                            </div>

                            <div>
                                <label className="label">Contact Phone Number</label>
                                <div className="flex items-center gap-2 input-field p-0 overflow-hidden">
                                    <span className="pl-4 text-sawaari-muted text-sm whitespace-nowrap">📱 +91</span>
                                    <input
                                        type="tel"
                                        value={emergencyPhone}
                                        onChange={e => setEmergencyPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                        placeholder="9876543210"
                                        className="flex-1 bg-transparent px-3 py-3 text-white placeholder-sawaari-muted focus:outline-none"
                                    />
                                </div>
                            </div>

                            {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}
                            <button type="submit" disabled={loading} className="btn-primary w-full">
                                {loading ? 'Creating Account...' : 'Create My Account 🚀'}
                            </button>
                            <button type="button" onClick={() => { setStep(STEPS.PROFILE); setError(''); }}
                                className="w-full text-sm text-sawaari-muted hover:text-white transition-colors">← Back to Profile</button>
                        </form>
                    )}
                </div>

                <p className="text-center text-sawaari-muted text-xs mt-6">Sawaari — Safe. Smart. Shared.</p>
            </div>
        </div>
    );
}
