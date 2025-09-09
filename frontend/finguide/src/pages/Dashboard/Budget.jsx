import React, { useEffect, useMemo, useState } from 'react'
import DashboardLayout from '../../components/layouts/DashboardLayout';
import axiosInstance from '../../utils/axiosInstance';
import { API_PATHS } from '../../utils/apiPaths';
import moment from 'moment';

const Budget = () => {
  const [amount, setAmount] = useState("");
  const [startDate, setStartDate] = useState(moment().format('YYYY-MM-DD'));
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchBudgets = async () => {
    const res = await axiosInstance.get(API_PATHS.BUDGET.GET);
    setItems(res.data || []);
  };

  useEffect(() => { fetchBudgets(); }, []);

  const onAdd = async (e) => {
    e.preventDefault();
    if (!amount) { setError('Please enter amount'); return; }
    setError("");
    setLoading(true);
    try {
      await axiosInstance.post(API_PATHS.BUDGET.ADD, { amount: Number(amount), startDate });
      setAmount("");
      setStartDate(moment().format('YYYY-MM-DD'));
      await fetchBudgets();
    } catch (e) { setError('Failed to add budget'); }
    finally { setLoading(false); }
  };

  const onDelete = async (id) => {
    await axiosInstance.delete(API_PATHS.BUDGET.DELETE(id));
    await fetchBudgets();
  };

  return (
    <DashboardLayout activeMenu="Budget">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <form onSubmit={onAdd} className="card lg:col-span-1">
          <h5 className="text-lg mb-4">Set Monthly (30-day) Budget</h5>
          <div className="grid gap-3">
            <input className="input" placeholder="Total Budget Amount" type="number" value={amount} onChange={e => setAmount(e.target.value)} />
            <input className="input" placeholder="Start Date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button disabled={loading} className="btn-primary">{loading ? 'Saving...' : 'Save Budget'}</button>
          </div>
        </form>

        <div className="lg:col-span-2 card">
          <h5 className="text-lg">Budgets</h5>
          <div className="mt-4">
            {items.map(b => (
              <div key={b._id} className="flex items-center justify-between py-2 border-b border-gray-100">
                <div>
                  <div className="font-medium">Total: {b.amount}</div>
                  <div className="text-xs text-slate-600">{moment(b.startDate).format('DD MMM')} - {moment(b.endDate).format('DD MMM')}</div>
                </div>
                <button className="chip" onClick={() => onDelete(b._id)}>Delete</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default Budget
