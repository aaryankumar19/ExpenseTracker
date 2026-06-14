import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { LoginScreen } from './components/LoginScreen';
import { Dashboard } from './components/Dashboard';
import { Expenses } from './components/Expenses';
import { Importer } from './components/Importer';
import { Settlements } from './components/Settlements';
import { Members } from './components/Members';
import { getUsers } from './lib/api';

export const App = () => {
  const [currentUser, setCurrentUser] = useState(localStorage.getItem('splitledger_user'));
  const [users, setUsers] = useState([]);
  const [current, setCurrent] = useState('dashboard');
  const [settlePrefill, setSettlePrefill] = useState(null);

  useEffect(() => {
    getUsers().then(u => setUsers(Array.isArray(u) ? u : [])).catch(() => {});
  }, []);

  const handleLogin = (name) => {
    localStorage.setItem('splitledger_user', name);
    setCurrentUser(name);
  };

  const handleLogout = () => {
    localStorage.removeItem('splitledger_user');
    setCurrentUser(null);
  };

  const handleSettleUp = (from, to, amount) => {
    setSettlePrefill({ payer: from, receiver: to, amount });
    setCurrent('settlements');
  };

  if (!currentUser) {
    return <LoginScreen users={users} onLogin={handleLogin} />;
  }

  const renderSection = () => {
    switch (current) {
      case 'dashboard':   return <Dashboard onSettleUp={handleSettleUp} />;
      case 'expenses':    return <Expenses />;
      case 'import':      return <Importer />;
      case 'settlements': return <Settlements prefill={settlePrefill} />;
      case 'members':     return <Members />;
      default:            return <Dashboard onSettleUp={handleSettleUp} />;
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0b0f19', color: '#e2e8f0' }}>
      <Sidebar current={current} setCurrent={(v) => { setCurrent(v); setSettlePrefill(null); }} currentUser={currentUser} onLogout={handleLogout} />
      <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        {renderSection()}
      </main>
    </div>
  );
};

export default App;