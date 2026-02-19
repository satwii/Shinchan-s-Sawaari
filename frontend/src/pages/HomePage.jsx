import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function HomePage() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const hour = new Date().getHours();
    const greeting = hour < 12 ? '☀️ Good Morning' : hour < 17 ? '🌤️ Good Afternoon' : '🌙 Good Evening';

    // DriveShare: if user already has a role, go to their dashboard directly;
    // otherwise, go to role selection (/driveshare)
    function handleDriveShare() {
        if (user?.role === 'driver') return navigate('/driver/dashboard');
        if (user?.role === 'rider') return navigate('/rider/dashboard');
        navigate('/driveshare'); // Role selection page
    }

    const hasRole = !!user?.role;
    const isDriver = user?.role === 'driver';

    return (
        <div className="min-h-screen bg-sawaari-dark">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-sawaari-dark/80 backdrop-blur-xl border-b border-sawaari-border">
                <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-primary-400 font-extrabold text-xl tracking-tight">Sawaari</span>
                        {hasRole && (
                            <span className="text-xs text-sawaari-muted bg-sawaari-border px-2 py-0.5 rounded-full capitalize">
                                {isDriver ? '🚗 Driver' : '🎫 Rider'}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={logout}
                        className="text-sm text-sawaari-muted hover:text-red-400 transition-colors"
                    >
                        Logout
                    </button>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
                {/* Greeting */}
                <div className="mb-8">
                    <p className="text-sawaari-muted text-sm">{greeting}</p>
                    <h1 className="text-white text-3xl font-black mt-1">{user?.username} 👋</h1>
                    <p className="text-sawaari-muted text-sm mt-1">Where are you headed today?</p>
                </div>

                {/* ── Two Main Mode Cards ───────────────────────────────── */}
                <div className="grid grid-cols-1 gap-5">

                    {/* Card 1 — FairShare (Public Transport Sharing) */}
                    <button
                        onClick={() => navigate('/fairshare')}
                        className="group relative w-full text-left rounded-3xl overflow-hidden border border-emerald-500/20
                     bg-gradient-to-br from-[#0a1a14] via-[#0d1f1a] to-[#080f0d]
                     hover:border-emerald-500/50 hover:scale-[1.01] active:scale-[0.99]
                     transition-all duration-300 shadow-xl shadow-emerald-500/10 p-7"
                    >
                        {/* Glow blob */}
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/20 rounded-full blur-3xl group-hover:bg-emerald-500/30 transition-colors" />

                        <div className="relative">
                            <div className="w-14 h-14 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-3xl mb-4 border border-emerald-500/20">
                                🚌
                            </div>
                            <h2 className="text-white text-2xl font-black tracking-tight">FairShare</h2>
                            <p className="text-emerald-200/60 text-sm mt-1 font-medium tracking-wide uppercase">Public Transport Sharing</p>
                            <p className="text-emerald-200/50 text-sm mt-2 leading-relaxed">
                                Share your ride socially. Find co-passengers going your way on public transport, join their group, and chat in real-time.
                            </p>

                            <div className="flex items-center gap-3 mt-5 flex-wrap">
                                <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-full px-3 py-1">🩷 Pink Mode</span>
                                <span className="text-xs bg-white/5 text-white/50 border border-white/10 rounded-full px-3 py-1">💬 Group Chat</span>
                                <span className="text-xs bg-white/5 text-white/50 border border-white/10 rounded-full px-3 py-1">🚌 Public Transport</span>
                                <span className="text-xs bg-white/5 text-white/50 border border-white/10 rounded-full px-3 py-1">🆓 Free</span>
                            </div>

                            <div className="mt-5 flex items-center gap-2 text-emerald-400 text-sm font-semibold group-hover:gap-3 transition-all">
                                Open FairShare <span className="text-lg">→</span>
                            </div>
                        </div>
                    </button>

                    {/* Card 2 — DriveShare (Carpooling) */}
                    <button
                        onClick={handleDriveShare}
                        className="group relative w-full text-left rounded-3xl overflow-hidden border border-primary-500/20
                     bg-gradient-to-br from-[#1a0d1f] via-[#1f1027] to-[#0d0a0f]
                     hover:border-primary-500/50 hover:scale-[1.01] active:scale-[0.99]
                     transition-all duration-300 shadow-xl shadow-primary-500/10 p-7"
                    >
                        {/* Glow blob */}
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary-500/20 rounded-full blur-3xl group-hover:bg-primary-500/30 transition-colors" />

                        <div className="relative">
                            <div className="w-14 h-14 bg-primary-500/20 rounded-2xl flex items-center justify-center text-3xl mb-4 border border-primary-500/20">
                                🚗
                            </div>
                            <h2 className="text-white text-2xl font-black tracking-tight">DriveShare</h2>
                            <p className="text-pink-200/60 text-sm mt-1 font-medium tracking-wide uppercase">Carpooling</p>
                            <p className="text-pink-200/50 text-sm mt-2 leading-relaxed">
                                {hasRole
                                    ? (isDriver
                                        ? 'Create trips, set pricing, manage your vehicle, and earn from riders on your route.'
                                        : 'Search trips by route & timing, book seats, pay securely, and carpool with verified drivers.')
                                    : 'Offer rides as a Driver or find affordable carpools as a Rider. Choose your role when you enter!'}
                            </p>

                            <div className="flex items-center gap-3 mt-5 flex-wrap">
                                {hasRole ? (
                                    isDriver ? (
                                        <>
                                            <span className="text-xs bg-primary-500/20 text-primary-400 border border-primary-500/20 rounded-full px-3 py-1">📊 Dashboard</span>
                                            <span className="text-xs bg-white/5 text-white/50 border border-white/10 rounded-full px-3 py-1">💰 Earnings</span>
                                            <span className="text-xs bg-white/5 text-white/50 border border-white/10 rounded-full px-3 py-1">🗺️ My Trips</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-xs bg-primary-500/20 text-primary-400 border border-primary-500/20 rounded-full px-3 py-1">💳 Book + Pay</span>
                                            <span className="text-xs bg-white/5 text-white/50 border border-white/10 rounded-full px-3 py-1">💺 Seat Lock</span>
                                            <span className="text-xs bg-white/5 text-white/50 border border-white/10 rounded-full px-3 py-1">🎫 My Bookings</span>
                                        </>
                                    )
                                ) : (
                                    <>
                                        <span className="text-xs bg-primary-500/20 text-primary-400 border border-primary-500/20 rounded-full px-3 py-1">🚗 Drive & Earn</span>
                                        <span className="text-xs bg-white/5 text-white/50 border border-white/10 rounded-full px-3 py-1">🎫 Book Rides</span>
                                        <span className="text-xs bg-white/5 text-white/50 border border-white/10 rounded-full px-3 py-1">💳 Pay Securely</span>
                                        <span className="text-xs bg-white/5 text-white/50 border border-white/10 rounded-full px-3 py-1">🩷 Pink Mode</span>
                                    </>
                                )}
                            </div>

                            <div className="mt-5 flex items-center gap-2 text-primary-400 text-sm font-semibold group-hover:gap-3 transition-all">
                                {hasRole
                                    ? (isDriver ? 'Open Driver Dashboard' : 'Find a Carpool')
                                    : 'Get Started'
                                } <span className="text-lg">→</span>
                            </div>
                        </div>
                    </button>
                </div>

                {/* User info strip */}
                <div className="mt-6 flex items-center gap-3 bg-sawaari-card/60 border border-sawaari-border rounded-2xl px-4 py-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-emerald-500 flex items-center justify-center text-white font-bold text-base flex-shrink-0">
                        {user?.username?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm truncate">{user?.username}</p>
                        <p className="text-sawaari-muted text-xs">{user?.gender} · Age {user?.age}</p>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0
            ${hasRole
                            ? (isDriver ? 'bg-primary-500/20 text-primary-400' : 'bg-emerald-500/20 text-emerald-400')
                            : 'bg-white/10 text-white/50'}`}>
                        {hasRole ? (isDriver ? '🚗 Driver' : '🎫 Rider') : '✨ New User'}
                    </span>
                </div>
            </main>
        </div>
    );
}
