import React from 'react';

const VEHICLE_ICONS = {
    Auto: '🛺',
    Cab: '🚖',
    '4-Seater': '🚗',
    '5-Seater': '🚙',
    'Mini Bus': '🚌',
};

const TIME_ICONS = {
    'Early Morning': '🌄',
    Morning: '🌅',
    Afternoon: '☀️',
    Evening: '🌇',
    Night: '🌙',
};

const GENDER_COLORS = {
    Male: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    Female: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
    'Prefer not to say': 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function RideCard({ ride, pinkMode, onJoin, joining, isMyRide, onChat, chatEnabled, currentUserId, currentUserGender }) {
    const isPinkRide = ride.pink_mode === 1 || ride.pink_mode === true;
    const isFemale = currentUserGender === 'Female';
    const borderColor = pinkMode
        ? 'border-pink-500/20 hover:border-pink-500/50'
        : 'border-sawaari-border hover:border-primary-500/40';

    const accentBg = pinkMode
        ? 'bg-gradient-to-br from-pink-500/10 to-transparent'
        : 'bg-gradient-to-br from-primary-500/10 to-transparent';

    return (
        <div className={`
      group relative bg-sawaari-card rounded-2xl border p-5 mb-3
      transition-all duration-300 hover:shadow-lg ${borderColor}
    `}>
            {/* Pink mode badge */}
            {isPinkRide && (
                <div className="flex items-center gap-1 mb-3">
                    <span className="text-xs bg-pink-500/20 text-pink-400 px-2.5 py-0.5 rounded-full border border-pink-500/20 font-semibold">🩷 Pink Mode — Female Only</span>
                </div>
            )}

            {/* Route header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${accentBg} border ${pinkMode ? 'border-pink-500/20' : 'border-primary-500/20'} flex items-center justify-center text-lg`}>
                        {VEHICLE_ICONS[ride.vehicle_type] || '🚗'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-white font-semibold text-sm truncate">
                            <span className="truncate">{ride.source}</span>
                            <span className="text-sawaari-muted flex-shrink-0">→</span>
                            <span className="truncate">{ride.destination}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-sawaari-muted">{formatDate(ride.date)}</span>
                            {ride.time_slot && (
                                <span className="text-xs text-sawaari-muted">· {TIME_ICONS[ride.time_slot]} {ride.time_slot}</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Owner gender badge */}
                {ride.owner_gender && (
                    <span className={`badge border flex-shrink-0 ml-2 ${GENDER_COLORS[ride.owner_gender] || GENDER_COLORS['Prefer not to say']}`}>
                        {ride.owner_gender === 'Female' ? '👩' : ride.owner_gender === 'Male' ? '👨' : '🧑'}
                        {ride.owner_gender === 'Prefer not to say' ? 'N/A' : ride.owner_gender}
                    </span>
                )}
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-sawaari-dark rounded-xl px-3 py-2 text-center">
                    <div className="text-white font-bold text-lg">{ride.seats_available}</div>
                    <div className="text-sawaari-muted text-xs">Seats</div>
                </div>
                <div className="bg-sawaari-dark rounded-xl px-3 py-2 text-center">
                    <div className="text-white font-bold text-sm">{ride.vehicle_type}</div>
                    <div className="text-sawaari-muted text-xs">Vehicle</div>
                </div>
                <div className="bg-sawaari-dark rounded-xl px-3 py-2 text-center">
                    <div className="text-white font-bold text-sm">{ride.member_count || 1}</div>
                    <div className="text-sawaari-muted text-xs">Members</div>
                </div>
            </div>

            {/* Passenger gender info */}
            {((!isPinkRide && ride.male_count > 0) || ride.female_count > 0) && (
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <span className="text-xs text-sawaari-muted">Passengers:</span>
                    {!isPinkRide && ride.male_count > 0 && (
                        <span className="badge bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            👨 {ride.male_count} male{ride.male_count !== 1 ? 's' : ''}
                        </span>
                    )}
                    {ride.female_count > 0 && (
                        <span className="badge bg-pink-500/10 text-pink-400 border border-pink-500/20">
                            👩 {ride.female_count} female{ride.female_count !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>
            )}

            {/* Owner */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full ${pinkMode ? 'bg-pink-500/20' : 'bg-primary-500/20'} flex items-center justify-center text-xs font-bold ${pinkMode ? 'text-pink-400' : 'text-primary-400'}`}>
                        {ride.owner_username?.[0]?.toUpperCase()}
                    </div>
                    <span className="text-sm text-white font-medium">{ride.owner_username}</span>
                    {isMyRide && ride.is_owner === 1 && (
                        <span className="badge bg-sawaari-border text-sawaari-muted border border-sawaari-border/60 text-xs">owner</span>
                    )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                    {isMyRide ? (
                        chatEnabled ? (
                            <button
                                onClick={onChat}
                                className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition-all active:scale-95 ${pinkMode
                                    ? 'bg-pink-500 hover:bg-pink-600 text-white shadow-md shadow-pink-500/20'
                                    : 'bg-primary-500 hover:bg-primary-600 text-white shadow-md shadow-primary-500/20'
                                    }`}
                            >
                                💬 Chat
                            </button>
                        ) : (
                            <span className="text-xs text-sawaari-muted px-3 py-2 bg-sawaari-dark rounded-xl">
                                Waiting for riders…
                            </span>
                        )
                    ) : isPinkRide && !isFemale ? (
                        <span className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-sawaari-border/40 text-sawaari-muted cursor-not-allowed">
                            🔒 Female Only
                        </span>
                    ) : (
                        <button
                            onClick={() => onJoin && onJoin(ride.id)}
                            disabled={joining}
                            className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${pinkMode || isPinkRide
                                ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white shadow-md shadow-pink-500/20'
                                : 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md shadow-primary-500/20'
                                }`}
                        >
                            {joining ? (
                                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                            ) : '🤝'} Join Ride
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
