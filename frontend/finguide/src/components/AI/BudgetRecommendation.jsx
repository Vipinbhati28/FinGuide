import React from 'react';
import { addThousandsSeparator } from '../../utils/helper';

const priorityConfig = {
    essential: { bg: 'bg-red-100', text: 'text-red-700', label: 'Essential' },
    important: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Important' },
    optional: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Optional' },
};

const CategoryRow = ({ cat }) => {
    const config = priorityConfig[cat.priority] || priorityConfig.optional;
    const diff = cat.recommended - (cat.currentSpend || 0);
    const isOver = diff < 0;

    return (
        <div className="border border-gray-100 rounded-lg p-3 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="font-medium text-sm text-gray-800 truncate">{cat.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${config.bg} ${config.text}`}>
                        {config.label}
                    </span>
                </div>
                <span className="text-sm font-semibold text-primary flex-shrink-0">
                    ₹{addThousandsSeparator(cat.recommended)}
                </span>
            </div>

            {/* Progress bar: current vs recommended */}
            <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2">
                <div
                    className={`h-1.5 rounded-full transition-all duration-700 ${isOver ? 'bg-red-400' : 'bg-emerald-400'}`}
                    style={{ width: `${Math.min(100, cat.percentage)}%` }}
                />
            </div>

            <div className="flex justify-between items-center">
                <span className="text-[11px] text-slate-500">{cat.percentage}% of budget</span>
                {cat.currentSpend > 0 && (
                    <span className={`text-[11px] font-medium ${isOver ? 'text-red-500' : 'text-emerald-600'}`}>
                        {isOver ? `₹${addThousandsSeparator(Math.abs(diff))} over` : `₹${addThousandsSeparator(diff)} saved`}
                    </span>
                )}
            </div>

            {cat.tip && (
                <p className="text-[11px] text-slate-500 mt-1.5 border-t border-gray-50 pt-1.5">{cat.tip}</p>
            )}
        </div>
    );
};

const BudgetRecommendation = ({ data }) => {
    if (!data) return null;

    return (
        <div className="space-y-4">
            {/* Header Summary */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-primary/10 rounded-lg p-3 text-center">
                    <p className="text-xs text-slate-500 mb-1">Recommended Budget</p>
                    <p className="text-lg font-bold text-primary">₹{addThousandsSeparator(data.totalRecommendedBudget)}</p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-slate-500 mb-1">Savings Target</p>
                    <p className="text-lg font-bold text-emerald-600">₹{addThousandsSeparator(data.savingsTarget)}</p>
                    <p className="text-[10px] text-slate-400">{data.savingsPercentage}% of income</p>
                </div>
            </div>

            {/* Methodology */}
            <p className="text-xs text-slate-500 bg-gray-50 p-2 rounded">{data.methodology}</p>

            {/* Category Cards */}
            <div>
                <h6 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Category Breakdown</h6>
                <div className="space-y-2">
                    {data.categories?.map((cat, i) => <CategoryRow key={i} cat={cat} />)}
                </div>
            </div>

            {/* Insights */}
            {data.insights?.length > 0 && (
                <div>
                    <h6 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">AI Insights</h6>
                    <ul className="space-y-1.5">
                        {data.insights.map((ins, i) => (
                            <li key={i} className="flex gap-2 text-xs text-slate-700">
                                <span className="text-primary font-bold flex-shrink-0">→</span>
                                {ins}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default BudgetRecommendation;
