import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const VEHICLE_TYPES = ['Auto', 'Cab', 'SUV', '4-Seater', 'Mini Bus'];

export default function CreateTrip() {
    const [step, setStep] = useState(1);      // 1=vehicle, 2=trip
    const [vehicles, setVehicles] = useState([]);
    const [selectedVehicleId, setSelectedVehicleId] = useState(null);
    const [newVehicle, setNewVehicle] = useState({ model: '', type: 'Cab', color: '', capacity: 4 });
    const [trip, setTrip] = useState({ source: '', destination: '', date: '', time: '', available_seats: 3, price: 0, pink_mode: false });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const today = new Date().toISOString().split('T')[0];

    useEffect(() => {
        api.get('/ts/vehicles').then(r => {
            setVehicles(r.data.vehicles || []);
        }).catch(() => { });
    }, []);

    async function handleAddVehicle(e) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await api.post('/ts/vehicles', newVehicle);
            const updated = await api.get('/ts/vehicles');
            setVehicles(updated.data.vehicles || []);
            setSelectedVehicleId(res.data.vehicle_id);
            setStep(2);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to save vehicle');
        } finally {
            setLoading(false);
        }
    }

    async function handleCreateTrip(e) {
        e.preventDefault();
        setError('');
        if (!selectedVehicleId) return setError('Please select a vehicle');
        setLoading(true);
        try {
            await api.post('/ts/trips', {
                vehicle_id: selectedVehicleId,
                source: trip.source,
                destination: trip.destination,
                date: trip.date,
                time: trip.time,
                available_seats: trip.available_seats,
                price: trip.price,
                pink_mode: trip.pink_mode,
            });
            navigate('/driver/trips');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create trip');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-sawaari-dark">
            <header className="sticky top-0 z-50 bg-sawaari-dark/80 backdrop-blur-xl border-b border-sawaari-border">
                <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center gap-3">
                    <button onClick={() => navigate('/home')} className="text-sawaari-muted hover:text-white transition-colors">←</button>
                    <div>
                        <span className="text-xs text-sawaari-muted block">Sawaari · DriveShare</span>
                        <span className="text-white font-bold text-sm">🚗 Create Trip</span>
                    </div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-6 animate-fade-in">
                {/* Step indicator */}
                <div className="flex items-center gap-2 mb-6">
                    {['Vehicle', 'Trip Details'].map((s, i) => (
                        <React.Fragment key={s}>
                            <div className={`flex items-center gap-2 text-sm font-medium transition-colors ${step === i + 1 ? 'text-primary-400' : step > i + 1 ? 'text-emerald-400' : 'text-sawaari-muted'}`}>
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border ${step === i + 1 ? 'border-primary-500 bg-primary-500/20' : step > i + 1 ? 'border-emerald-500 bg-emerald-500/20' : 'border-sawaari-border'}`}>
                                    {step > i + 1 ? '✓' : i + 1}
                                </span>
                                {s}
                            </div>
                            {i === 0 && <div className="flex-1 h-px bg-sawaari-border" />}
                        </React.Fragment>
                    ))}
                </div>

                {/* Step 1: Vehicle */}
                {step === 1 && (
                    <div className="space-y-5">
                        {/* Existing vehicles */}
                        {vehicles.length > 0 && (
                            <div className="card">
                                <h3 className="text-white font-semibold mb-3">Your Vehicles</h3>
                                <div className="space-y-2">
                                    {vehicles.map(v => (
                                        <button key={v.id} onClick={() => { setSelectedVehicleId(v.id); setStep(2); }}
                                            className={`w-full text-left p-3 rounded-xl border transition-all ${selectedVehicleId === v.id ? 'border-primary-500 bg-primary-500/10' : 'border-sawaari-border hover:border-primary-500/40'}`}>
                                            <p className="text-white font-medium">{v.model} <span className="text-sawaari-muted text-xs">({v.type})</span></p>
                                            <p className="text-sawaari-muted text-xs">{v.color && `${v.color} · `}Capacity: {v.capacity}</p>
                                        </button>
                                    ))}
                                </div>
                                <div className="border-t border-sawaari-border mt-4 pt-4">
                                    <p className="text-sawaari-muted text-xs mb-3">Or add a new vehicle</p>
                                </div>
                            </div>
                        )}

                        {/* Add new vehicle */}
                        <form onSubmit={handleAddVehicle} className="card space-y-4">
                            <h3 className="text-white font-semibold">{vehicles.length > 0 ? '+' : ''} Add New Vehicle</h3>
                            <div>
                                <label className="label">Vehicle Model</label>
                                <input type="text" value={newVehicle.model} onChange={e => setNewVehicle({ ...newVehicle, model: e.target.value })}
                                    placeholder="Maruti Swift" className="input-field" required />
                            </div>
                            <div>
                                <label className="label">Type</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {VEHICLE_TYPES.map(t => (
                                        <button key={t} type="button" onClick={() => setNewVehicle({ ...newVehicle, type: t })}
                                            className={`py-2 rounded-xl border text-sm font-medium transition-all
                                ${newVehicle.type === t ? 'bg-gradient-to-r from-primary-500 to-primary-600 border-transparent text-white' : 'border-sawaari-border text-sawaari-muted hover:text-white'}`}>
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="label">Color</label>
                                    <input type="text" value={newVehicle.color} onChange={e => setNewVehicle({ ...newVehicle, color: e.target.value })}
                                        placeholder="White" className="input-field" />
                                </div>
                                <div>
                                    <label className="label">Capacity</label>
                                    <input type="number" value={newVehicle.capacity} onChange={e => setNewVehicle({ ...newVehicle, capacity: parseInt(e.target.value) || 1 })}
                                        min="1" max="50" className="input-field" required />
                                </div>
                            </div>
                            {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}
                            <button type="submit" disabled={loading} className="btn-primary w-full">
                                {loading ? 'Saving...' : 'Save Vehicle & Continue →'}
                            </button>
                        </form>
                    </div>
                )}

                {/* Step 2: Trip Details */}
                {step === 2 && (
                    <form onSubmit={handleCreateTrip} className="card space-y-4 animate-slide-up">
                        <h3 className="text-white font-semibold">Trip Details</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="label">From</label>
                                <input type="text" value={trip.source} onChange={e => setTrip({ ...trip, source: e.target.value })}
                                    placeholder="Source" className="input-field" required />
                            </div>
                            <div>
                                <label className="label">To</label>
                                <input type="text" value={trip.destination} onChange={e => setTrip({ ...trip, destination: e.target.value })}
                                    placeholder="Destination" className="input-field" required />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="label">Date</label>
                                <input type="date" value={trip.date} min={today} onChange={e => setTrip({ ...trip, date: e.target.value })}
                                    className="input-field" required />
                            </div>
                            <div>
                                <label className="label">Time</label>
                                <input type="time" value={trip.time} onChange={e => setTrip({ ...trip, time: e.target.value })}
                                    className="input-field" required />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="label">Seats Available</label>
                                <input type="number" value={trip.available_seats} onChange={e => setTrip({ ...trip, available_seats: parseInt(e.target.value) || 1 })}
                                    min="1" max="50" className="input-field" required />
                            </div>
                            <div>
                                <label className="label">Price / Seat (₹)</label>
                                <input type="number" value={trip.price} onChange={e => setTrip({ ...trip, price: parseFloat(e.target.value) || 0 })}
                                    min="0" step="10" className="input-field" placeholder="0 = free" />
                            </div>
                        </div>

                        {/* Pink Mode toggle */}
                        <div>
                            <button type="button" onClick={() => setTrip({ ...trip, pink_mode: !trip.pink_mode })}
                                className={`w-full py-3 rounded-xl border font-semibold text-sm flex items-center justify-center gap-2 transition-all
                    ${trip.pink_mode ? 'bg-pink-500 border-pink-400 text-white shadow-lg shadow-pink-500/30' : 'border-sawaari-border text-sawaari-muted hover:border-pink-500/40 hover:text-pink-400'}`}>
                                🩷 {trip.pink_mode ? 'Pink Mode ON — Female-friendly trip' : 'Enable Pink Mode'}
                            </button>
                            {trip.pink_mode && (
                                <p className="text-pink-400/60 text-xs text-center mt-2">
                                    Only female riders will see and be able to book this trip
                                </p>
                            )}
                        </div>

                        {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}
                        <div className="flex gap-3">
                            <button type="button" onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl border border-sawaari-border text-sawaari-muted hover:text-white transition-colors text-sm">
                                ← Back
                            </button>
                            <button type="submit" disabled={loading} className="flex-1 btn-primary">
                                {loading ? 'Creating...' : '🚗 Create Trip'}
                            </button>
                        </div>
                    </form>
                )}
            </main>
        </div>
    );
}
