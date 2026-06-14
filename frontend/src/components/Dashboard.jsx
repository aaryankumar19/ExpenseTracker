import React, { useEffect, useState } from 'react';
import { getBalances, getRecommendedSettlements, getExpenses } from '../lib/api';
import { TrendingUp, TrendingDown, Receipt, ArrowRight } from 'lucide-react';

export const Dashboard = ({ onSettleUp }) => {
  const [balances, setBalances] = useState({});
  const [settlements, setSettlements] = useState([]);
  const [expenseCount, setExpenseCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getBalances(), getRecommendedSettlements(), getExpenses()])
      .then(([b, s, e]) => { setBalances(b); setSettlements(s); setExpenseCount(Array.isArray(e) ? e.length : 0); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loader"><div className="spinner" /> Loading dashboard...</div>;

  const entries = Object.entries(balances);
  const totalCredit = entries.filter(([,v]) => v > 0).reduce((a,[,v]) => a + v, 0);
  const totalDebt   = entries.filter(([,v]) => v < 0).reduce((a,[,v]) => a + v, 0);
  const maxAbs = Math.max(...entries.map(([,v]) => Math.abs(v)), 1);

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="stat-card emerald">
          <TrendingUp size={24} style={{ margin: '0 auto 0.5rem', color: '#34d399' }} />
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>Total Credit</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#34d399' }}>₹{totalCredit.toFixed(2)}</div>
        </div>
        <div className="stat-card rose">
          <TrendingDown size={24} style={{ margin: '0 auto 0.5rem', color: '#fb7185' }} />
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>Total Debt</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fb7185' }}>₹{Math.abs(totalDebt).toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <Receipt size={24} style={{ margin: '0 auto 0.5rem', color: '#818cf8' }} />
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>Total Expenses</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{expenseCount}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Balances Leaderboard */}
        <div className="glass-strong" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>Balances Leaderboard</h2>
          {entries.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No balances yet.</p>
          ) : (
            <div>
              {entries
                .sort(([,a],[,b]) => b - a)
                .map(([name, amt]) => (
                <div key={name} className="balance-row">
                  <div className="balance-name">{name}</div>
                  <div className="balance-bar-wrap">
                    <div className="balance-bar-center" />
                    <div
                      className={`balance-bar ${amt >= 0 ? 'positive' : 'negative'}`}
                      style={{ width: `${(Math.abs(amt) / maxAbs) * 45}%` }}
                    />
                  </div>
                  <div className="balance-amount" style={{ color: amt > 0 ? '#34d399' : amt < 0 ? '#fb7185' : '#64748b' }}>
                    {amt > 0 ? '+' : ''}{amt.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recommended Settlements */}
        <div className="glass-strong" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>Smart Paybacks</h2>
          {settlements.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>All settled up! 🎉</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {settlements.map((s, i) => (
                <div key={i} className="settle-card">
                  <div className="settle-flow">
                    <span style={{ fontWeight: 600, color: '#fb7185' }}>{s.from}</span>
                    <ArrowRight size={16} className="arrow" />
                    <span style={{ fontWeight: 600, color: '#34d399' }}>{s.to}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '1rem' }}>₹{s.amount.toFixed(2)}</span>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => onSettleUp && onSettleUp(s.from, s.to, s.amount)}
                    >
                      Settle Up
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
