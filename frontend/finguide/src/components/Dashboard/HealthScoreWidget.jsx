import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosInstance';
import { API_PATHS } from '../../utils/apiPaths';
import { LuHeartPulse, LuArrowRight } from 'react-icons/lu';

const GRADE_COLOR = {
    Excellent: { ring: '#10b981', text: 'text-emerald-600', bg: 'bg-emerald-50' },
    Good:      { ring: '#22c55e', text: 'text-green-600',   bg: 'bg-green-50'   },
    Average:   { ring: '#eab308', text: 'text-yellow-600',  bg: 'bg-yellow-50'  },
    Poor:      { ring: '#ef4444', text: 'text-red-600',     bg: 'bg-red-50'     },
};

const RADIUS = 36;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const MiniRing = ({ score, grade }) => {
    const offset = ((100 - score) / 100) * CIRCUMFERENCE;
    const color  = GRADE_COLOR[grade]?.ring ?? '#875cf5';
    return (
        <div className="relative flex items-center justify-center w-24 h-24 flex-shrink-0">
            <svg width="96" height="96" className="-rotate-90">
                <circle cx="48" cy="48" r={RADIUS} fill="none" stroke="#e5e7eb" strokeWidth="8" />
                <circle
                    cx="48" cy="48" r={RADIUS}
                    fill="none"
                    stroke={color}
                    strokeWidth="8"
                    strokeDasharray={CIRCUMFERENCE}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s ease' }}
                />
            </svg>
            <div className="absolute flex flex-col items-center leading-tight">
                <span className="text-xl font-bold text-gray-900">{score}</span>
                <span className={`text-xs font-semibold ${GRADE_COLOR[grade]?.text ?? 'text-primary'}`}>{grade}</span>
            </div>
        </div>
    );
};

const HealthScoreWidget = () => {
    const navigate = useNavigate();
    const [data, setData]   = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        axiosInstance.get(API_PATHS.FINANCE.HEALTH_SCORE)
            .then(r => setData(r.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="card flex items-center gap-4 animate-pulse">
                <div className="w-24 h-24 rounded-full bg-gray-100 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-100 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                    <div className="h-3 bg-gray-100 rounded w-2/3" />
                </div>
            </div>
        );
    }

    if (!data) return null;

    const colors = GRADE_COLOR[data.grade] ?? GRADE_COLOR.Average;
    const topRec = data.recommendations?.[0] ?? data.tips?.[0];

    return (
        <div className="card flex items-center gap-4">
            <MiniRing score={data.score} grade={data.grade} />

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <LuHeartPulse className="text-primary text-base flex-shrink-0" />
                    <span className="text-sm font-semibold text-gray-800">Financial Health</span>
                    <span className={`ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                        {data.grade}
                    </span>
                </div>

                {/* Top 2 dimension bars */}
                {data.breakdown?.slice(0, 2).map((dim) => {
                    const value = dim.points ?? dim.score ?? 0;
                    const pct   = Math.round((value / dim.max) * 100);
                    return (
                        <div key={dim.key} className="mb-1.5">
                            <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                                <span>{dim.label}</span>
                                <span>{value}/{dim.max}</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                                <div
                                    className="bg-primary h-1.5 rounded-full transition-all duration-700"
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                        </div>
                    );
                })}

                {topRec && (
                    <p className="text-[10px] text-slate-500 mt-1.5 line-clamp-2">{topRec}</p>
                )}

                <button
                    onClick={() => navigate('/ai-insights')}
                    className="flex items-center gap-1 text-[11px] text-primary font-medium mt-2 hover:underline"
                >
                    Full analysis <LuArrowRight className="text-xs" />
                </button>
            </div>
        </div>
    );
};

export default HealthScoreWidget;
