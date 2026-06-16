import React from 'react';
import { LuTrendingUp, LuTrendingDown, LuMinus } from 'react-icons/lu';

const gradeColor = {
    A: 'text-emerald-500',
    B: 'text-green-500',
    C: 'text-yellow-500',
    D: 'text-orange-500',
    F: 'text-red-500',
};

const gradeRingColor = {
    A: '#10b981',
    B: '#22c55e',
    C: '#eab308',
    D: '#f97316',
    F: '#ef4444',
};

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const ScoreRing = ({ score, grade }) => {
    const progress = ((100 - score) / 100) * CIRCUMFERENCE;
    const color = gradeRingColor[grade] || '#875cf5';

    return (
        <div className="relative flex items-center justify-center w-40 h-40 mx-auto">
            <svg width="160" height="160" className="-rotate-90">
                <circle cx="80" cy="80" r={RADIUS} fill="none" stroke="#e5e7eb" strokeWidth="10" />
                <circle
                    cx="80" cy="80" r={RADIUS}
                    fill="none"
                    stroke={color}
                    strokeWidth="10"
                    strokeDasharray={CIRCUMFERENCE}
                    strokeDashoffset={progress}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s ease' }}
                />
            </svg>
            <div className="absolute flex flex-col items-center">
                <span className="text-3xl font-bold text-gray-900">{score}</span>
                <span className={`text-xl font-bold ${gradeColor[grade] || 'text-primary'}`}>{grade}</span>
            </div>
        </div>
    );
};

const BreakdownBar = ({ label, score, points, max }) => {
    const value = score ?? points ?? 0;
    const pct = Math.round((value / max) * 100);
    return (
        <div className="mb-3">
            <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span>{label}</span>
                <span>{score}/{max}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                    className="bg-primary h-2 rounded-full transition-all duration-700"
                    style={{ width: `${pct}%` }}
                />
            </div>
            <span className="text-xs text-slate-500 ml-auto">{value}/{max}</span>
        </div>
    );
};

const HealthScoreCard = ({ data }) => {
    if (!data) return null;

    return (
        <div className="space-y-5">
            {/* Score Ring */}
            <div className="text-center">
                <ScoreRing score={data.score} grade={data.grade} />
                <p className="mt-3 text-sm text-slate-600 max-w-xs mx-auto">{data.summary}</p>
            </div>

            {/* Breakdown */}
            <div>
                <h6 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Score Breakdown</h6>
                {data.breakdown && (Array.isArray(data.breakdown) ? data.breakdown : Object.values(data.breakdown)).map((item) => (
                    <BreakdownBar key={item.label} label={item.label} score={item.score} points={item.points} max={item.max} />
                ))}
            </div>

            {/* Strengths & Improvements */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-emerald-50 rounded-lg p-3">
                    <div className="flex items-center gap-1 mb-2">
                        <LuTrendingUp className="text-emerald-500 text-sm" />
                        <span className="text-xs font-semibold text-emerald-700">Strengths</span>
                    </div>
                    <ul className="space-y-1">
                        {data.strengths?.map((s, i) => (
                            <li key={i} className="text-xs text-emerald-700">• {s}</li>
                        ))}
                    </ul>
                </div>
                <div className="bg-orange-50 rounded-lg p-3">
                    <div className="flex items-center gap-1 mb-2">
                        <LuTrendingDown className="text-orange-500 text-sm" />
                        <span className="text-xs font-semibold text-orange-700">Improve</span>
                    </div>
                    <ul className="space-y-1">
                        {(data.weaknesses || data.improvements)?.map((s, i) => (
                            <li key={i} className="text-xs text-orange-700">• {s}</li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Tips */}
            <div>
                <h6 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">AI Tips</h6>
                <ul className="space-y-2">
                    {(data.tips || data.recommendations)?.map((tip, i) => (
                        <li key={i} className="flex gap-2 text-xs text-slate-700">
                            <span className="text-primary font-bold flex-shrink-0">{i + 1}.</span>
                            {tip}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default HealthScoreCard;
