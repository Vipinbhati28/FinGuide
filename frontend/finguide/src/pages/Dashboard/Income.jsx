import React, { useEffect, useMemo, useState } from 'react'
import DashboardLayout from '../../components/layouts/DashboardLayout';
import axiosInstance from '../../utils/axiosInstance';
import { API_PATHS } from '../../utils/apiPaths';
import moment from 'moment';
import TransactionInfoCard from '../../components/Cards/TransactionInfoCard';
import { useSearchParams, useNavigate } from 'react-router-dom';

const ranges = [
  { label: '1 Week', value: '7d' },
  { label: '1 Month', value: '30d' },
  { label: 'All', value: '' },
];

const Income = () => {
  const [source, setSource] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(moment().format('YYYY-MM-DD'));
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const range = searchParams.get('range') ?? '7d';

  const setRange = (val) => {
    const next = new URLSearchParams(searchParams);
    if (val) next.set('range', val); else next.delete('range');
    setSearchParams(next, { replace: true });
  };

  const fetchIncome = async () => {
    const params = range ? { range } : {};
    const res = await axiosInstance.get(API_PATHS.INCOME.GET_ALL_INCOME, { params });
    setItems(res.data || []);
  };

  useEffect(() => {
    fetchIncome();
  }, [range]);

  const onAdd = async (e) => {
    e.preventDefault();
    if (!source || !amount || !date) {
      setError('Please fill all fields');
      return;
    }
    setError("");
    setLoading(true);
    try {
      await axiosInstance.post(API_PATHS.INCOME.ADD_INCOME, {
        source,
        amount: Number(amount),
        date,
      });
      setSource("");
      setAmount("");
      setDate(moment().format('YYYY-MM-DD'));
      await fetchIncome();
    } catch (err) {
      setError('Failed to add income');
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async (id) => {
    await axiosInstance.delete(API_PATHS.INCOME.DELETE_INCOME(id));
    await fetchIncome();
  };

  const total = useMemo(() => items.reduce((s, i) => s + (i.amount || 0), 0), [items]);

  return (
    <DashboardLayout activeMenu="Income">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <form onSubmit={onAdd} className="card lg:col-span-1">
          <h5 className="text-lg mb-4">Add Income</h5>
          <div className="grid gap-3">
            <input className="input" placeholder="Source" value={source} onChange={e => setSource(e.target.value)} />
            <input className="input" placeholder="Amount" type="number" value={amount} onChange={e => setAmount(e.target.value)} />
            <input className="input" placeholder="Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button disabled={loading} className="btn-primary">{loading ? 'Adding...' : 'Add Income'}</button>
          </div>
        </form>

        <div className="lg:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between">
              <h5 className="text-lg">Income Transactions</h5>
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
                  title={it.source}
                  icon={it.icon}
                  date={moment(it.date).format('DD MMM YYYY')}
                  amount={it.amount}
                  type="income"
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

export default Income