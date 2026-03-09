import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';

// Reusable FareCard — shows Sawaari-calculated fare breakdown
export default function FareCard({ sourceLat, sourceLng, destLat, destLng, vehicleType, seats, onFareReady }) {
    const [fare, setFare] = useState(null);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');

    const calculate = useCallback(async () => {
        if (!sourceLat || !sourceLng || !destLat || !destLng) return;
        setLoading(true);
        setErr('');
        try {
            const res = await api.post('/fare/calculate', {
                source_lat: sourceLat,
                source_lng: sourceLng,
                destination_lat: destLat,
                destination_lng: destLng,
                vehicle_type: vehicleType || 'Cab',
                seats_filled: seats || 1,
            });
            setFare(res.data);
            onFareReady?.(res.data.cost_per_person);
        } catch (e) {
            setErr(e.response?.data?.error || 'Could not calculate fare');
        } finally {
            setLoading(false);
        }
    }, [sourceLat, sourceLng, destLat, destLng, vehicleType, seats, onFareReady]);

    useEffect(() => {
        calculate();
    }, [calculate]);

    if (!sourceLat || !destLat) return null;

    if (loading) return (
        <div style={{
            background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.2)',
            borderRadius: 16, padding: '14px 16px', marginTop: 8,
            display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,0.5)', fontSize: 13,
        }}>
            <span style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block' }}>⛽</span>
            <span>Calculating Sawaari fare...</span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );

    if (err) return (
        <div style={{
            background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 16, padding: '12px 16px', color: '#f87171', fontSize: 12, marginTop: 8,
        }}>⚠️ {err} — enter coordinates by selecting locations from dropdown</div>
    );

    if (!fare) return null;

    return (
        <div style={{
            background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(6,78,59,0.1))',
            border: '1px solid rgba(16,185,129,0.25)',
            borderRadius: 16, padding: '16px', marginTop: 8,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 18 }}>⛽</span>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>Sawaari Calculated Fare</span>
                <span style={{
                    fontSize: 10, background: 'rgba(16,185,129,0.15)', color: '#34d399',
                    border: '1px solid rgba(16,185,129,0.3)', borderRadius: 6, padding: '2px 6px', fontWeight: 600,
                }}>Official</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                {[
                    { label: 'Distance', value: `${fare.distance_km} km` },
                    { label: 'Petrol rate', value: `₩${fare.petrol_price_per_litre}/L` },
                    { label: 'Fuel cost', value: `₩${fare.fuel_cost}` },
                    { label: `${fare.breakdown.total_persons} persons share`, value: `₩${fare.cost_per_person.toFixed(0)} each` },
                ].map(({ label, value }) => (
                    <div key={label} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: '8px 10px' }}>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>{label}</div>
                        <div style={{ color: '#fff', fontWeight: 600, fontSize: 13, marginTop: 2 }}>{value}</div>
                    </div>
                ))}
            </div>

            <div style={{
                borderTop: '1px solid rgba(16,185,129,0.2)', paddingTop: 10,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
                <div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>Each passenger pays</div>
                    <div style={{ color: '#34d399', fontWeight: 700, fontSize: 20 }}>₩{fare.cost_per_person.toFixed(0)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>Driver saves</div>
                    <div style={{ color: '#a7f3d0', fontWeight: 600, fontSize: 13 }}>₩{fare.driver_saves.toFixed(0)}</div>
                </div>
            </div>

            <div style={{
                marginTop: 10, fontSize: 10, color: 'rgba(255,255,255,0.3)',
                display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
            }}>
                <span>
                    {fare.isEstimated
                        ? '⚠️ Estimated fare — exact route unavailable'
                        : '✅ Calculated from actual route'}
                </span>
                <span>⚖️ Legal cost-share only</span>
            </div>
        </div>
    );
}
