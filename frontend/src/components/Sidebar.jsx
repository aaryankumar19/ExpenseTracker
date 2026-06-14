import React from 'react';
import { LayoutDashboard, Receipt, Upload, ArrowLeftRight, Users, LogOut } from 'lucide-react';

const navItems = [
  { id: 'dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
  { id: 'expenses',    label: 'Expenses',     icon: Receipt },
  { id: 'import',      label: 'Import Center',icon: Upload },
  { id: 'settlements', label: 'Settlements',  icon: ArrowLeftRight },
  { id: 'members',     label: 'Members',      icon: Users },
];

export const Sidebar = ({ current, setCurrent, currentUser, onLogout }) => (
  <nav className="sidebar">
    <div className="sidebar-brand">
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect width="28" height="28" rx="8" fill="#4f46e5" />
        <path d="M8 14h12M14 8v12" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <h1>SplitLedger</h1>
    </div>

    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      {navItems.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className={`nav-item${current === id ? ' active' : ''}`}
          onClick={() => setCurrent(id)}
        >
          <Icon />
          <span>{label}</span>
        </button>
      ))}
    </div>

    <div className="sidebar-footer">
      {currentUser && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{currentUser}</div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Logged in</div>
          </div>
          <button onClick={onLogout} className="btn btn-ghost btn-sm" title="Log out">
            <LogOut size={16} />
          </button>
        </div>
      )}
    </div>
  </nav>
);
