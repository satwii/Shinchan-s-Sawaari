import React, { useState } from 'react';
import api from '../api';

const TIME_SLOTS = ['Early Morning', 'Morning', 'Afternoon', 'Evening', 'Night'];
const VEHICLE_TYPES = ['Auto', 'Cab', '4-Seater', '5-Seater', 'Mini Bus'];

export default function RegisterRideModal({ pinkMode, prefill, onClose, onSuccess }) {
    const today = new Date().toISOString().split('T')[0];

    const [source, setSource] = useState(prefill?.source || '');
    const [destination, setDestination] = useState(prefill?.destination || '');
    const [date, setDate] = useState(prefill?.date || '');
    const [timeSlot, setTimeSlot] = useState(prefill?.timeSlot || '');
    const [vehicleType, setVehicleType] = useState('Cab');
    const [seatsAvailable, setSeatsAvailable] = useState(3);
    const [maleCount, setMaleCount] = useState(0);
    const [femaleCount, setFemaleCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const accentClass = pinkMode
        ? 'from-pink-500 to-pink-600 shadow-pink-500/20'
        : 'from-primary-500 to-primary-600 shadow-primary-500/20';
    const borderClass = pinkMode ? 'border-pink-500/30' : 'border-sawaari-border';

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        if (!source.trim() || !destination.trim() || !date || !timeSlot || !vehicleType) {
            return setError('All fields are required');
        }
        if (pinkMode && maleCount > 0) {
            return setError('Pink Mode rides cannot include male passengers');
        }
        setLoading(true);
        try {
            await api.post('/rides/register', {
                source: source.trim(),
                destination: destination.trim(),
                date,
                timeSlot,
                vehicleType,
                seatsAvailable,
                maleCount: pinkMode ? 0 : maleCount,
                femaleCount,
                pinkMode,
            });
            onSuccess();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to register ride');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 animate-fade-in">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className={`
        relative w-full max-w-lg bg-sawaari-card rounded-2xl border ${borderClass}
        shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto
        ${pinkMode ? 'shadow-pink-500/10' : 'shadow-primary-500/10'}
      `}>
                {/* Header */}
                <div className={`sticky top-0 bg-sawaari-card border-b ${borderClass} px-5 py-4 flex items-center justify-between z-10`}>
                    <div>
                        <h2 className="text-lg font-bold text-white">Register a Ride</h2>
                        <p className="text-xs text-sawaari-muted">Share your journey with others</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-sawaari-border flex items-center justify-center text-sawaari-muted hover:text-white transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Pink Mode banner */}
                {pinkMode && (
                    <div className="bg-pink-500/10 border-b border-pink-500/20 px-5 py-2.5">
                        <p className="text-pink-400 text-xs font-semibold text-center">
                            🩷 Pink Mode — This ride will be visible to female riders only. No male passengers allowed.
                        </p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {/* Route */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="label">From</label>
                            <input
                                type="text"
                                value={source}
                                onChange={(e) => setSource(e.target.value)}
                                placeholder="Source"
                                className="input-field"
                                required
                            />
                        </div>
                        <div>
                            <label className="label">To</label>
                            <input
                                type="text"
                                value={destination}
                                onChange={(e) => setDestination(e.target.value)}
                                placeholder="Destination"
                                className="input-field"
                                required
                            />
                        </div>
                    </div>

                    {/* Date & Time */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="label">Date</label>
                            <input
                                type="date"
                                value={date}
                                min={today}
                                onChange={(e) => setDate(e.target.value)}
                                className="input-field"
                                required
                            />
                        </div>
                        <div>
                            <label className="label">Time Slot</label>
                            <select
                                value={timeSlot}
                                onChange={(e) => setTimeSlot(e.target.value)}
                                className="input-field"
                                required
                            >
                                <option value="">Select time</option>
                                {TIME_SLOTS.map((slot) => (
                                    <option key={slot} value={slot}>{slot}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Vehicle type */}
                    <div>
                        <label className="label">Vehicle Type</label>
                        <div className="grid grid-cols-5 gap-2">
                            {VEHICLE_TYPES.map((v) => (
                                <button
                                    type="button"
                                    key={v}
                                    onClick={() => setVehicleType(v)}
                                    className={`py-2 px-1 rounded-xl text-xs font-medium border transition-all duration-200 ${vehicleType === v
                                        ? `bg-gradient-to-r ${accentClass} border-transparent text-white`
                                        : 'bg-sawaari-border/40 border-sawaari-border text-sawaari-muted hover:text-white'
                                        }`}
                                >
                                    {v === 'Auto' ? '🛺' : v === 'Cab' ? '🚖' : v === '4-Seater' ? '🚗' : v === '5-Seater' ? '🚙' : '🚌'}
                                    <span className="block mt-0.5 truncate">{v}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Seats */}
                    <div>
                        <label className="label">Seats Available</label>
                        <input
                            type="number"
                            value={seatsAvailable}
                            onChange={(e) => setSeatsAvailable(parseInt(e.target.value) || 1)}
                            min="1"
                            max="20"
                            className="input-field"
                            required
                        />
                    </div>

                    {/* Passengers */}
                    <div>
                        <label className="label">People already with you</label>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">{pinkMode ? '🚫' : '👨'}</span>
                                <input
                                    type="number"
                                    value={pinkMode ? 0 : maleCount}
                                    onChange={(e) => setMaleCount(parseInt(e.target.value) || 0)}
                                    min="0" max="20"
                                    className={`input-field pl-9 ${pinkMode ? 'opacity-40 cursor-not-allowed' : ''}`}
                                    placeholder="Males"
                                    disabled={pinkMode}
                                />
                                {pinkMode && (
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-pink-400 font-semibold">Pink</span>
                                )}
                            </div>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">👩</span>
                                <input
                                    type="number"
                                    value={femaleCount}
                                    onChange={(e) => setFemaleCount(parseInt(e.target.value) || 0)}
                                    min="0" max="20"
                                    className="input-field pl-9"
                                    placeholder="Females"
                                />
                            </div>
                        </div>
                        {pinkMode && (
                            <p className="text-pink-400/60 text-xs mt-1.5">Males not allowed in Pink Mode rides</p>
                        )}
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl">
                            {error}
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={loading}
                        className={`btn-primary w-full bg-gradient-to-r ${accentClass} mt-2`}
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Registering...
                            </span>
                        ) : '🚗 Register My Ride'}
                    </button>
                </form>
            </div>
        </div>
    );
}
