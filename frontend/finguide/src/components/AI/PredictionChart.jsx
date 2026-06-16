import React from 'react';
import {
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    BarChart,
} from 'recharts';
import { addThousandsSeparator } from '../../utils/helper';

const CustomTooltipContent = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-xs">
            <p className="font-semibold text-gray-700 mb-1">{label}</p>
            {payload.map((entry, i) => (
                <p key={i} style={{ color: entry.color }} className="leading-relaxed">
                    {entry.name}: ₹{addThousandsSeparator(Math.round(entry.value))}
                </p>
            ))}
        </div>
    );
};

/**
 * PredictionChart — shows historical predicted vs actual expense over time.
 *
 * @param {Array}  history        — from predictionService.getHistory()
 * @param {Array}  categories     — from current prediction's categoryPredictions
 */
const PredictionChart = ({ history = [], categories = [] }) => {
    // History chart data: bars for actual, line for predicted
    const historyData = history.map(h => ({
        month:            h.month,
        'Actual Expense':    h.actualExpense ?? null,
        'Predicted Expense': h.predictedExpense,
    }));

    // Category chart data: horizontal bar of predicted amounts
    const catData = categories
        .slice(0, 8)
        .map(c => ({
            name:      c.category.length > 14 ? c.category.slice(0, 13) + '…' : c.category,
            Predicted: c.predictedAmount,
        }));

    return (
        <div className="space-y-6">
            {/* Predicted vs Actual timeline */}
            {historyData.length > 0 && (
                <div>
                    <h6 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                        Predicted vs Actual (Historical)
                    </h6>
                    <ResponsiveContainer width="100%" height={200}>
                        <ComposedChart data={historyData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                            <YAxis
                                tick={{ fontSize: 10 }}
                                tickFormatter={v => `₹${Math.round(v / 1000)}k`}
                            />
                            <Tooltip content={<CustomTooltipContent />} />
                            <Legend wrapperStyle={{ fontSize: 10 }} />
                            <Bar
                                dataKey="Actual Expense"
                                fill="#10b981"
                                radius={[3, 3, 0, 0]}
                                maxBarSize={32}
                            />
                            <Line
                                type="monotone"
                                dataKey="Predicted Expense"
                                stroke="#875cf5"
                                strokeWidth={2}
                                dot={{ r: 3, fill: '#875cf5' }}
                                strokeDasharray="5 3"
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Category Forecast */}
            {catData.length > 0 && (
                <div>
                    <h6 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                        Next Month — Category Forecast
                    </h6>
                    <ResponsiveContainer width="100%" height={catData.length * 36 + 20}>
                        <BarChart
                            layout="vertical"
                            data={catData}
                            margin={{ top: 0, right: 40, bottom: 0, left: 0 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                            <XAxis
                                type="number"
                                tick={{ fontSize: 10 }}
                                tickFormatter={v => `₹${Math.round(v / 1000)}k`}
                            />
                            <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={90} />
                            <Tooltip content={<CustomTooltipContent />} />
                            <Bar dataKey="Predicted" fill="#875cf5" radius={[0, 3, 3, 0]} maxBarSize={18} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
};

export default PredictionChart;
