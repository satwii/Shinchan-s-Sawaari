import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import LocationAutocomplete from './LocationAutocomplete';

export default function RegisterRideModal({ isOpen, onClose, onRegistered }) {
    const { user } = useAuth();
    const [form, setForm] = useState({
        source: '',
        destination: '',
        sourceLat: null,
        sourceLng: null,
        destinationLat: null,
        destinationLng: null,
        date: '',
        rideTime: '',
        vehicleType: 'Auto',
        seatsAvailable: 3,
        maleCount: 0,
        femaleCount: 0,
        pinkMode: false,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [step, setStep] = useState(1);

    if (!isOpen) return null;

    function handleChange(field, value) {
        setForm(prev => {
            const next = { ...prev, [field]: value };
            // Pink mode logic
            if (field === 'pinkMode' && value === true) {
                next.maleCount = 0;
            }
            return next;
        });
    }

    function handleNext(e) {
        e.preventDefault();
        setError('');
        if (!form.source.trim()) return setError('Enter pickup location');
        if (!form.destination.trim()) return setError('Enter drop location');
        if (!form.date) return setError('Select a date');
        if (!form.rideTime) return setError('Select ride time');
        setStep(2);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await api.post('/rides/register', {
                source: form.source.trim(),
                destination: form.destination.trim(),
                date: form.date,
                rideTime: form.rideTime,
                vehicleType: form.vehicleType,
                seatsAvailable: form.seatsAvailable,
                maleCount: form.pinkMode ? 0 : form.maleCount,
                femaleCount: form.femaleCount,
                pinkMode: form.pinkMode,
                sourceLat: form.sourceLat,
                sourceLng: form.sourceLng,
                destinationLat: form.destinationLat,
                destinationLng: form.destinationLng,
            });

            onRegistered?.(res.data.ride);
            resetAndClose();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to register ride');
        } finally {
            setLoading(false);
        }
    }

    function resetAndClose() {
        setForm({
            source: '', destination: '', date: '', rideTime: '',
            sourceLat: null, sourceLng: null, destinationLat: null, destinationLng: null,
            vehicleType: 'Auto', seatsAvailable: 3, maleCount: 0, femaleCount: 0, pinkMode: false,
        });
        setStep(1);
        setError('');
        onClose?.();
    }

    const today = new Date().toISOString().split('T')[0];
    const isFemale = user?.gender === 'Female';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={resetAndClose} />
            <div className="relative w-full max-w-md bg-sawaari-card rounded-2xl border border-sawaari-border shadow-2xl animate-slide-up">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-sawaari-border px-5 py-4">
                    <div>
                        <h2 className="text-lg font-bold text-white">Register a Ride</h2>
                        <p className="text-sawaari-muted text-xs">Step {step} of 2</p>
                    </div>
                    <button onClick={resetAndClose} className="text-sawaari-muted hover:text-white transition-colors p-1">✕</button>
                </div>

                {/* Progress */}
                <div className="flex gap-1 px-5 pt-4">
                    <div className="flex-1 h-1 rounded-full bg-gradient-to-r from-primary-500 to-primary-600" />
                    <div className={`flex-1 h-1 rounded-full transition-all duration-300 ${step >= 2 ? 'bg-gradient-to-r from-primary-500 to-primary-600' : 'bg-sawaari-border'}`} />
                </div>

                <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
                    {error && (
                        <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {step === 1 ? (
                        <form onSubmit={handleNext} className="space-y-4">
                            <div>
                                <label className="label">Pickup Location</label>
                                <LocationAutocomplete
                                    value={form.source}
                                    onChange={(v) => handleChange('source', v)}
                                    onSelect={({ name, lat, lon }) => {
                                        setForm(prev => ({ ...prev, source: name, sourceLat: lat, sourceLng: lon }));
                                    }}
                                    placeholder="e.g. Ameerpet"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="label">Drop Location</label>
                                <LocationAutocomplete
                                    value={form.destination}
                                    onChange={(v) => handleChange('destination', v)}
                                    onSelect={({ name, lat, lon }) => {
                                        setForm(prev => ({ ...prev, destination: name, destinationLat: lat, destinationLng: lon }));
                                    }}
                                    placeholder="e.g. HITEC City"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="label">Date</label>
                                    <input type="date" value={form.date}
                                        onChange={e => handleChange('date', e.target.value)}
                                        min={today}
                                        className="input-field" />
                                </div>
                                <div>
                                    <label className="label">Time ⏰</label>
                                    <input type="time" value={form.rideTime}
                                        onChange={e => handleChange('rideTime', e.target.value)}
                                        className="input-field" />
                                </div>
                            </div>
                            <button type="submit" className="btn-primary w-full">Next →</button>
                        </form>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Summary */}
                            <div className="bg-sawaari-dark rounded-xl p-3 border border-sawaari-border">
                                <div className="text-white font-semibold text-sm">{form.source} → {form.destination}</div>
                                <div className="text-sawaari-muted text-xs mt-0.5">{form.date} at {form.rideTime}</div>
                            </div>

                            <div>
                                <label className="label">Vehicle Type</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {[
                                        { type: 'Auto', icon: '🛺' },
                                        { type: 'Cab', icon: '🚖' },
                                        { type: 'Mini Bus', icon: '🚌' },
                                        { type: 'Car', icon: '🚗' },
                                    ].map(({ type, icon }) => (
                                        <button key={type} type="button"
                                            onClick={() => handleChange('vehicleType', type)}
                                            className={`py-2.5 rounded-xl border text-center transition-all
                                                ${form.vehicleType === type
                                                    ? 'bg-gradient-to-r from-primary-500 to-primary-600 border-transparent text-white shadow-md shadow-primary-500/20'
                                                    : 'bg-sawaari-dark border-sawaari-border text-sawaari-muted hover:text-white'}`}>
                                            <div className="text-xl">{icon}</div>
                                            <div className="text-[10px] mt-0.5 font-medium">{type}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="label">Total Seats Available</label>
                                <div className="flex items-center gap-4 bg-sawaari-dark rounded-xl px-4 py-3">
                                    <button type="button" onClick={() => handleChange('seatsAvailable', Math.max(1, form.seatsAvailable - 1))}
                                        className="w-9 h-9 rounded-lg bg-sawaari-border text-white font-bold text-lg flex items-center justify-center hover:bg-sawaari-card transition-colors">−</button>
                                    <span className="text-white font-bold text-xl flex-1 text-center">{form.seatsAvailable}</span>
                                    <button type="button" onClick={() => handleChange('seatsAvailable', Math.min(12, form.seatsAvailable + 1))}
                                        className="w-9 h-9 rounded-lg bg-sawaari-border text-white font-bold text-lg flex items-center justify-center hover:bg-sawaari-card transition-colors">+</button>
                                </div>
                            </div>

                            {/* Passenger counts */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="label">👨 Male Passengers</label>
                                    <div className="flex items-center gap-3 bg-sawaari-dark rounded-xl px-3 py-2">
                                        <button type="button"
                                            onClick={() => handleChange('maleCount', Math.max(0, form.maleCount - 1))}
                                            disabled={form.pinkMode}
                                            className="w-7 h-7 rounded-lg bg-sawaari-border text-white font-bold flex items-center justify-center disabled:opacity-30">−</button>
                                        <span className="text-white font-bold flex-1 text-center">{form.maleCount}</span>
                                        <button type="button"
                                            onClick={() => handleChange('maleCount', form.maleCount + 1)}
                                            disabled={form.pinkMode}
                                            className="w-7 h-7 rounded-lg bg-sawaari-border text-white font-bold flex items-center justify-center disabled:opacity-30">+</button>
                                    </div>
                                </div>
                                <div>
                                    <label className="label">👩 Female Passengers</label>
                                    <div className="flex items-center gap-3 bg-sawaari-dark rounded-xl px-3 py-2">
                                        <button type="button"
                                            onClick={() => handleChange('femaleCount', Math.max(0, form.femaleCount - 1))}
                                            className="w-7 h-7 rounded-lg bg-sawaari-border text-white font-bold flex items-center justify-center">−</button>
                                        <span className="text-white font-bold flex-1 text-center">{form.femaleCount}</span>
                                        <button type="button"
                                            onClick={() => handleChange('femaleCount', form.femaleCount + 1)}
                                            className="w-7 h-7 rounded-lg bg-sawaari-border text-white font-bold flex items-center justify-center">+</button>
                                    </div>
                                </div>
                            </div>

                            {/* Pink Mode */}
                            {isFemale && (
                                <div className="flex items-center justify-between bg-pink-500/5 border border-pink-500/20 rounded-xl px-4 py-3">
                                    <div>
                                        <span className="text-white text-sm font-medium">🩷 Pink Mode</span>
                                        <p className="text-sawaari-muted text-xs">Female-only ride</p>
                                    </div>
                                    <button type="button"
                                        onClick={() => handleChange('pinkMode', !form.pinkMode)}
                                        className={`w-12 h-6 rounded-full transition-all duration-300 relative ${form.pinkMode ? 'bg-gradient-to-r from-pink-500 to-primary-500' : 'bg-sawaari-border'}`}>
                                        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300 ${form.pinkMode ? 'left-6' : 'left-0.5'}`} />
                                    </button>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <button type="button" onClick={() => setStep(1)} className="btn-secondary">← Back</button>
                                <button type="submit" disabled={loading} className="btn-primary">
                                    {loading ? 'Registering...' : '🚗 Register Ride'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
