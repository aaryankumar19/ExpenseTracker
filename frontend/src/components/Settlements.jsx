import React, { useEffect, useState } from 'react';
import { getSettlements, createSettlement, getUsers } from '../lib/api';
import { Plus, X, ArrowRight, ArrowLeftRight } from 'lucide-react';

export const Settlements = ({ prefill }) => {
  const [settlements, setSettlements] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(!!prefill);
  const [form, setForm] = useState({
    payer: prefill?.payer || '',
    receiver: prefill?.receiver || '',
    amount: prefill?.amount || '',
    date: new Date().toISOString().split('T')[0],
  });
  const [error, setError] = useState(null);

  const fetchData = async () => {
    try {
      const [s, u] = await Promise.all([getSettlements(), getUsers()]);
      setSettlements(Array.isArray(s) ? s : []);
      setUsers(Array.isArray(u) ? u : []);
      // Map prefill names to user IDs
      if (prefill && u.length > 0) {
        const payerUser = u.find(x => x.name === prefill.payer);
        const receiverUser = u.find(x => x.name === prefill.receiver);
        setForm(f => ({
          ...f,
          payer: payerUser ? String(payerUser.id) : f.payer,
          receiver: receiverUser ? String(receiverUser.id) : f.receiver,
          amount: prefill.amount ? String(prefill.amount) : f.amount,
        }));
        setShowForm(true);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleInput = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(null);
    if (form.payer === form.receiver) { setError('Payer and receiver must be different.'); return; }
    try {
      await createSettlement({
        payer: parseInt(form.payer),
        receiver: parseInt(form.receiver),
        amount: parseFloat(form.amount),
        date: form.date,
      });
      setShowForm(false);
      setForm({ payer: '', receiver: '', amount: '', date: new Date().toISOString().split('T')[0] });
      fetchData();
    } catch (err) { setError(err.message); }
  };

  const userName = (id) => users.find(u => u.id === id)?.name || `User #${id}`;

  if (loading) return <div className="loader"><div className="spinner" /> Loading settlements...</div>;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="page-header">
        <h1 className="page-title">Settlements</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? <><X size={18} /> Cancel</> : <><Plus size={18} /> Record Settlement</>}
        </button>
      </div>

      {/* Record Settlement Form */}
      {showForm && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal-content">
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.25rem' }}>Record Payment</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="label">Payer (who paid)</label>
                <select name="payer" value={form.payer} onChange={handleInput} className="input" required>
                  <option value="">Select payer</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Receiver (who received)</label>
                <select name="receiver" value={form.receiver} onChange={handleInput} className="input" required>
                  <option value="">Select receiver</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Amount</label>
                <input name="amount" type="number" step="0.01" min="0.01" value={form.amount} onChange={handleInput} className="input" placeholder="0.00" required />
              </div>
              <div>
                <label className="label">Date</label>
                <input name="date" type="date" value={form.date} onChange={handleInput} className="input" required />
              </div>
              {error && <div style={{ color: '#fb7185', fontSize: '0.85rem' }}>{error}</div>}
              <button type="submit" className="btn btn-success" style={{ width: '100%', justifyContent: 'center' }}>
                Record Settlement
              </button>
            </form>
          </div>
        </div>
      )}

      {/* History */}
      {settlements.length === 0 ? (
        <div className="empty-state">
          <ArrowLeftRight size={48} />
          <p>No settlements recorded yet.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>From</th>
                <th></th>
                <th>To</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {settlements.map(s => (
                <tr key={s.id}>
                  <td>{s.date}</td>
                  <td style={{ fontWeight: 500 }}>{userName(s.payer)}</td>
                  <td style={{ textAlign: 'center' }}><ArrowRight size={16} color="#64748b" /></td>
                  <td style={{ fontWeight: 500 }}>{userName(s.receiver)}</td>
                  <td style={{ fontWeight: 700, color: '#34d399' }}>₹{parseFloat(s.amount).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
