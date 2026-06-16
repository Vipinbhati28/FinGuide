import React, { useState, useCallback } from 'react';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { useUserAuth } from '../../hooks/useUserAuth';
import axiosInstance from '../../utils/axiosInstance';
import { API_PATHS } from '../../utils/apiPaths';
import HealthScoreCard from '../../components/AI/HealthScoreCard';
import BudgetRecommendation from '../../components/AI/BudgetRecommendation';
import SpendingPatterns from '../../components/AI/SpendingPatterns';
import ExpensePrediction from '../../components/AI/ExpensePrediction';
import { LuBrain, LuRefreshCw, LuCircleAlert } from 'react-icons/lu';

const TABS = [
    { id: 'health', label: 'Health Score', endpoint: API_PATHS.AI.HEALTH_SCORE },
    { id: 'budget', label: 'Budget AI', endpoint: API_PATHS.AI.BUDGET_RECOMMENDATION },
    { id: 'spending', label: 'Spending Patterns', endpoint: API_PATHS.AI.SPENDING_ANALYSIS },
    { id: 'prediction', label: 'Expense Forecast', endpoint: API_PATHS.AI.EXPENSE_PREDICTION },
];

const Spinner = () => (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-slate-500">Analysing your finances with AI...</p>
    </div>
);

const ErrorBox = ({ message, onRetry }) => (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
        <LuCircleAlert className="text-red-400 text-3xl" />
        <p className="text-sm text-red-600 text-center max-w-xs">{message}</p>
        <button className="chip" onClick={onRetry}>Try Again</button>
    </div>
);

const AIInsights = () => {
    useUserAuth();

    const [activeTab, setActiveTab] = useState('health');
    const [cache, setCache] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchData = useCallback(async (tabId, forceRefresh = false) => {
        if (cache[tabId] && !forceRefresh) return;

        const tab = TABS.find(t => t.id === tabId);
        if (!tab) return;

        setLoading(true);
        setError('');
        try {
            const res = await axiosInstance.get(tab.endpoint);
            setCache(prev => ({ ...prev, [tabId]: res.data }));
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load AI insights. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [cache]);

    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
        fetchData(tabId);
    };

    const handleRefresh = () => {
        setCache(prev => {
            const next = { ...prev };
            delete next[activeTab];
            return next;
        });
        fetchData(activeTab, true);
    };

    // Load first tab on mount
    React.useEffect(() => { fetchData('health'); }, []);

    const data = cache[activeTab];

    return (
        <DashboardLayout activeMenu="AI Insights">
            <div className="space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <LuBrain className="text-primary text-xl" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">AI Financial Insights</h2>
                            <p className="text-xs text-slate-500">Powered by Gemini AI — based on your real data</p>
                        </div>
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={loading}
                        className="flex items-center gap-1.5 text-xs text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition disabled:opacity-50"
                    >
                        <LuRefreshCw className={`text-sm ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => handleTabChange(tab.id)}
                            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                activeTab === tab.id
                                    ? 'bg-primary text-white shadow-sm'
                                    : 'bg-white border border-gray-200 text-slate-600 hover:border-primary/40'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content Panel */}
                <div className="card">
                    {loading && <Spinner />}
                    {!loading && error && <ErrorBox message={error} onRetry={handleRefresh} />}
                    {!loading && !error && data && (
                        <>
                            {activeTab === 'health' && <HealthScoreCard data={data} />}
                            {activeTab === 'budget' && <BudgetRecommendation data={data} />}
                            {activeTab === 'spending' && <SpendingPatterns data={data} />}
                            {activeTab === 'prediction' && <ExpensePrediction data={data} />}
                        </>
                    )}
                    {!loading && !error && !data && (
                        <div className="text-center py-10 text-slate-400 text-sm">
                            Click a tab above to generate AI insights.
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
};

export default AIInsights;
