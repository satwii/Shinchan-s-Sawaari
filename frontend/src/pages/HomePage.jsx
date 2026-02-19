import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';

export default function HomePage() {
    const { user, logout, refreshUser } = useAuth();
    const navigate = useNavigate();
    const [profileData, setProfileData] = useState(null);

    useEffect(() => {
        refreshUser();
        // Fetch full profile
        api.get('/auth/me').then(res => {
            setProfileData(res.data.user);
        }).catch(() => { });
        // eslint-disable-next-line
    }, []);

    const displayUser = profileData || user;
    const badges = displayUser?.badges || [];

    function getGreeting() {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 17) return 'Good Afternoon';
        return 'Good Evening';
    }

    function handleDriveShare() {
        if (user?.role === 'driver') navigate('/driver/dashboard');
        else if (user?.role === 'rider') navigate('/rider/dashboard');
        else navigate('/driveshare');
    }

    return (
        <div className="min-h-screen bg-sawaari-dark">
            {/* Header */}
            <header className="bg-sawaari-card border-b border-sawaari-border">
                <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/30">
                            <span className="text-xl">🚗</span>
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-primary-400">Sawaari</h1>
                            <p className="text-sawaari-muted text-[10px] uppercase tracking-[0.15em]">Hyperlocal Ride Sharing</p>
                        </div>
                    </div>
                    <button onClick={logout}
                        className="text-sawaari-muted text-sm hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-500/10">
                        Logout
                    </button>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
                {/* Greeting */}
                <div>
                    <p className="text-sawaari-muted text-sm">{getGreeting()},</p>
                    <h2 className="text-2xl font-bold text-white">{displayUser?.username || 'Rider'} 👋</h2>
                </div>

                {/* Profile Card */}
                <div className="card">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-emerald-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-primary-500/20">
                            {displayUser?.username?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <span className="text-white font-bold">{displayUser?.username}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${displayUser?.gender === 'Female' ? 'bg-pink-500/10 text-pink-400' :
                                    displayUser?.gender === 'Male' ? 'bg-blue-500/10 text-blue-400' :
                                        'bg-gray-500/10 text-gray-400'}`}>
                                    {displayUser?.gender}
                                </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                                {displayUser?.avg_rating && (
                                    <span className="text-amber-400 text-sm font-medium">⭐ {displayUser.avg_rating} ({displayUser.rating_count})</span>
                                )}
                                <span className="text-sawaari-muted text-sm">{displayUser?.trip_count || 0} trips</span>
                            </div>
                        </div>
                    </div>

                    {/* Badges */}
                    {badges.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-4">
                            {badges.map(b => (
                                <span key={b} className={`text-xs font-medium px-2.5 py-1 rounded-full border
                                    ${b.includes('Aadhaar') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                        b.includes('New') ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                            b.includes('Verified Traveller') ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                'bg-sawaari-border text-sawaari-muted border-sawaari-border'}`}>
                                    {b}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Emergency Contact */}
                    {displayUser?.emergency_contact_name && (
                        <div className="mt-4 bg-sawaari-dark rounded-xl px-4 py-3 border border-sawaari-border">
                            <p className="text-sawaari-muted text-xs mb-1">Emergency Contact</p>
                            <p className="text-white text-sm font-medium">{displayUser.emergency_contact_name}</p>
                        </div>
                    )}
                </div>

                {/* Navigation Cards */}
                <div className="grid grid-cols-1 gap-4">
                    {/* FairShare */}
                    <button onClick={() => navigate('/fairshare')}
                        className="card text-left group hover:border-primary-500/30 hover:shadow-lg hover:shadow-primary-500/5 transition-all active:scale-[0.98]">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500/20 to-emerald-500/10 border border-primary-500/20 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                                🚗
                            </div>
                            <div className="flex-1">
                                <h3 className="text-white font-bold text-lg group-hover:text-primary-400 transition-colors">FairShare</h3>
                                <p className="text-sawaari-muted text-sm">Share rides, split costs, ride together</p>
                            </div>
                            <span className="text-sawaari-muted text-xl group-hover:text-primary-400 group-hover:translate-x-1 transition-all">→</span>
                        </div>
                    </button>

                    {/* DriveShare (Carpooling) */}
                    <button onClick={handleDriveShare}
                        className="card text-left group hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5 transition-all active:scale-[0.98]">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-blue-500/10 border border-emerald-500/20 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                                🚙
                            </div>
                            <div className="flex-1">
                                <h3 className="text-white font-bold text-lg group-hover:text-emerald-400 transition-colors">Carpooling</h3>
                                <p className="text-sawaari-muted text-sm">Offer or find carpool rides</p>
                                {user?.role && (
                                    <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${user.role === 'driver' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'
                                        }`}>{user.role === 'driver' ? '🚗 Driver' : '🚶 Rider'}</span>
                                )}
                            </div>
                            <span className="text-sawaari-muted text-xl group-hover:text-emerald-400 group-hover:translate-x-1 transition-all">→</span>
                        </div>
                    </button>
                </div>

                {/* Safety Banner */}
                <div className="bg-gradient-to-r from-emerald-500/10 to-primary-500/5 border border-emerald-500/20 rounded-2xl px-5 py-4">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">🔒</span>
                        <div>
                            <h3 className="text-white font-semibold text-sm">Your Safety, Our Priority</h3>
                            <p className="text-sawaari-muted text-xs mt-0.5">
                                Aadhaar verified users · SOS emergency button · GPS live tracking · Ride audit logs
                            </p>
                        </div>
                    </div>
                </div>

                <p className="text-center text-sawaari-muted text-xs pb-6">Sawaari — Safe. Smart. Shared.</p>
            </main>
        </div>
    );
}
