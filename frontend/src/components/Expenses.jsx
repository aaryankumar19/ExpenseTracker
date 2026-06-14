import React, { useEffect, useState } from 'react';
import { getExpenses, createExpense, getUsers, getExpenseSplits } from '../lib/api';
import { Plus, X, ChevronDown, ChevronRight, Receipt } from 'lucide-react';

export const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [users, setUsers] = useState([]);
  const [splits, setSplits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [form, setForm] = useState(initForm());
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [unequalAmounts, setUnequalAmounts] = useState({});
  const [error, setError] = useState(null);

  function initForm() {
    return { description: '', paid_by: '', amount: '', currency: 'INR', date: new Date().toISOString().split('T')[0], split_type: 'equal', notes: '' };
  }

  const fetchData = async () => {
    try {
      const [e, u, s] = await Promise.all([getExpenses(), getUsers(), getExpenseSplits()]);
      setExpenses(Array.isArray(e) ? e : []);
      setUsers(Array.isArray(u) ? u : []);
      setSplits(Array.isArray(s) ? s : []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleInput = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const toggleUser = (uid) => {
    setSelectedUsers(prev => prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const payload = { ...form, paid_by: parseInt(form.paid_by), amount: parseFloat(form.amount) };

      if (form.split_type === 'equal' && selectedUsers.length > 0) {
        const names = selectedUsers.map(uid => users.find(u => u.id === uid)?.name).filter(Boolean);
        payload.split_with = names.join(', ');
      }
      if (form.split_type === 'unequal') {
        const details = Object.entries(unequalAmounts)
          .filter(([, amt]) => amt && parseFloat(amt) > 0)
          .map(([uid, amt]) => `${users.find(u => u.id === parseInt(uid))?.name}:${amt}`)
          .join(', ');
        payload.split_details = details;
      }

      await createExpense(payload);
      setShowForm(false);
      setForm(initForm());
      setSelectedUsers([]);
      setUnequalAmounts({});
      fetchData();
    } catch (err) { setError(err.message); }
  };

  const payerName = (id) => users.find(u => u.id === id)?.name || `User #${id}`;
  const expenseSplits = (eid) => splits.filter(s => s.expense === eid);
  const perPersonShare = () => {
    const total = parseFloat(form.amount) || 0;
    const payerId = parseInt(form.paid_by);
    const allParticipants = [...new Set([...selectedUsers, payerId].filter(Boolean))];
    return allParticipants.length > 0 ? (total / allParticipants.length).toFixed(2) : '0.00';
  };

  const unequalTotal = Object.values(unequalAmounts).reduce((a, v) => a + (parseFloat(v) || 0), 0);

  if (loading) return <div className="loader"><div className="spinner" /> Loading expenses...</div>;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="page-header">
        <h1 className="page-title">Expenses Ledger</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? <><X size={18} /> Cancel</> : <><Plus size={18} /> Add Expense</>}
        </button>
      </div>

      {/* Add Expense Form */}
      {showForm && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal-content">
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.25rem' }}>New Expense</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="label">Description</label>
                  <input name="description" value={form.description} onChange={handleInput} className="input" placeholder="Dinner, Uber..." required />
                </div>
                <div>
                  <label className="label">Paid By</label>
                  <select name="paid_by" value={form.paid_by} onChange={handleInput} className="input" required>
                    <option value="">Select payer</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Amount</label>
                  <input name="amount" type="number" step="0.01" min="0.01" value={form.amount} onChange={handleInput} className="input" placeholder="0.00" required />
                </div>
                <div>
                  <label className="label">Currency</label>
                  <select name="currency" value={form.currency} onChange={handleInput} className="input">
                    <option value="INR">₹ INR</option>
                    <option value="USD">$ USD</option>
                  </select>
                </div>
                <div>
                  <label className="label">Date</label>
                  <input name="date" type="date" value={form.date} onChange={handleInput} className="input" required />
                </div>
                <div>
                  <label className="label">Split Type</label>
                  <select name="split_type" value={form.split_type} onChange={handleInput} className="input">
                    <option value="equal">Equal Split</option>
                    <option value="unequal">Unequal Split</option>
                  </select>
                </div>
              </div>

              {/* Equal Split – User Checklist */}
              {form.split_type === 'equal' && (
                <div>
                  <label className="label">Split With (select participants)</label>
                  <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: '0.75rem', maxHeight: 180, overflowY: 'auto' }}>
                    {users.map(u => (
                      <div key={u.id} className="checkbox-row" onClick={() => toggleUser(u.id)}>
                        <input type="checkbox" checked={selectedUsers.includes(u.id)} readOnly />
                        <span style={{ fontSize: '0.9rem' }}>{u.name}</span>
                      </div>
                    ))}
                  </div>
                  {selectedUsers.length > 0 && form.amount && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: '#818cf8' }}>
                      Each person pays: <strong>₹{perPersonShare()}</strong> ({selectedUsers.length + (form.paid_by ? 1 : 0)} people)
                    </div>
                  )}
                </div>
              )}

              {/* Unequal Split – Amount Inputs */}
              {form.split_type === 'unequal' && (
                <div>
                  <label className="label">Split Details</label>
                  <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: '0.75rem' }}>
                    {users.map(u => (
                      <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.35rem 0' }}>
                        <span style={{ width: 90, fontSize: '0.9rem', fontWeight: 500 }}>{u.name}</span>
                        <input
                          type="number" step="0.01" min="0" placeholder="0.00"
                          value={unequalAmounts[u.id] || ''}
                          onChange={(e) => setUnequalAmounts(p => ({ ...p, [u.id]: e.target.value }))}
                          className="input" style={{ flex: 1 }}
                        />
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.82rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: Math.abs(unequalTotal - (parseFloat(form.amount) || 0)) < 0.01 ? '#34d399' : '#fb7185' }}>
                      Sum: ₹{unequalTotal.toFixed(2)}
                    </span>
                    <span style={{ color: '#94a3b8' }}>
                      Total: ₹{(parseFloat(form.amount) || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="label">Notes (optional)</label>
                <input name="notes" value={form.notes} onChange={handleInput} className="input" placeholder="Additional details..." />
              </div>

              {error && <div style={{ color: '#fb7185', fontSize: '0.85rem' }}>{error}</div>}
              <button type="submit" className="btn btn-success" style={{ width: '100%', justifyContent: 'center' }}>
                Save Expense
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Expenses Table */}
      {expenses.length === 0 ? (
        <div className="empty-state">
          <Receipt size={48} />
          <p>No expenses logged yet. Add your first expense or import a spreadsheet.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Date</th>
                <th>Description</th>
                <th>Payer</th>
                <th>Amount</th>
                <th>Currency</th>
                <th>Split</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(exp => {
                const isExpanded = expanded === exp.id;
                const relatedSplits = expenseSplits(exp.id);
                return (
                  <React.Fragment key={exp.id}>
                    <tr className="expandable" onClick={() => setExpanded(isExpanded ? null : exp.id)}>
                      <td style={{ width: 36 }}>
                        {isExpanded ? <ChevronDown size={16} color="#94a3b8" /> : <ChevronRight size={16} color="#64748b" />}
                      </td>
                      <td>{exp.date}</td>
                      <td style={{ fontWeight: 500 }}>{exp.description}</td>
                      <td>{payerName(exp.paid_by)}</td>
                      <td style={{ fontWeight: 600 }}>
                        {exp.currency === 'USD' ? '$' : '₹'}{parseFloat(exp.amount).toFixed(2)}
                      </td>
                      <td>{exp.currency}</td>
                      <td><span className="badge badge-blue">{exp.split_type}</span></td>
                    </tr>
                    {isExpanded && (
                      <tr className="split-row">
                        <td colSpan={7}>
                          <div style={{ padding: '0.5rem 0 0.5rem 2.5rem' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.5rem' }}>
                              SPLIT BREAKDOWN
                            </div>
                            {relatedSplits.length > 0 ? relatedSplits.map(sp => (
                              <div key={sp.id} className="split-detail">
                                <span style={{ fontWeight: 500, color: '#e2e8f0' }}>{payerName(sp.user)}</span>
                                <span>owes</span>
                                <span style={{ fontWeight: 600, color: '#fb7185' }}>
                                  {exp.currency === 'USD' ? '$' : '₹'}{parseFloat(sp.amount_owed).toFixed(2)}
                                </span>
                              </div>
                            )) : (
                              <span style={{ color: '#64748b', fontSize: '0.85rem' }}>No split data available</span>
                            )}
                            {exp.notes && (
                              <div style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: '#64748b' }}>
                                📝 {exp.notes}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
