import React, { useEffect, useMemo, useState } from 'react'
import DashboardLayout from '../../components/layouts/DashboardLayout';
import axiosInstance from '../../utils/axiosInstance';
import { API_PATHS } from '../../utils/apiPaths';
import moment from 'moment';
import TransactionInfoCard from '../../components/Cards/TransactionInfoCard';
import { useSearchParams } from 'react-router-dom';

const ranges = [
  { label: '1 Week', value: '7d' },
  { label: '1 Month', value: '30d' },
  { label: 'All', value: '' },
];

const Expense = () => {
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(moment().format('YYYY-MM-DD'));
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();

  const range = searchParams.get('range') ?? '7d';

  const setRange = (val) => {
    const next = new URLSearchParams(searchParams);
    if (val) next.set('range', val); else next.delete('range');
    setSearchParams(next, { replace: true });
  };

  const fetchExpense = async () => {
    const params = range ? { range } : {};
    const res = await axiosInstance.get(API_PATHS.EXPENSE.GET_ALL_EXPENSE, { params });
    setItems(res.data || []);
  };

  useEffect(() => {
    fetchExpense();
  }, [range]);

  const onAdd = async (e) => {
    e.preventDefault();
    if (!category || !amount || !date) {
      setError('Please fill all fields');
      return;
    }
    setError("");
    setLoading(true);
    try {
      await axiosInstance.post(API_PATHS.EXPENSE.ADD_EXPENSE, {
        category,
        amount: Number(amount),
        date,
      });
      setCategory("");
      setAmount("");
      setDate(moment().format('YYYY-MM-DD'));
      await fetchExpense();
    } catch (err) {
      setError('Failed to add expense');
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async (id) => {
    await axiosInstance.delete(API_PATHS.EXPENSE.DELETE_EXPENSE(id));
    await fetchExpense();
  };

  const total = useMemo(() => items.reduce((s, i) => s + (i.amount || 0), 0), [items]);

  return (
    <DashboardLayout activeMenu="Expense">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <form onSubmit={onAdd} className="card lg:col-span-1">
          <h5 className="text-lg mb-4">Add Expense</h5>
          <div className="grid gap-3">
            <input className="input" placeholder="Category" value={category} onChange={e => setCategory(e.target.value)} />
            <input className="input" placeholder="Amount" type="number" value={amount} onChange={e => setAmount(e.target.value)} />
            <input className="input" placeholder="Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button disabled={loading} className="btn-primary">{loading ? 'Adding...' : 'Add Expense'}</button>
          </div>
        </form>

        <div className="lg:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between">
              <h5 className="text-lg">Expense Transactions</h5>
              <div className="flex gap-2">
                {ranges.map(r => (
                  <button key={r.value} className={`chip ${range===r.value?'chip-active':''}`} onClick={() => setRange(r.value)}>{r.label}</button>
                ))}
              </div>
            </div>
            <div className="mt-3 text-sm text-slate-600">Total: {total}</div>
            <div className="mt-4">
              {items.map(it => (
                <TransactionInfoCard
                  key={it._id}
                  title={it.category}
                  icon={it.icon}
                  date={moment(it.date).format('DD MMM YYYY')}
                  amount={it.amount}
                  type="expense"
                  onDelete={() => onDelete(it._id)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default Expense