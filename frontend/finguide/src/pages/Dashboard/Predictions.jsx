import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { useUserAuth } from '../../hooks/useUserAuth';
import axiosInstance from '../../utils/axiosInstance';
import { API_PATHS } from '../../utils/apiPaths';
import PredictionChart from '../../components/AI/PredictionChart';
import { addThousandsSeparator } from '../../utils/helper';
import {
    LuTrendingUp,
    LuTrendingDown,
    LuMinus,
    LuRefreshCw,
    LuTarget,
    LuCalendarDays,
    LuActivity,
} from 'react-icons/lu';

const trendConfig = {
    increasing: { icon: LuTrendingUp,   color: 'text-red-500',     label: 'Increasing',  bg: 'bg-red-50'     },
    decreasing: { icon: LuTrendingDown, color: 'text-emerald-500', label: 'Decreasing',  bg: 'bg-emerald-50' },
    stable:     { icon: LuMinus,        color: 'text-blue-500',    label: 'Stable',       bg: 'bg-blue-50'    },
};

const StatCard = ({ label, value, sub, color = 'text-gray-900' }) => (
    <div className="card text-center">
        <p className="text-xs text-slate-500 mb-1">{label}</p>
        <p className={`text-2xl font-bold ${color}`}>₹{addThousandsSeparator(value ?? 0)}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
);

const ConfidenceBadge = ({ confidence }) => {
    const pct = confidence ?? 0;
    const color = pct >= 60 ? 'bg-emerald-100 text-emerald-700'
        : pct >= 30         ? 'bg-yellow-100 text-yellow-700'
        :                     'bg-red-100 text-red-700';
    return (
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
            <LuActivity className="text-xs" />
            {pct}% confidence
        </span>
    );
};

const Predictions = () => {
    useUserAuth();

    const [current,    setCurrent]    = useState(null);
    const [history,    setHistory]    = useState([]);
    const [loading,    setLoading]    = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error,      setError]      = useState(null);

    const fetchAll = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true); else setLoading(true);
        setError(null);

        try {
            const [curRes, histRes] = await Promise.all([
                axiosInstance.get(API_PATHS.PREDICTIONS.CURRENT),
                axiosInstance.get(API_PATHS.PREDICTIONS.HISTORY),
            ]);
            setCurrent(curRes.data);
            setHistory(histRes.data.history || []);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load predictions.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { fetchAll(); }, []);

    const trend = trendConfig[current?.trend] ?? trendConfig.stable;
    const TrendIcon = trend.icon;

    return (
        <DashboardLayout activeMenu="Predictions">
            <div className="space-y-5">
                {/* Page Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Expense Predictions</h1>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Statistical forecast using moving average + linear regression
                        </p>
                    </div>
                    <button
                        onClick={() => fetchAll(true)}
                        disabled={refreshing}
                        className="btn-primary flex items-center gap-2 text-sm py-2 px-4"
                    >
                        <LuRefreshCw className={`text-sm ${refreshing ? 'animate-spin' : ''}`} />
                        {refreshing ? 'Refreshing…' : 'Refresh'}
                    </button>
                </div>

                {/* Error */}
                {error && !loading && (
                    <div className="card bg-red-50 border border-red-100 text-red-700 text-sm text-center py-6">
                        {error}
                    </div>
                )}

                {/* Loading skeleton */}
                {loading && (
                    <div className="space-y-4 animate-pulse">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {[1, 2, 3].map(i => <div key={i} className="card h-24 bg-gray-50" />)}
                        </div>
                        <div className="card h-64 bg-gray-50" />
                    </div>
                )}

                {/* Main content */}
                {!loading && current && (
                    <>
                        {/* Forecast header */}
                        <div className="card bg-gradient-to-br from-primary/5 to-purple-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <LuCalendarDays className="text-primary" />
                                    <span className="text-sm font-semibold text-gray-700">
                                        Forecast for {current.forecastMonth}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 flex-wrap">
                                    <ConfidenceBadge confidence={current.confidence} />
                                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${trend.bg} ${trend.color}`}>
                                        <TrendIcon className="text-xs" />
                                        {trend.label}
                                    </span>
                                    <span className="text-xs text-slate-400">
                                        Based on {current.dataMonths} month{current.dataMonths !== 1 ? 's' : ''} of data
                                        · {current.algorithm?.replace('_', ' ')}
                                    </span>
                                </div>
                            </div>

                            {/* Budget Suggestion */}
                            <div className="flex items-center gap-3 bg-white/60 rounded-xl px-4 py-3 border border-primary/10">
                                <LuTarget className="text-primary text-2xl flex-shrink-0" />
                                <div>
                                    <p className="text-xs text-slate-500">Suggested Budget</p>
                                    <p className="text-lg font-bold text-primary">
                                        ₹{addThousandsSeparator(Math.round(current.predictedExpense * 1.05))}
                                    </p>
                                    <p className="text-[10px] text-slate-400">5% buffer above predicted</p>
                                </div>
                            </div>
                        </div>

                        {/* Stat cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <StatCard
                                label="Predicted Expense"
                                value={current.predictedExpense}
                                sub={current.wmaPrediction ? `WMA: ₹${addThousandsSeparator(current.wmaPrediction)}` : null}
                                color="text-red-600"
                            />
                            <StatCard
                                label="Predicted Savings"
                                value={current.predictedSavings}
                                sub={current.monthlyIncome ? `From ₹${addThousandsSeparator(current.monthlyIncome)} income` : null}
                                color="text-emerald-600"
                            />
                            <StatCard
                                label="LR Prediction"
                                value={current.lrPrediction ?? current.predictedExpense}
                                sub="Linear regression estimate"
                                color="text-primary"
                            />
                        </div>

                        {/* Charts */}
                        <div className="card">
                            <PredictionChart
                                history={history}
                                categories={current.categoryPredictions || []}
                            />
                        </div>

                        {/* Category Predictions Table */}
                        {current.categoryPredictions?.length > 0 && (
                            <div className="card">
                                <h6 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                                    Category Breakdown
                                </h6>
                                <div className="divide-y divide-gray-50">
                                    {current.categoryPredictions.map((cat, i) => (
                                        <div key={i} className="flex items-center justify-between py-2.5">
                                            <span className="text-sm text-gray-700">{cat.category}</span>
                                            <span className="text-sm font-semibold text-gray-900">
                                                ₹{addThousandsSeparator(cat.predictedAmount)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* History accuracy table */}
                        {history.some(h => h.actualExpense !== null) && (
                            <div className="card">
                                <h6 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                                    Prediction Accuracy History
                                </h6>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="text-slate-400 border-b">
                                                <th className="text-left py-2 font-medium">Month</th>
                                                <th className="text-right py-2 font-medium">Predicted</th>
                                                <th className="text-right py-2 font-medium">Actual</th>
                                                <th className="text-right py-2 font-medium">Error %</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {history.filter(h => h.actualExpense !== null).map((h, i) => (
                                                <tr key={i}>
                                                    <td className="py-2 text-gray-700">{h.month}</td>
                                                    <td className="py-2 text-right text-gray-700">
                                                        ₹{addThousandsSeparator(h.predictedExpense)}
                                                    </td>
                                                    <td className="py-2 text-right text-gray-700">
                                                        ₹{addThousandsSeparator(h.actualExpense)}
                                                    </td>
                                                    <td className={`py-2 text-right font-semibold ${
                                                        (h.accuracyPercent ?? 0) < 10 ? 'text-emerald-600'
                                                        : (h.accuracyPercent ?? 0) < 25 ? 'text-yellow-600'
                                                        : 'text-red-500'
                                                    }`}>
                                                        {h.accuracyPercent != null ? `${h.accuracyPercent}%` : '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </DashboardLayout>
    );
};

export default Predictions;
