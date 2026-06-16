import React from 'react';
import { LuTrendingUp, LuTrendingDown, LuMinus, LuTarget } from 'react-icons/lu';
import { addThousandsSeparator } from '../../utils/helper';

const confidenceConfig = {
    high: { bg: 'bg-emerald-100', text: 'text-emerald-700', bar: 'bg-emerald-500' },
    medium: { bg: 'bg-yellow-100', text: 'text-yellow-700', bar: 'bg-yellow-500' },
    low: { bg: 'bg-red-100', text: 'text-red-700', bar: 'bg-red-500' },
};

const trendIcon = {
    up: <LuTrendingUp className="text-red-500 text-xs" />,
    down: <LuTrendingDown className="text-emerald-500 text-xs" />,
    stable: <LuMinus className="text-blue-400 text-xs" />,
};

const ExpensePrediction = ({ data }) => {
    if (!data) return null;

    const conf = confidenceConfig[data.confidence] || confidenceConfig.medium;
    const vsLastPositive = data.comparedToLastMonth <= 0;
    const vsAvgPositive = data.comparedToAverage <= 0;

    return (
        <div className="space-y-4">
            {/* Prediction Header */}
            <div className="text-center bg-gradient-to-br from-primary/10 to-purple-50 rounded-xl p-4">
                <p className="text-xs text-slate-500 mb-1">Predicted Next Month</p>
                <p className="text-3xl font-bold text-primary">₹{addThousandsSeparator(data.predictedTotal)}</p>
                <div className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${conf.bg} ${conf.text}`}>
                    {data.confidence} confidence ({data.confidenceScore}%)
                </div>
            </div>

            {/* Comparison Cards */}
            <div className="grid grid-cols-2 gap-2">
                <div className="border rounded-lg p-2.5 text-center">
                    <p className="text-[10px] text-slate-400">vs Last Month</p>
                    <p className={`text-sm font-bold ${vsLastPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                        {vsLastPositive ? '▼' : '▲'} ₹{addThousandsSeparator(Math.abs(data.comparedToLastMonth))}
                    </p>
                </div>
                <div className="border rounded-lg p-2.5 text-center">
                    <p className="text-[10px] text-slate-400">vs Average</p>
                    <p className={`text-sm font-bold ${vsAvgPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                        {vsAvgPositive ? '▼' : '▲'} ₹{addThousandsSeparator(Math.abs(data.comparedToAverage))}
                    </p>
                </div>
            </div>

            <p className="text-xs text-slate-600">{data.summary}</p>

            {/* Suggested Budget */}
            {data.budgetSuggestion && (
                <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-lg p-3">
                    <LuTarget className="text-primary text-lg flex-shrink-0" />
                    <div>
                        <p className="text-xs font-semibold text-primary">Suggested Budget</p>
                        <p className="text-sm font-bold text-gray-800">₹{addThousandsSeparator(data.budgetSuggestion)}</p>
                    </div>
                </div>
            )}

            {/* Category Predictions Table */}
            {data.categoryPredictions?.length > 0 && (
                <div>
                    <h6 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Category Forecast</h6>
                    <div className="divide-y divide-gray-50">
                        {data.categoryPredictions.map((cat, i) => (
                            <div key={i} className="flex items-center justify-between py-2">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    {trendIcon[cat.trend]}
                                    <span className="text-xs text-gray-700 truncate">{cat.category}</span>
                                </div>
                                <div className="text-right flex-shrink-0 ml-2">
                                    <p className="text-xs font-semibold text-gray-800">₹{addThousandsSeparator(cat.predicted)}</p>
                                    <p className={`text-[10px] ${cat.changePercent > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                                        {cat.changePercent > 0 ? '+' : ''}{cat.changePercent}%
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Risk Factors & Saving Opportunities */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.riskFactors?.length > 0 && (
                    <div className="bg-red-50 rounded-lg p-3">
                        <p className="text-xs font-semibold text-red-700 mb-1.5">Risk Factors</p>
                        {data.riskFactors.map((r, i) => (
                            <p key={i} className="text-xs text-red-600">• {r}</p>
                        ))}
                    </div>
                )}
                {data.savingOpportunities?.length > 0 && (
                    <div className="bg-emerald-50 rounded-lg p-3">
                        <p className="text-xs font-semibold text-emerald-700 mb-1.5">Save Here</p>
                        {data.savingOpportunities.map((s, i) => (
                            <p key={i} className="text-xs text-emerald-600">• {s}</p>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExpensePrediction;
