import React, { useState, useRef, useEffect, useCallback } from 'react';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { useUserAuth } from '../../hooks/useUserAuth';
import axiosInstance from '../../utils/axiosInstance';
import { API_PATHS } from '../../utils/apiPaths';
import {
    LuSend,
    LuMic,
    LuMicOff,
    LuBot,
    LuUser,
    LuVolume2,
    LuVolumeX,
    LuTrash2,
    LuLoader,
} from 'react-icons/lu';
import toast from 'react-hot-toast';

const SUGGESTED = [
    'What is my current financial health?',
    'How can I reduce my monthly expenses?',
    'Am I saving enough based on my income?',
    'Which category am I overspending in?',
    'Give me a budget plan for next month.',
];

const WELCOME = {
    role: 'model',
    content: "Hi! I'm FinGuide AI, your personal financial advisor. I have access to your real income, expenses, budgets, health score and predictions — so my advice is tailored specifically to you. What would you like to know?",
    timestamp: null,
};

// ─── Sub-components ────────────────────────────────────────────────────────────

const MessageBubble = ({ msg }) => {
    const isBot = msg.role === 'model';
    return (
        <div className={`flex gap-3 ${isBot ? '' : 'flex-row-reverse'}`}>
            <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm ${isBot ? 'bg-primary' : 'bg-slate-600'}`}>
                {isBot ? <LuBot /> : <LuUser />}
            </div>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                isBot
                    ? 'bg-white border border-gray-200 text-gray-800'
                    : 'bg-primary text-white'
            }`}>
                {msg.content}
            </div>
        </div>
    );
};

const TypingIndicator = () => (
    <div className="flex gap-3">
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm flex-shrink-0">
            <LuBot />
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 flex items-center gap-1.5">
            <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
    </div>
);

// ─── Main Component ────────────────────────────────────────────────────────────

const Chatbot = () => {
    useUserAuth();

    // Display messages: starts with the welcome bubble; DB history is prepended on load
    const [messages, setMessages]     = useState([WELCOME]);
    const [input, setInput]           = useState('');
    const [loading, setLoading]       = useState(false);
    const [histLoading, setHistLoading] = useState(true);

    // Voice state
    const [isListening, setIsListening]   = useState(false);
    const [voiceLoading, setVoiceLoading] = useState(false);
    const [speakEnabled, setSpeakEnabled] = useState(false);
    const [voiceSupported]                = useState(
        () => 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
    );
    const recognitionRef = useRef(null);
    const bottomRef      = useRef(null);

    // ── Load persisted history on mount ────────────────────────────────────────
    useEffect(() => {
        axiosInstance.get(API_PATHS.CHAT.GET_HISTORY)
            .then(({ data }) => {
                if (data.messages?.length) {
                    // Prepend DB history before the static welcome message
                    setMessages([WELCOME, ...data.messages]);
                }
            })
            .catch(() => {}) // non-fatal; we still show the welcome message
            .finally(() => setHistLoading(false));
    }, []);

    // Auto-scroll to bottom on new message
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading, voiceLoading]);

    // ── Send Text Message ───────────────────────────────────────────────────────
    const sendMessage = useCallback(async (text) => {
        const trimmed = (text ?? input).trim();
        if (!trimmed || loading) return;

        const userMsg = { role: 'user', content: trimmed };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const res = await axiosInstance.post(API_PATHS.CHAT.SEND_MESSAGE, { message: trimmed });
            const botMsg = { role: 'model', content: res.data.reply, timestamp: res.data.timestamp };
            setMessages(prev => [...prev, botMsg]);
            if (speakEnabled) speak(res.data.reply);
        } catch {
            setMessages(prev => [
                ...prev,
                { role: 'model', content: 'Sorry, I encountered an error. Please try again.' },
            ]);
        } finally {
            setLoading(false);
        }
    }, [input, loading, speakEnabled]);

    // ── Voice Input ─────────────────────────────────────────────────────────────
    const startListening = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-IN';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (e) => {
            const transcript = e.results[0][0].transcript;
            setIsListening(false);
            handleVoiceCommand(transcript);
        };
        recognition.onerror = () => {
            setIsListening(false);
            toast.error('Voice recognition failed. Please try again.');
        };
        recognition.onend = () => setIsListening(false);

        recognitionRef.current = recognition;
        recognition.start();
        setIsListening(true);
    };

    const stopListening = () => {
        recognitionRef.current?.stop();
        setIsListening(false);
    };

    const handleVoiceCommand = async (transcript) => {
        setVoiceLoading(true);
        const userMsg = { role: 'user', content: `🎤 "${transcript}"` };
        setMessages(prev => [...prev, userMsg]);

        try {
            const res = await axiosInstance.post(API_PATHS.AI.VOICE, { transcript });
            const { response, action } = res.data;
            const botMsg = { role: 'model', content: response };
            setMessages(prev => [...prev, botMsg]);
            if (speakEnabled) speak(response);

            if (action?.type === 'navigate' && action.route) {
                setTimeout(() => { window.location.href = action.route; }, 2000);
            }
        } catch {
            setMessages(prev => [
                ...prev,
                { role: 'model', content: 'Sorry, I could not process your voice command.' },
            ]);
        } finally {
            setVoiceLoading(false);
        }
    };

    // ── Text-to-Speech ──────────────────────────────────────────────────────────
    const speak = (text) => {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-IN';
        utterance.rate = 0.95;
        window.speechSynthesis.speak(utterance);
    };

    // ── Clear History ───────────────────────────────────────────────────────────
    const clearChat = async () => {
        window.speechSynthesis?.cancel();
        try {
            await axiosInstance.delete(API_PATHS.CHAT.CLEAR_HISTORY);
        } catch {}
        setMessages([{
            role: 'model',
            content: 'Chat history cleared. How can I help you with your finances today?',
        }]);
    };

    const handleKey = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const isBusy = loading || voiceLoading || histLoading;

    return (
        <DashboardLayout activeMenu="AI Advisor">
            <div className="flex flex-col h-[calc(100vh-100px)] max-h-[780px]">

                {/* ── Header ── */}
                <div className="card mb-3 flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                            <LuBot className="text-white text-xl" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-gray-900">FinGuide AI Advisor</h2>
                            <p className="text-xs text-emerald-500 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block" />
                                Online · Powered by Gemini · History saved
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* TTS toggle */}
                        <button
                            onClick={() => setSpeakEnabled(v => !v)}
                            className={`p-2 rounded-lg border text-sm transition ${
                                speakEnabled
                                    ? 'bg-primary text-white border-primary'
                                    : 'border-gray-200 text-slate-500 hover:border-primary/40'
                            }`}
                            title={speakEnabled ? 'Disable voice response' : 'Enable voice response'}
                        >
                            {speakEnabled ? <LuVolume2 /> : <LuVolumeX />}
                        </button>
                        {/* Clear */}
                        <button
                            onClick={clearChat}
                            className="p-2 rounded-lg border border-gray-200 text-slate-500 hover:text-red-500 hover:border-red-200 text-sm transition"
                            title="Clear chat history"
                        >
                            <LuTrash2 />
                        </button>
                    </div>
                </div>

                {/* ── Messages ── */}
                <div className="flex-1 overflow-y-auto card space-y-4 mb-3">
                    {histLoading ? (
                        <div className="flex items-center justify-center h-full text-slate-400 gap-2">
                            <LuLoader className="animate-spin" />
                            <span className="text-sm">Loading history…</span>
                        </div>
                    ) : (
                        <>
                            {messages.map((msg, i) => (
                                <MessageBubble key={i} msg={msg} />
                            ))}
                            {isBusy && <TypingIndicator />}
                        </>
                    )}
                    <div ref={bottomRef} />
                </div>

                {/* ── Suggestions (only at conversation start) ── */}
                {messages.length <= 1 && !histLoading && (
                    <div className="flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-hide">
                        {SUGGESTED.map((s, i) => (
                            <button
                                key={i}
                                onClick={() => sendMessage(s)}
                                className="flex-shrink-0 text-xs bg-white border border-gray-200 rounded-full px-3 py-1.5 text-slate-600 hover:border-primary hover:text-primary transition"
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                )}

                {/* ── Input Bar ── */}
                <div className="card flex items-center gap-2 py-2">
                    {voiceSupported && (
                        <button
                            onClick={isListening ? stopListening : startListening}
                            disabled={loading || voiceLoading}
                            className={`p-2.5 rounded-xl flex-shrink-0 transition ${
                                isListening
                                    ? 'bg-red-500 text-white animate-pulse'
                                    : 'bg-gray-100 text-slate-500 hover:bg-primary/10 hover:text-primary'
                            }`}
                            title={isListening ? 'Stop listening' : 'Start voice input'}
                        >
                            {isListening ? <LuMicOff className="text-lg" /> : <LuMic className="text-lg" />}
                        </button>
                    )}

                    <textarea
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKey}
                        placeholder="Ask about your finances…"
                        rows={1}
                        disabled={loading || isListening || histLoading}
                        className="flex-1 resize-none outline-none text-sm text-gray-800 placeholder-gray-400 py-1 max-h-28 overflow-y-auto"
                    />

                    <button
                        onClick={() => sendMessage()}
                        disabled={!input.trim() || loading || histLoading}
                        className="flex-shrink-0 w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center hover:bg-purple-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <LuSend className="text-sm" />
                    </button>
                </div>

                {isListening && (
                    <p className="text-center text-xs text-red-500 mt-1 animate-pulse">
                        Listening… speak now
                    </p>
                )}
            </div>
        </DashboardLayout>
    );
};

export default Chatbot;
