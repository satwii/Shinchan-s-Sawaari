import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';

const STEPS = { PHONE: 'phone', OTP: 'otp', REGISTER: 'register' };
const OTP_RESEND_DELAY = 30;

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
    const [otp, setOtp] = useState('');
    const [username, setUsername] = useState('');
    const [gender, setGender] = useState('');
    const [age, setAge] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [resendTimer, setResendTimer] = useState(0);

    const navigate = useNavigate();
    const { login } = useAuth();

    // OTP resend countdown
    useEffect(() => {
        if (resendTimer <= 0) return;
        const t = setTimeout(() => setResendTimer(r => r - 1), 1000);
        return () => clearTimeout(t);
    }, [resendTimer]);

    async function handleSendOtp(e) {
        e.preventDefault();
        setError('');
        const normalized = phone.replace(/\s/g, '');
        if (!normalized || normalized.length < 10) {
            return setError('Please enter a valid 10-digit phone number');
        }
        setLoading(true);
        try {
            await api.post('/auth/send-otp', { phone: `+91${normalized}` });
            setStep(STEPS.OTP);
            setResendTimer(OTP_RESEND_DELAY);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to send OTP. Try again.');
        } finally {
            setLoading(false);
        }
    }

    async function handleVerifyOtp(e) {
        e.preventDefault();
        setError('');
        if (otp.length !== 6) return setError('Enter the 6-digit OTP');
        setLoading(true);
        try {
            const res = await api.post('/auth/verify-otp', { phone: `+91${phone.replace(/\s/g, '')}`, otp });
            if (res.data.needsRegistration) {
                setStep(STEPS.REGISTER);
            } else {
                login(res.data.token, res.data.user);
                navigate('/home');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Invalid OTP');
        } finally {
            setLoading(false);
        }
    }

    async function handleRegister(e) {
        e.preventDefault();
        setError('');
        const ageNum = parseInt(age);
        if (!username.trim()) return setError('Username is required');
        if (!gender) return setError('Please select your gender');
        if (!ageNum || ageNum < 15) return setError('You must be at least 15 years old');

        setLoading(true);
        try {
            const res = await api.post('/auth/register', {
                phone: `+91${phone.replace(/\s/g, '')}`,
                otp,
                username: username.trim(),
                gender,
                age: ageNum,
            });
            login(res.data.token, res.data.user);
            navigate('/home');
        } catch (err) {
            setError(err.response?.data?.error || 'Registration failed. Try again.');
        } finally {
            setLoading(false);
        }
    }

    async function handleResendOtp() {
        if (resendTimer > 0) return;
        setError('');
        setOtp('');
        setLoading(true);
        try {
            await api.post('/auth/send-otp', { phone: `+91${phone.replace(/\s/g, '')}` });
            setResendTimer(OTP_RESEND_DELAY);
        } catch (err) {
            setError('Failed to resend OTP');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-sawaari-dark flex items-center justify-center p-4">
            <div className="w-full max-w-sm animate-slide-up">

                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-500/30">
                        <span className="text-4xl">🚗</span>
                    </div>
                    <h1 className="text-3xl font-extrabold text-primary-400 tracking-tight">Sawaari</h1>
                    <p className="text-sawaari-muted text-xs tracking-[0.2em] mt-1 uppercase">Hyperlocal Ride Sharing</p>
                </div>

                <div className="card">
                    {/* ── PHONE STEP ─────────────────────────────────────── */}
                    {step === STEPS.PHONE && (
                        <form onSubmit={handleSendOtp} className="space-y-5">
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
                                        placeholder="9063612124"
                                        className="flex-1 bg-transparent px-3 py-3 text-white placeholder-sawaari-muted focus:outline-none"
                                        autoFocus
                                    />
                                </div>
                            </div>
                            {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}
                            <button type="submit" disabled={loading} className="btn-primary w-full">
                                {loading ? 'Sending...' : 'Continue →'}
                            </button>
                            <p className="text-sawaari-muted text-xs text-center">By continuing, you agree to Sawaari's Terms of Use and Privacy Policy.</p>
                        </form>
                    )}

                    {/* ── OTP STEP ───────────────────────────────────────── */}
                    {step === STEPS.OTP && (
                        <form onSubmit={handleVerifyOtp} className="space-y-4">
                            <div>
                                <h2 className="text-xl font-bold text-white">Verify OTP</h2>
                                <p className="text-sawaari-muted text-sm">Sent to +91 {phone} — check backend terminal</p>
                            </div>
                            <OtpInput value={otp} onChange={setOtp} />
                            {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}
                            <button type="submit" disabled={loading || otp.length !== 6} className="btn-primary w-full">
                                {loading ? 'Verifying...' : 'Verify OTP'}
                            </button>
                            <div className="text-center">
                                <button type="button" onClick={handleResendOtp} disabled={resendTimer > 0}
                                    className="text-sm text-primary-400 disabled:text-sawaari-muted transition-colors">
                                    {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                                </button>
                            </div>
                            <button type="button" onClick={() => { setStep(STEPS.PHONE); setError(''); }}
                                className="w-full text-sm text-sawaari-muted hover:text-white transition-colors">← Change number</button>
                        </form>
                    )}

                    {/* ── REGISTER STEP ──────────────────────────────────── */}
                    {/* Simplified: Just username, gender, age — NO role selection */}
                    {step === STEPS.REGISTER && (
                        <form onSubmit={handleRegister} className="space-y-4">
                            <div>
                                <h2 className="text-xl font-bold text-white">Create Account</h2>
                                <p className="text-sawaari-muted text-sm">Just a few details to get you on the road</p>
                            </div>

                            <div>
                                <label className="label">Username</label>
                                <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                                    placeholder="satwika" className="input-field" />
                            </div>

                            {/* Gender */}
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
                            </div>

                            {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}

                            <button type="submit" disabled={loading} className="btn-primary w-full">
                                {loading ? 'Creating...' : 'Create My Account 🚀'}
                            </button>
                        </form>
                    )}
                </div>

                <p className="text-center text-sawaari-muted text-xs mt-6">Sawaari — Safe. Smart. Shared.</p>
            </div>
        </div>
    );
}
