import React, { useState } from 'react';
import { Wallet, LogIn } from 'lucide-react';

export const LoginScreen = ({ users, onLogin }) => {
  const [selected, setSelected] = useState('');
  const [newName, setNewName] = useState('');
  const [mode, setMode] = useState('select'); // 'select' | 'new'

  const handleSubmit = (e) => {
    e.preventDefault();
    const name = mode === 'select' ? selected : newName.trim();
    if (name) onLogin(name);
  };

  return (
    <div className="login-wrap">
      <div className="login-card slide-up">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem', boxShadow: '0 8px 30px rgba(79,70,229,0.3)'
          }}>
            <Wallet size={28} color="#fff" />
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700 }}>SplitLedger</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.4rem' }}>
            Track, split & settle shared expenses
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'select' ? (
            <>
              <label className="label">Select your account</label>
              <select
                className="input"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                required
              >
                <option value="">Choose a user...</option>
                {users.map(u => (
                  <option key={u.id} value={u.name}>{u.name}</option>
                ))}
              </select>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1.25rem', justifyContent: 'center' }}>
                <LogIn size={18} /> Sign In
              </button>
              <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.82rem', color: '#64748b' }}>
                New user?{' '}
                <button type="button" onClick={() => setMode('new')} style={{ color: '#818cf8', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>
                  Create account
                </button>
              </p>
            </>
          ) : (
            <>
              <label className="label">Enter your name</label>
              <input
                className="input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Aisha"
                required
              />
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1.25rem', justifyContent: 'center' }}>
                <LogIn size={18} /> Continue
              </button>
              <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.82rem', color: '#64748b' }}>
                Have an account?{' '}
                <button type="button" onClick={() => setMode('select')} style={{ color: '#818cf8', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>
                  Sign in
                </button>
              </p>
            </>
          )}
        </form>
      </div>
    </div>
  );
};
