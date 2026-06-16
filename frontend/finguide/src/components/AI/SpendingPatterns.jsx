import React from 'react';
import { LuTrendingUp, LuTrendingDown, LuMinus, LuTriangleAlert, LuCircleCheck, LuInfo } from 'react-icons/lu';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { addThousandsSeparator } from '../../utils/helper';

const trendIcon = {
    increasing: <LuTrendingUp className="text-red-500" />,
    decreasing: <LuTrendingDown className="text-emerald-500" />,
    stable: <LuMinus className="text-blue-500" />,
};

const trendLabel = {
    increasing: 'text-red-600',
    decreasing: 'text-emerald-600',
    stable: 'text-blue-600',
};

const impactIcon = {
    positive: <LuCircleCheck className="text-emerald-500 flex-shrink-0 mt-0.5" />,
    negative: <LuTriangleAlert className="text-red-500 flex-shrink-0 mt-0.5" />,
    neutral: <LuInfo className="text-blue-500 flex-shrink-0 mt-0.5" />,
};

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow text-xs">
            <p className="font-semibold text-gray-700">{label}</p>
            <p className="text-primary">₹{addThousandsSeparator(payload[0]?.value)}</p>
        </div>
    );
};

const SpendingPatterns = ({ data }) => {
    if (!data) return null;

    return (
        <div className="space-y-5">
            {/* Trend Banner */}
            <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                    {trendIcon[data.overallTrend]}
                    <span className={`font-semibold text-sm capitalize ${trendLabel[data.overallTrend]}`}>
                        {data.overallTrend} trend
                    </span>
                </div>
                <span className="text-xs bg-white border border-gray-200 rounded px-2 py-1 text-slate-600">
                    {data.trendPercentage > 0 ? '+' : ''}{data.trendPercentage}% change
                </span>
            </div>

            <p className="text-sm text-slate-600">{data.analysis}</p>

            {/* Monthly Bar Chart */}
            {data.monthlyData?.length > 0 && (
                <div>
                    <h6 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Monthly Spend</h6>
                    <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={data.monthlyData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${v}`} width={55} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="amount" fill="#875cf5" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Patterns */}
            {data.patterns?.length > 0 && (
                <div>
                    <h6 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Detected Patterns</h6>
                    <div className="space-y-2">
                        {data.patterns.map((p, i) => (
                            <div key={i} className="flex gap-2 bg-gray-50 rounded-lg p-2.5">
                                {impactIcon[p.impact]}
                                <div>
                                    <p className="text-xs font-semibold text-gray-800">{p.title}</p>
                                    <p className="text-xs text-slate-500">{p.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Anomalies */}
            {data.anomalies?.length > 0 && (
                <div>
                    <h6 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Anomalies</h6>
                    <div className="space-y-2">
                        {data.anomalies.map((a, i) => (
                            <div key={i} className="border-l-2 border-orange-400 pl-3 py-1">
                                <p className="text-xs font-semibold text-gray-800">{a.month} — {a.category}</p>
                                <p className="text-xs text-slate-500">{a.description}</p>
                                <p className="text-xs text-orange-600 mt-0.5">→ {a.suggestion}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Recommendations */}
            {data.recommendations?.length > 0 && (
                <div>
                    <h6 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Recommendations</h6>
                    <ul className="space-y-1.5">
                        {data.recommendations.map((r, i) => (
                            <li key={i} className="flex gap-2 text-xs text-slate-700">
                                <span className="text-primary font-bold flex-shrink-0">{i + 1}.</span>
                                {r}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default SpendingPatterns;
