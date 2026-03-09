import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const TYPE_ICON = {
    credit: '🟢', debit: '🔴', cancellation_fee: '🟡', cancellation_refund: '🟢',
    ride_payment: '🔴', ride_earning: '🟢', welcome_bonus: '🎉', penalty: '🟡',
};

function fmt(n) {
    return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function WalletPage() {
    const navigate = useNavigate();
    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [addAmount, setAddAmount] = useState('');
    const [adding, setAdding] = useState(false);
    const [addMsg, setAddMsg] = useState('');

    const fetchWallet = useCallback(async () => {
        try {
            const res = await api.get('/wallet');
            setBalance(res.data.balance || 0);
            setTransactions(res.data.transactions || []);
        } catch { /* silent */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchWallet(); }, [fetchWallet]);

    async function handleAddMoney(e) {
        e.preventDefault();
        const amt = parseFloat(addAmount);
        if (!amt || amt <= 0) return;
        setAdding(true);
        setAddMsg('');
        try {
            // Simulate UPI processing animation
            await new Promise(r => setTimeout(r, 1200));
            const res = await api.post('/wallet/add-money', { amount: amt });
            setBalance(res.data.balance);
            setAddMsg(`✅ ₩${fmt(amt)} added successfully!`);
            setAddAmount('');
            fetchWallet();
            setTimeout(() => { setShowAdd(false); setAddMsg(''); }, 2000);
        } catch (err) {
            setAddMsg('❌ ' + (err.response?.data?.error || 'Failed to add money'));
        } finally {
            setAdding(false);
        }
    }

    function formatTime(ts) {
        if (!ts) return '';
        const d = new Date(ts);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
            ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    }

    return (
        <div className="min-h-screen bg-sawaari-dark">
            <header className="sticky top-0 z-50 bg-sawaari-dark/80 backdrop-blur-xl border-b border-sawaari-border">
                <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center gap-3">
                    <button onClick={() => navigate('/home')} className="text-sawaari-muted hover:text-white transition-colors">←</button>
                    <div>
                        <span className="text-xs text-sawaari-muted block">Sawaari</span>
                        <span className="text-white font-bold text-sm">💰 Sawaari Money</span>
                    </div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-6 space-y-5 animate-fade-in">
                {loading ? (
                    <div className="text-sawaari-muted text-center py-10 animate-pulse">Loading wallet...</div>
                ) : (
                    <>
                        {/* Balance Card */}
                        <div className="rounded-2xl overflow-hidden" style={{
                            background: 'linear-gradient(135deg, #1a0533, #0f172a)',
                            border: '1px solid rgba(139,92,246,0.3)',
                            boxShadow: '0 20px 60px rgba(139,92,246,0.2)',
                        }}>
                            <div className="px-6 pt-6 pb-4">
                                <p className="text-sawaari-muted text-xs mb-1 uppercase tracking-widest">Sawaari Money Balance</p>
                                <div className="flex items-end gap-2">
                                    <span className="text-4xl font-black text-white">₩</span>
                                    <span className="text-5xl font-black text-white">{fmt(balance)}</span>
                                </div>
                                <p className="text-purple-300/60 text-xs mt-3">
                                    ℹ️ Sawaari Money can be converted to real money via any UPI app (production feature)
                                </p>
                            </div>

                            <div className="px-6 pb-5 flex gap-3">
                                <button
                                    onClick={() => setShowAdd(true)}
                                    className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white transition-all"
                                    style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
                                >
                                    + Add Money
                                </button>
                                <button
                                    onClick={() => document.getElementById('tx-history').scrollIntoView({ behavior: 'smooth' })}
                                    className="flex-1 py-2.5 rounded-xl font-semibold text-sm border border-purple-500/30 text-purple-300 hover:bg-purple-500/10 transition-all"
                                >
                                    📋 History
                                </button>
                            </div>
                        </div>

                        {/* Policy info */}
                        <div className="card text-sm space-y-2">
                            <h3 className="text-white font-semibold">💡 About Sawaari Money</h3>
                            <p className="text-sawaari-muted text-xs leading-relaxed">
                                Sawaari Money (₩) is used for all ride payments, cancellation fees, and driver compensation within the app.
                                New users receive ₩1,000 as a welcome bonus.
                            </p>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                {[
                                    { icon: '🎁', label: 'Welcome Bonus', val: '₩1,000' },
                                    { icon: '✅', label: 'Free Cancel', val: '>24h before' },
                                    { icon: '⚠️', label: 'Late Cancel', val: 'Up to 75% fee' },
                                    { icon: '🔄', label: 'Convert to', val: 'UPI / Bank' },
                                ].map(({ icon, label, val }) => (
                                    <div key={label} className="bg-sawaari-dark rounded-xl p-3 border border-sawaari-border">
                                        <span className="text-lg">{icon}</span>
                                        <p className="text-sawaari-muted text-[10px] mt-1">{label}</p>
                                        <p className="text-white text-xs font-semibold">{val}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Transaction History */}
                        <div id="tx-history">
                            <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                                📋 Transaction History
                                <span className="badge">{transactions.length}</span>
                            </h3>
                            {transactions.length === 0 ? (
                                <div className="card text-center py-10">
                                    <div className="text-4xl mb-3">📋</div>
                                    <p className="text-sawaari-muted text-sm">No transactions yet</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {transactions.map(tx => (
                                        <div key={tx.id} className="card animate-slide-up flex items-center gap-4">
                                            <span className="text-xl flex-shrink-0">{TYPE_ICON[tx.type] || '💰'}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white text-sm font-medium truncate">{tx.description || tx.type}</p>
                                                <p className="text-sawaari-muted text-xs mt-0.5">{formatTime(tx.created_at)}</p>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className={`font-bold text-sm ${tx.type === 'credit' || tx.type === 'welcome_bonus' || tx.type === 'cancellation_refund' || tx.type === 'ride_earning' ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    {tx.type === 'credit' || tx.type === 'welcome_bonus' || tx.type === 'cancellation_refund' || tx.type === 'ride_earning' ? '+' : '-'}₩{fmt(tx.amount)}
                                                </p>
                                                <p className="text-sawaari-muted text-[10px] mt-0.5">Bal: ₩{fmt(tx.balance_after)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </main>

            {/* Add Money Modal */}
            {showAdd && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { setShowAdd(false); setAddMsg(''); }} />
                    <div className="relative w-full max-w-sm bg-sawaari-card rounded-2xl border border-sawaari-border shadow-2xl animate-slide-up p-6 space-y-4">
                        <div className="text-center">
                            <div className="text-4xl mb-2">💳</div>
                            <h3 className="text-white font-bold text-lg">Add Sawaari Money</h3>
                            <p className="text-sawaari-muted text-xs mt-1">Prototype: Simulated UPI top-up</p>
                        </div>

                        <form onSubmit={handleAddMoney} className="space-y-4">
                            <div>
                                <label className="label">Amount (₩)</label>
                                <input
                                    type="number" min="1" max="50000" step="100"
                                    value={addAmount}
                                    onChange={e => setAddAmount(e.target.value)}
                                    placeholder="e.g. 500"
                                    className="input-field text-xl font-bold"
                                    autoFocus
                                />
                            </div>

                            {/* Preset amounts */}
                            <div className="grid grid-cols-4 gap-2">
                                {[100, 500, 1000, 2000].map(amt => (
                                    <button key={amt} type="button" onClick={() => setAddAmount(String(amt))}
                                        className={`py-2 rounded-xl border text-sm font-semibold transition-all
                                            ${addAmount === String(amt) ? 'bg-primary-500 border-primary-400 text-white' : 'border-sawaari-border text-sawaari-muted hover:text-white'}`}>
                                        ₩{amt}
                                    </button>
                                ))}
                            </div>

                            {addMsg && (
                                <p className={`text-sm text-center py-2 rounded-xl ${addMsg.includes('✅') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                    {addMsg}
                                </p>
                            )}

                            <button type="submit" disabled={adding || !addAmount}
                                className="btn-primary w-full">
                                {adding ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Processing via UPI...
                                    </span>
                                ) : `Pay ₩${addAmount || '0'} via UPI / Bank`}
                            </button>
                            <p className="text-sawaari-muted text-[10px] text-center">
                                🔒 In production, this connects to your UPI app. This is a prototype simulation.
                            </p>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
