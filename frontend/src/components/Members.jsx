import React, { useEffect, useState } from 'react';
import { getUsers, createUser, getGroups, createGroup, getMemberships, createMembership } from '../lib/api';
import { UserPlus, Plus, Users as UsersIcon, Building2, Link } from 'lucide-react';

export const Members = () => {
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('users'); // 'users' | 'groups' | 'memberships'
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});
  const [error, setError] = useState(null);

  const fetchAll = async () => {
    try {
      const [u, g, m] = await Promise.all([getUsers(), getGroups(), getMemberships()]);
      setUsers(Array.isArray(u) ? u : []);
      setGroups(Array.isArray(g) ? g : []);
      setMemberships(Array.isArray(m) ? m : []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(null);
    try {
      if (tab === 'users') await createUser({ name: form.name });
      else if (tab === 'groups') await createGroup({ name: form.name });
      else await createMembership({
        user: parseInt(form.user),
        group: parseInt(form.group),
        joined_at: form.joined_at,
        ...(form.left_at ? { left_at: form.left_at } : {}),
      });
      setShowForm(false); setForm({});
      fetchAll();
    } catch (err) { setError(err.message); }
  };

  const tabStyle = (t) => `btn ${tab === t ? 'btn-primary' : 'btn-ghost'} btn-sm`;
  const userName = (id) => users.find(u => u.id === id)?.name || `#${id}`;
  const groupName = (id) => groups.find(g => g.id === id)?.name || `#${id}`;

  if (loading) return <div className="loader"><div className="spinner" /> Loading...</div>;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="page-header">
        <h1 className="page-title">Members & Groups</h1>
        <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setError(null); setForm({}); }}>
          {showForm ? 'Cancel' : <><Plus size={18} /> Add New</>}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button className={tabStyle('users')} onClick={() => { setTab('users'); setShowForm(false); }}>
          <UsersIcon size={14} /> Users ({users.length})
        </button>
        <button className={tabStyle('groups')} onClick={() => { setTab('groups'); setShowForm(false); }}>
          <Building2 size={14} /> Groups ({groups.length})
        </button>
        <button className={tabStyle('memberships')} onClick={() => { setTab('memberships'); setShowForm(false); }}>
          <Link size={14} /> Memberships ({memberships.length})
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="glass-strong" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 440 }}>
          <h3 style={{ fontWeight: 700 }}>
            {tab === 'users' ? 'Add User' : tab === 'groups' ? 'Add Group' : 'Add Membership'}
          </h3>

          {(tab === 'users' || tab === 'groups') && (
            <div>
              <label className="label">Name</label>
              <input className="input" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={tab === 'users' ? 'e.g. Aisha' : 'e.g. Flatmates'} required />
            </div>
          )}

          {tab === 'memberships' && (
            <>
              <div>
                <label className="label">User</label>
                <select className="input" value={form.user || ''} onChange={e => setForm({ ...form, user: e.target.value })} required>
                  <option value="">Select user</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Group</label>
                <select className="input" value={form.group || ''} onChange={e => setForm({ ...form, group: e.target.value })} required>
                  <option value="">Select group</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Joined At</label>
                <input className="input" type="date" value={form.joined_at || ''} onChange={e => setForm({ ...form, joined_at: e.target.value })} required />
              </div>
              <div>
                <label className="label">Left At (optional)</label>
                <input className="input" type="date" value={form.left_at || ''} onChange={e => setForm({ ...form, left_at: e.target.value })} />
              </div>
            </>
          )}

          {error && <div style={{ color: '#fb7185', fontSize: '0.85rem' }}>{error}</div>}
          <button type="submit" className="btn btn-success" style={{ justifyContent: 'center' }}>Save</button>
        </form>
      )}

      {/* Content */}
      {tab === 'users' && (
        users.length === 0 ? <div className="empty-state"><UsersIcon size={48} /><p>No users yet.</p></div> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
            {users.map(u => (
              <div key={u.id} className="glass" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #4f46e5, #818cf8)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '0.9rem', flexShrink: 0,
                }}>
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{u.name}</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>ID: {u.id}</div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'groups' && (
        groups.length === 0 ? <div className="empty-state"><Building2 size={48} /><p>No groups yet.</p></div> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
            {groups.map(g => (
              <div key={g.id} className="glass" style={{ padding: '1.25rem' }}>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '0.3rem' }}>{g.name}</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  {memberships.filter(m => m.group === g.id).length} members
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'memberships' && (
        memberships.length === 0 ? <div className="empty-state"><Link size={48} /><p>No memberships yet.</p></div> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>User</th><th>Group</th><th>Joined</th><th>Left</th><th>Status</th></tr>
              </thead>
              <tbody>
                {memberships.map(m => (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 500 }}>{userName(m.user)}</td>
                    <td>{groupName(m.group)}</td>
                    <td>{m.joined_at}</td>
                    <td>{m.left_at || '—'}</td>
                    <td>
                      <span className={`badge ${m.left_at ? 'badge-gray' : 'badge-emerald'}`}>
                        {m.left_at ? 'Left' : 'Active'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
};
