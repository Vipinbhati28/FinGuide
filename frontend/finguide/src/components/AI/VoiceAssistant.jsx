import React, { useState } from 'react';
import { useVoiceAssistant } from '../../hooks/useVoiceAssistant';
import {
    LuMic,
    LuMicOff,
    LuX,
    LuLoader,
    LuCircleCheck,
    LuCircleAlert,
    LuVolume2,
} from 'react-icons/lu';

/**
 * VoiceAssistant — Floating mic button rendered inside DashboardLayout.
 *
 * Supported voice commands:
 *   • "Add expense 500 food"
 *   • "Add expense 1000 travel"
 *   • "Add income 5000 salary"
 *   • "Show health score"
 *   • "Generate report"
 *   • "Open chatbot"
 *   • "Show predictions"
 *   • "Go to dashboard / income / expense / budget"
 *   • Anything else → AI intent classification via /api/v1/ai/voice
 */
const VoiceAssistant = () => {
    const [speakEnabled, setSpeakEnabled] = useState(false);
    const [expanded,     setExpanded]     = useState(false);

    const {
        isListening, transcript, result, error, processing, supported,
        start, stop, reset,
    } = useVoiceAssistant({ speakResponse: speakEnabled });

    if (!supported) return null;

    const handleMic = () => {
        if (isListening) { stop(); return; }
        reset();
        setExpanded(true);
        start();
    };

    const handleClose = () => {
        stop();
        reset();
        setExpanded(false);
    };

    // Determine status icon + colour
    const isBusy = isListening || processing;
    const ringColor = isListening  ? 'bg-red-500 animate-pulse'
        : processing               ? 'bg-yellow-400'
        : result && !error         ? 'bg-emerald-500'
        : error                    ? 'bg-red-400'
        :                            'bg-primary';

    return (
        <>
            {/* ── Expanded overlay panel ── */}
            {expanded && (
                <div className="fixed bottom-24 right-6 z-40 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <LuMic className="text-primary text-sm" />
                            <span className="text-sm font-semibold text-gray-800">Voice Assistant</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setSpeakEnabled(v => !v)}
                                className={`p-1.5 rounded-lg border text-xs transition ${
                                    speakEnabled
                                        ? 'bg-primary/10 text-primary border-primary/30'
                                        : 'border-gray-200 text-slate-400 hover:text-primary'
                                }`}
                                title={speakEnabled ? 'Mute responses' : 'Enable spoken responses'}
                            >
                                <LuVolume2 />
                            </button>
                            <button
                                onClick={handleClose}
                                className="p-1.5 rounded-lg border border-gray-200 text-slate-400 hover:text-red-500 text-xs transition"
                            >
                                <LuX />
                            </button>
                        </div>
                    </div>

                    {/* Status */}
                    <div className="bg-gray-50 rounded-xl p-3 min-h-[70px] flex flex-col justify-center">
                        {isListening && (
                            <div className="flex items-center gap-2 text-red-500">
                                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse flex-shrink-0" />
                                <span className="text-xs font-medium">Listening… speak now</span>
                            </div>
                        )}
                        {processing && !isListening && (
                            <div className="flex items-center gap-2 text-yellow-600">
                                <LuLoader className="animate-spin text-sm flex-shrink-0" />
                                <span className="text-xs">Processing…</span>
                            </div>
                        )}
                        {transcript && (
                            <p className="text-xs text-slate-600 italic mt-1">"{transcript}"</p>
                        )}
                        {result && !processing && (
                            <div className="flex gap-2 mt-1">
                                <LuCircleCheck className="text-emerald-500 text-sm flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-gray-700">{result.response}</p>
                            </div>
                        )}
                        {error && !processing && (
                            <div className="flex gap-2 mt-1">
                                <LuCircleAlert className="text-red-500 text-sm flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-red-600">{error}</p>
                            </div>
                        )}
                        {!isListening && !processing && !transcript && !result && !error && (
                            <p className="text-xs text-slate-400 text-center">
                                Tap the mic and say a command
                            </p>
                        )}
                    </div>

                    {/* Quick command hints */}
                    {!isListening && !processing && (
                        <div className="space-y-1">
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Try saying…</p>
                            {[
                                'Add expense 500 food',
                                'Show health score',
                                'Generate report',
                                'Show predictions',
                            ].map(cmd => (
                                <p key={cmd} className="text-[10px] text-slate-500 bg-gray-50 rounded px-2 py-1">
                                    "{cmd}"
                                </p>
                            ))}
                        </div>
                    )}

                    {/* Tap-to-speak button inside panel */}
                    <button
                        onClick={handleMic}
                        disabled={processing}
                        className={`w-full py-2.5 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2 transition ${
                            isListening
                                ? 'bg-red-500 hover:bg-red-600'
                                : processing
                                    ? 'bg-yellow-400 cursor-wait'
                                    : 'bg-primary hover:bg-purple-700'
                        }`}
                    >
                        {isListening  ? <><LuMicOff className="text-base" /> Stop</>
                         : processing ? <><LuLoader className="animate-spin text-base" /> Processing…</>
                         :              <><LuMic className="text-base" /> Tap to Speak</>
                        }
                    </button>
                </div>
            )}

            {/* ── Floating action button ── */}
            <button
                onClick={expanded ? handleMic : () => { setExpanded(true); start(); reset(); }}
                className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white text-xl transition-transform hover:scale-105 ${ringColor}`}
                title="Voice Assistant — click to speak"
                aria-label="Voice Assistant"
            >
                {isBusy
                    ? <LuMicOff className="text-xl" />
                    : <LuMic className="text-xl" />
                }
                {isBusy && (
                    <span className="absolute inset-0 rounded-full animate-ping opacity-30 bg-current" />
                )}
            </button>
        </>
    );
};

export default VoiceAssistant;
