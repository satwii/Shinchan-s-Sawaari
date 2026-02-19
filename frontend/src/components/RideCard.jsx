import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function RideCard({ ride, currentUser, onRequestJoin }) {
    const navigate = useNavigate();
    const isPink = ride.pink_mode === 1;
    const ownerProfile = ride.owner_profile;
    const requestStatus = ride.user_request_status;
    const isActive = ride.trip_started && !ride.trip_completed;

    return (
        <div
            className={`card cursor-pointer transition-all hover:border-primary-500/30 hover:shadow-lg hover:shadow-primary-500/5 group
                ${isPink ? 'border-pink-500/20 bg-gradient-to-br from-sawaari-card to-pink-500/5' : ''}
                ${isActive ? 'border-emerald-500/20' : ''}`}
            onClick={() => navigate(`/ride/${ride.id}`)}
        >
            {/* Status badge */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    {isPink && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20">
                            🩷 Pink Mode
                        </span>
                    )}
                    {isActive && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> Live
                        </span>
                    )}
                    {ride.trip_completed ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20">
                            Completed
                        </span>
                    ) : null}
                </div>
                <span className="text-sawaari-muted text-xs">{ride.ride_time || ride.time_slot}</span>
            </div>

            {/* Route */}
            <div className="flex items-center gap-3 mb-3">
                <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-emerald-500/30" />
                    <div className="w-0.5 h-6 bg-gradient-to-b from-emerald-400/50 to-primary-500/50 rounded-full" />
                    <div className="w-2.5 h-2.5 rounded-full bg-primary-500 border-2 border-primary-500/30" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-white font-semibold text-sm truncate">{ride.source}</div>
                    <div className="text-sawaari-muted text-xs my-0.5">{ride.date}</div>
                    <div className="text-white font-semibold text-sm truncate">{ride.destination}</div>
                </div>
                <div className="text-3xl flex-shrink-0 ml-2">
                    {ride.vehicle_type === 'Auto' ? '🛺' : ride.vehicle_type === 'Cab' ? '🚖' : ride.vehicle_type === 'Mini Bus' ? '🚌' : '🚗'}
                </div>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-3 mb-3 text-xs">
                <span className="bg-sawaari-dark rounded-lg px-2.5 py-1 text-sawaari-muted">
                    🪑 <span className="text-white font-medium">{ride.seats_available - (ride.member_count || 1) + 1}</span> open
                </span>
                <span className="bg-sawaari-dark rounded-lg px-2.5 py-1 text-sawaari-muted">
                    👥 <span className="text-white font-medium">{ride.member_count || 1}</span> members
                </span>
                <span className="bg-sawaari-dark rounded-lg px-2.5 py-1 text-sawaari-muted">
                    {ride.vehicle_type}
                </span>
            </div>

            {/* Owner info */}
            {ownerProfile && (
                <div className="flex items-center justify-between bg-sawaari-dark rounded-xl px-3 py-2.5 mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-500 to-emerald-500 flex items-center justify-center text-white text-xs font-bold">
                            {ownerProfile.username?.[0]?.toUpperCase()}
                        </div>
                        <div>
                            <span className="text-white text-sm font-medium">{ownerProfile.username}</span>
                            <div className="flex items-center gap-1.5">
                                {ownerProfile.avg_rating && (
                                    <span className="text-amber-400 text-[10px]">⭐ {ownerProfile.avg_rating}</span>
                                )}
                                <span className="text-sawaari-muted text-[10px]">{ownerProfile.trip_count} trips</span>
                                {ownerProfile.aadhaar_verified && (
                                    <span className="text-emerald-400 text-[10px]">✓</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-1">
                        {(ownerProfile.badges || []).slice(0, 2).map(b => (
                            <span key={b} className="text-[8px] font-medium px-1.5 py-0.5 rounded-full bg-sawaari-border text-sawaari-muted">
                                {b}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Action area */}
            <div className="flex items-center gap-2">
                {requestStatus === 'pending' && (
                    <span className="flex-1 text-center py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-semibold">
                        ⏳ Request Pending
                    </span>
                )}
                {requestStatus === 'accepted' && (
                    <span className="flex-1 text-center py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold">
                        ✅ Accepted — You're In!
                    </span>
                )}
                {requestStatus === 'declined' && (
                    <span className="flex-1 text-center py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-semibold">
                        ❌ Not Accepted
                    </span>
                )}
                {!requestStatus && !ride.trip_started && !ride.trip_completed && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onRequestJoin?.(ride.id); }}
                        className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 ${isPink
                                ? 'bg-gradient-to-r from-pink-500 to-primary-500 text-white shadow-md shadow-pink-500/20'
                                : 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md shadow-primary-500/20'
                            }`}
                    >
                        🤝 Request to Join
                    </button>
                )}
                <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/ride/${ride.id}`); }}
                    className="py-2 px-4 rounded-xl bg-sawaari-border text-white text-sm font-medium hover:bg-sawaari-card transition-colors"
                >
                    View →
                </button>
            </div>
        </div>
    );
}
