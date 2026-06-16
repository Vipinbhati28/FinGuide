import React, { useState } from 'react';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { useUserAuth } from '../../hooks/useUserAuth';
import axiosInstance from '../../utils/axiosInstance';
import { API_PATHS, BASE_URL } from '../../utils/apiPaths';
import { addThousandsSeparator } from '../../utils/helper';
import moment from 'moment';
import {
    LuFileText,
    LuDownload,
    LuCircleAlert,
    LuCircleCheck,
    LuInfo,
    LuTrendingUp,
    LuTrendingDown,
    LuTarget,
    LuStar,
    LuLoader,
} from 'react-icons/lu';

const gradeColors = {
    Excellent: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    Good: 'text-green-600 bg-green-50 border-green-200',
    Average: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    'Below Average': 'text-orange-600 bg-orange-50 border-orange-200',
    Poor: 'text-red-600 bg-red-50 border-red-200',
};

const highlightIcon = {
    achievement: <LuCircleCheck className="text-emerald-500 flex-shrink-0 mt-0.5" />,
    concern: <LuCircleAlert className="text-red-500 flex-shrink-0 mt-0.5" />,
    insight: <LuInfo className="text-blue-500 flex-shrink-0 mt-0.5" />,
};

const Section = ({ title, children }) => (
    <div className="border border-gray-100 rounded-xl p-4">
        <h4 className="text-sm font-semibold text-gray-800 mb-3">{title}</h4>
        {children}
    </div>
);

const MetricRow = ({ label, value, subtext, up }) => (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
        <span className="text-xs text-slate-500">{label}</span>
        <div className="text-right">
            <span className="text-xs font-semibold text-gray-800">{value}</span>
            {subtext && (
                <span className={`ml-1.5 text-[10px] font-medium ${up ? 'text-emerald-600' : 'text-red-500'}`}>
                    {subtext}
                </span>
            )}
        </div>
    </div>
);

const FinancialReport = () => {
    useUserAuth();

    const currentYear = moment().year();
    const currentMonth = moment().month() + 1;

    const [year, setYear]           = useState(currentYear);
    const [month, setMonth]         = useState(currentMonth);
    const [report, setReport]       = useState(null);
    const [loading, setLoading]     = useState(false);
    const [error, setError]         = useState('');
    const [generated, setGenerated] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);

    const months = moment.months().map((m, i) => ({ label: m, value: i + 1 }));
    const years = Array.from({ length: 3 }, (_, i) => currentYear - i);

    const generateReport = async () => {
        setLoading(true);
        setError('');
        setReport(null);
        setGenerated(true);
        try {
            const res = await axiosInstance.get(API_PATHS.AI.MONTHLY_REPORT, {
                params: { year, month },
            });
            setReport(res.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to generate report. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => window.print();

    const handleDownloadPDF = async () => {
        setPdfLoading(true);
        try {
            // Use fetch with blob so we can trigger a browser download
            const token = localStorage.getItem('token');
            const res   = await fetch(
                `${BASE_URL}${API_PATHS.AI.MONTHLY_REPORT_PDF}?year=${year}&month=${month}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (!res.ok) throw new Error('PDF generation failed');

            const blob     = await res.blob();
            const url      = URL.createObjectURL(blob);
            const anchor   = document.createElement('a');
            anchor.href    = url;
            anchor.download = `FinGuide-Report-${moment(`${year}-${month}`, 'YYYY-M').format('MMMM-YYYY')}.pdf`;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            URL.revokeObjectURL(url);
        } catch {
            setError('Failed to download PDF. Please try again.');
        } finally {
            setPdfLoading(false);
        }
    };

    const gradeClass = gradeColors[report?.performanceGrade] || gradeColors.Average;

    return (
        <DashboardLayout activeMenu="AI Report">
            <div className="space-y-5 max-w-3xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <LuFileText className="text-primary text-xl" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Monthly AI Financial Report</h2>
                        <p className="text-xs text-slate-500">Comprehensive analysis generated by Gemini AI</p>
                    </div>
                </div>

                {/* Month Selector */}
                <div className="card">
                    <h5 className="text-sm font-medium text-gray-700 mb-3">Select Report Period</h5>
                    <div className="flex flex-wrap gap-3">
                        <select
                            value={month}
                            onChange={e => setMonth(Number(e.target.value))}
                            className="input flex-1 min-w-[140px]"
                        >
                            {months.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </select>
                        <select
                            value={year}
                            onChange={e => setYear(Number(e.target.value))}
                            className="input w-28"
                        >
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <button
                            onClick={generateReport}
                            disabled={loading}
                            className="btn-primary flex items-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <LuFileText className="text-sm" />
                                    Generate Report
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Loading */}
                {loading && (
                    <div className="card flex flex-col items-center py-16 gap-3">
                        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                        <p className="text-sm text-slate-500">Gemini AI is writing your financial report...</p>
                    </div>
                )}

                {/* Error */}
                {!loading && error && (
                    <div className="card flex items-center gap-3 text-red-600 border-red-100">
                        <LuCircleAlert className="text-xl flex-shrink-0" />
                        <p className="text-sm">{error}</p>
                    </div>
                )}

                {/* Report Content */}
                {!loading && report && (
                    <div className="space-y-4" id="report-content">
                        {/* Report Title & Print */}
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <h3 className="text-base font-bold text-gray-900">{report.reportTitle}</h3>
                            <div className="flex items-center gap-2 print:hidden">
                                <button
                                    onClick={handleDownloadPDF}
                                    disabled={pdfLoading}
                                    className="flex items-center gap-1.5 text-xs text-white bg-primary rounded-lg px-3 py-1.5 hover:bg-purple-700 transition disabled:opacity-50"
                                >
                                    {pdfLoading
                                        ? <LuLoader className="animate-spin text-sm" />
                                        : <LuDownload className="text-sm" />
                                    }
                                    {pdfLoading ? 'Generating PDF…' : 'Download PDF'}
                                </button>
                                <button
                                    onClick={handlePrint}
                                    className="flex items-center gap-1.5 text-xs text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition"
                                >
                                    <LuFileText className="text-sm" />
                                    Print
                                </button>
                            </div>
                        </div>

                        {/* Performance Score */}
                        <div className={`card border flex items-center gap-4 ${gradeClass}`}>
                            <div className="text-4xl font-bold">{report.performanceScore}</div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Performance</p>
                                <p className="text-lg font-bold">{report.performanceGrade}</p>
                            </div>
                            <LuStar className="ml-auto text-2xl opacity-40" />
                        </div>

                        {/* Executive Summary */}
                        <Section title="Executive Summary">
                            <p className="text-sm text-slate-600 leading-relaxed">{report.executiveSummary}</p>
                        </Section>

                        {/* Highlights */}
                        {report.highlights?.length > 0 && (
                            <Section title="Key Highlights">
                                <div className="space-y-2">
                                    {report.highlights.map((h, i) => (
                                        <div key={i} className="flex gap-2">
                                            {highlightIcon[h.type]}
                                            <div>
                                                <p className="text-xs font-semibold text-gray-800">{h.title}</p>
                                                <p className="text-xs text-slate-500">{h.description}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Section>
                        )}

                        {/* Income + Expense Analysis side by side */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {report.incomeAnalysis && (
                                <Section title="Income Analysis">
                                    <p className="text-xs text-slate-500 mb-3">{report.incomeAnalysis.summary}</p>
                                    <div>
                                        {report.incomeAnalysis.sources?.map((s, i) => (
                                            <MetricRow
                                                key={i}
                                                label={s.name}
                                                value={`₹${addThousandsSeparator(s.amount)}`}
                                                subtext={`${s.percentage}%`}
                                                up
                                            />
                                        ))}
                                    </div>
                                </Section>
                            )}

                            {report.expenseAnalysis && (
                                <Section title="Expense Analysis">
                                    <p className="text-xs text-slate-500 mb-3">{report.expenseAnalysis.summary}</p>
                                    <div>
                                        {report.expenseAnalysis.topCategories?.map((c, i) => (
                                            <MetricRow
                                                key={i}
                                                label={c.category}
                                                value={`₹${addThousandsSeparator(c.amount)}`}
                                                subtext={c.vs_budget}
                                                up={c.vs_budget?.toLowerCase().includes('under')}
                                            />
                                        ))}
                                    </div>
                                </Section>
                            )}
                        </div>

                        {/* Budget Performance */}
                        {report.budgetPerformance && (
                            <Section title="Budget Performance">
                                <p className="text-xs text-slate-500 mb-3">{report.budgetPerformance.summary}</p>
                                <div className="w-full bg-gray-100 rounded-full h-3 mb-1">
                                    <div
                                        className={`h-3 rounded-full transition-all duration-700 ${
                                            report.budgetPerformance.status === 'over_budget'
                                                ? 'bg-red-500'
                                                : report.budgetPerformance.status === 'on_track'
                                                    ? 'bg-yellow-400'
                                                    : 'bg-emerald-500'
                                        }`}
                                        style={{ width: `${Math.min(100, report.budgetPerformance.utilized || 0)}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-xs text-slate-500 mt-1">
                                    <span>{report.budgetPerformance.utilized}% used</span>
                                    <span className="capitalize">{report.budgetPerformance.status?.replace('_', ' ')}</span>
                                </div>
                            </Section>
                        )}

                        {/* Raw Data Summary */}
                        {report.rawData && (
                            <Section title="Financial Summary">
                                <MetricRow label="Total Income" value={`₹${addThousandsSeparator(report.rawData.totalIncome)}`} subtext={`${report.rawData.incomeChange > 0 ? '+' : ''}${report.rawData.incomeChange}% vs prev`} up={report.rawData.incomeChange >= 0} />
                                <MetricRow label="Total Expenses" value={`₹${addThousandsSeparator(report.rawData.totalExpense)}`} subtext={`${report.rawData.expenseChange > 0 ? '+' : ''}${report.rawData.expenseChange}% vs prev`} up={report.rawData.expenseChange <= 0} />
                                <MetricRow label="Net Savings" value={`₹${addThousandsSeparator(report.rawData.netSavings)}`} subtext={`${report.rawData.savingsRate}% rate`} up={report.rawData.netSavings >= 0} />
                                <MetricRow label="Daily Avg Spend" value={`₹${addThousandsSeparator(report.rawData.dailyAvgSpend)}`} />
                                <MetricRow label="Transactions" value={report.rawData.transactionCount} />
                            </Section>
                        )}

                        {/* Budget Analysis */}
                        {report.budgetAnalysis && (
                            <Section title="Budget Analysis">
                                <p className="text-xs text-slate-500 mb-3">{report.budgetAnalysis.summary}</p>
                                <div className="w-full bg-gray-100 rounded-full h-3 mb-1">
                                    <div
                                        className={`h-3 rounded-full transition-all duration-700 ${
                                            report.budgetAnalysis.status === 'over_budget'
                                                ? 'bg-red-500'
                                                : report.budgetAnalysis.status === 'on_track'
                                                    ? 'bg-yellow-400'
                                                    : 'bg-emerald-500'
                                        }`}
                                        style={{ width: `${Math.min(100, report.budgetAnalysis.utilized || 0)}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-xs text-slate-500 mt-1 mb-3">
                                    <span>{report.budgetAnalysis.utilized}% used</span>
                                    <span className="capitalize">{report.budgetAnalysis.status?.replace('_', ' ')}</span>
                                </div>
                                {report.budgetAnalysis.recommendations?.length > 0 && (
                                    <ul className="space-y-1">
                                        {report.budgetAnalysis.recommendations.map((r, i) => (
                                            <li key={i} className="text-xs text-slate-700 flex gap-1.5">
                                                <span className="text-primary font-bold flex-shrink-0">{i + 1}.</span>{r}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Section>
                        )}

                        {/* Prediction Analysis */}
                        {report.predictionAnalysis && (
                            <Section title="Prediction Analysis">
                                <p className="text-xs text-slate-500 mb-3">{report.predictionAnalysis.summary}</p>
                                <div className="grid grid-cols-3 gap-3">
                                    {report.predictionAnalysis.nextMonthForecast && (
                                        <div className="bg-primary/5 rounded-lg p-3 text-center">
                                            <p className="text-[10px] text-slate-400 mb-1">Next Month Forecast</p>
                                            <p className="text-sm font-bold text-primary">
                                                ₹{addThousandsSeparator(report.predictionAnalysis.nextMonthForecast)}
                                            </p>
                                        </div>
                                    )}
                                    {report.predictionAnalysis.confidence != null && (
                                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                                            <p className="text-[10px] text-slate-400 mb-1">Confidence</p>
                                            <p className="text-sm font-bold text-gray-800">{report.predictionAnalysis.confidence}%</p>
                                        </div>
                                    )}
                                    {report.predictionAnalysis.trend && (
                                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                                            <p className="text-[10px] text-slate-400 mb-1">Trend</p>
                                            <p className={`text-sm font-bold capitalize ${
                                                report.predictionAnalysis.trend === 'decreasing' ? 'text-emerald-600'
                                                : report.predictionAnalysis.trend === 'increasing' ? 'text-red-500'
                                                : 'text-blue-500'
                                            }`}>{report.predictionAnalysis.trend}</p>
                                        </div>
                                    )}
                                </div>
                            </Section>
                        )}

                        {/* Goals & Recommendations */}
                        {report.goalsAndRecommendations && (
                            <Section title="Goals & Action Items">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1">
                                            <LuTarget className="text-primary" /> Next Month Goals
                                        </p>
                                        <ul className="space-y-1.5">
                                            {report.goalsAndRecommendations.nextMonthGoals?.map((g, i) => (
                                                <li key={i} className="text-xs text-slate-700 flex gap-1.5">
                                                    <span className="text-primary font-bold flex-shrink-0">{i + 1}.</span>
                                                    {g}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1">
                                            <LuCircleCheck className="text-emerald-500" /> Action Items
                                        </p>
                                        <ul className="space-y-1.5">
                                            {report.goalsAndRecommendations.actionItems?.map((a, i) => (
                                                <li key={i} className="text-xs text-slate-700 flex gap-1.5">
                                                    <span className="text-emerald-500 flex-shrink-0">✓</span>
                                                    {a}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                                {report.goalsAndRecommendations.longTermAdvice && (
                                    <p className="text-xs text-slate-500 border-t border-gray-100 pt-3 mt-3 italic">
                                        {report.goalsAndRecommendations.longTermAdvice}
                                    </p>
                                )}
                            </Section>
                        )}

                        {/* Motivational Close */}
                        {report.motivationalMessage && (
                            <div className="bg-gradient-to-r from-primary/10 to-purple-50 rounded-xl p-4 border border-primary/20">
                                <p className="text-sm text-primary font-medium text-center">{report.motivationalMessage}</p>
                            </div>
                        )}
                    </div>
                )}

                {!loading && !error && !report && generated && (
                    <div className="card text-center text-slate-400 text-sm py-10">
                        No transactions found for this period. Try a different month.
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
};

export default FinancialReport;
