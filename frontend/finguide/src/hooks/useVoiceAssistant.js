import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import { API_PATHS } from '../utils/apiPaths';
import toast from 'react-hot-toast';

// ─── Client-side command patterns ─────────────────────────────────────────────
// These are parsed locally — no API call needed for simple navigation commands.
const CLIENT_PATTERNS = [
    {
        // "add expense 500 food"  |  "add expense 1000 travel"
        regex:  /add\s+(?:an?\s+)?expense\s+(?:of\s+)?(\d+(?:\.\d+)?)\s+(?:for\s+)?(\w[\w\s]*?)(?:\s*$)/i,
        intent: 'add_expense',
        extract: (m) => ({ amount: parseFloat(m[1]), category: m[2].trim() }),
    },
    {
        // "add income 5000 salary"
        regex:  /add\s+(?:an?\s+)?income\s+(?:of\s+)?(\d+(?:\.\d+)?)\s+(?:from\s+)?(\w[\w\s]*?)(?:\s*$)/i,
        intent: 'add_income',
        extract: (m) => ({ amount: parseFloat(m[1]), source: m[2].trim() }),
    },
    {
        regex: /(?:show|open|go\s+to)\s+(?:my\s+)?(?:financial\s+)?health\s+score/i,
        intent: 'navigate',
        extract: () => ({ route: '/ai-insights' }),
    },
    {
        regex: /(?:generate|show|open|view)\s+(?:my\s+)?(?:monthly\s+|financial\s+)?report/i,
        intent: 'navigate',
        extract: () => ({ route: '/report' }),
    },
    {
        regex: /(?:open|show|go\s+to)\s+(?:the\s+)?chatbot|(?:talk\s+to|chat\s+with)\s+(?:the\s+)?(?:ai|advisor)/i,
        intent: 'navigate',
        extract: () => ({ route: '/chatbot' }),
    },
    {
        regex: /(?:show|open|view)\s+(?:my\s+)?predictions?/i,
        intent: 'navigate',
        extract: () => ({ route: '/predictions' }),
    },
    {
        regex: /(?:go\s+to|open|show)\s+(?:the\s+)?dashboard/i,
        intent: 'navigate',
        extract: () => ({ route: '/dashboard' }),
    },
    {
        regex: /(?:go\s+to|open|show)\s+(?:my\s+)?income/i,
        intent: 'navigate',
        extract: () => ({ route: '/income' }),
    },
    {
        regex: /(?:go\s+to|open|show)\s+(?:my\s+)?expenses?/i,
        intent: 'navigate',
        extract: () => ({ route: '/expense' }),
    },
    {
        regex: /(?:go\s+to|open|show)\s+(?:my\s+)?budget/i,
        intent: 'navigate',
        extract: () => ({ route: '/budget' }),
    },
    {
        regex: /(?:show|what(?:'s|\s+is)\s+(?:my\s+)?)?(?:current\s+)?balance/i,
        intent: 'balance_query',
        extract: () => ({}),
    },
];

// ─── Response messages for client-parsed commands ─────────────────────────────
function clientResponse(intent, data) {
    switch (intent) {
        case 'add_expense':
            return `Adding ₹${data.amount} expense for ${data.category}.`;
        case 'add_income':
            return `Adding ₹${data.amount} income from ${data.source}.`;
        case 'navigate':
            return `Opening ${data.route.replace('/', '').replace('-', ' ')}.`;
        case 'balance_query':
            return 'Let me navigate to your dashboard to show your balance.';
        default:
            return 'Got it!';
    }
}

/**
 * useVoiceAssistant — Reusable hook for the FinGuide voice command system.
 *
 * Flow:
 *   1. User taps mic → Web Speech API captures transcript.
 *   2. CLIENT-SIDE parser checks against regex patterns for common commands.
 *      → Match found: execute the action immediately (navigate / call expense API).
 *      → No match:   call POST /api/v1/ai/voice for AI intent classification.
 *   3. Structured action is executed (navigate, add expense, etc.).
 *   4. Optional TTS reads back the response.
 *
 * @param {Object} options
 * @param {boolean} [options.speakResponse=false]  — read replies aloud via TTS
 * @param {Function} [options.onResult]            — callback(result) after each command
 * @returns {{ isListening, transcript, result, error, supported, start, stop, reset }}
 */
export function useVoiceAssistant({ speakResponse = false, onResult } = {}) {
    const navigate = useNavigate();

    const [isListening, setIsListening] = useState(false);
    const [transcript,  setTranscript]  = useState('');
    const [result,      setResult]      = useState(null);
    const [error,       setError]       = useState(null);
    const [processing,  setProcessing]  = useState(false);

    const supported = typeof window !== 'undefined' &&
        ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

    const recognitionRef = useRef(null);

    // ── TTS ───────────────────────────────────────────────────────────────────
    const speak = useCallback((text) => {
        if (!speakResponse || !window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-IN';
        u.rate = 0.95;
        window.speechSynthesis.speak(u);
    }, [speakResponse]);

    // ── Execute a structured action returned by client parser or AI ───────────
    const executeAction = useCallback(async (intent, data, response) => {
        speak(response);

        if (intent === 'navigate' && data.route) {
            navigate(data.route);
            return;
        }

        if (intent === 'balance_query') {
            navigate('/dashboard');
            return;
        }

        if (intent === 'add_expense' && data.amount && data.category) {
            try {
                await axiosInstance.post(API_PATHS.EXPENSE.ADD_EXPENSE, {
                    amount:      data.amount,
                    category:    data.category,
                    date:        new Date().toISOString(),
                    description: `Voice: ${data.category}`,
                });
                toast.success(`₹${data.amount} expense added for ${data.category}`);
            } catch {
                toast.error('Failed to add expense. Please try again.');
            }
            return;
        }

        if (intent === 'add_income' && data.amount && data.source) {
            try {
                await axiosInstance.post(API_PATHS.INCOME.ADD_INCOME, {
                    amount: data.amount,
                    source: data.source,
                    date:   new Date().toISOString(),
                    description: `Voice: ${data.source}`,
                });
                toast.success(`₹${data.amount} income added from ${data.source}`);
            } catch {
                toast.error('Failed to add income. Please try again.');
            }
        }
    }, [navigate, speak]);

    // ── Process transcript: client-side first, AI fallback ────────────────────
    const processTranscript = useCallback(async (text) => {
        setTranscript(text);
        setProcessing(true);
        setError(null);

        // Step 1 — client-side pattern match (no API call)
        for (const pattern of CLIENT_PATTERNS) {
            const match = text.match(pattern.regex);
            if (match) {
                const data     = pattern.extract(match);
                const response = clientResponse(pattern.intent, data);
                const outcome  = { intent: pattern.intent, response, data, source: 'client' };
                setResult(outcome);
                onResult?.(outcome);
                await executeAction(pattern.intent, data, response);
                setProcessing(false);
                return;
            }
        }

        // Step 2 — AI fallback for complex / unrecognised commands
        try {
            const res = await axiosInstance.post(API_PATHS.AI.VOICE, { transcript: text });
            const { intent, response, data, action } = res.data;

            const outcome = { intent, response, data, action, source: 'ai' };
            setResult(outcome);
            onResult?.(outcome);

            // Execute AI-returned action
            if (action?.type === 'navigate' && action.route) {
                await executeAction('navigate', { route: action.route }, response);
            } else if (action?.type === 'add_expense' && action.payload) {
                await executeAction('add_expense', action.payload, response);
            } else if (action?.type === 'add_income' && action.payload) {
                await executeAction('add_income', action.payload, response);
            } else {
                speak(response);
            }
        } catch (err) {
            const msg = 'Sorry, I could not understand that command.';
            setError(msg);
            speak(msg);
            toast.error(msg);
        } finally {
            setProcessing(false);
        }
    }, [executeAction, speak, onResult]);

    // ── Start listening ───────────────────────────────────────────────────────
    const start = useCallback(() => {
        if (!supported || isListening) return;

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang              = 'en-IN';
        recognition.interimResults    = false;
        recognition.maxAlternatives   = 1;
        recognition.continuous        = false;

        recognition.onstart  = () => setIsListening(true);
        recognition.onend    = () => setIsListening(false);
        recognition.onerror  = (e) => {
            setIsListening(false);
            const msg = e.error === 'no-speech'
                ? 'No speech detected. Please try again.'
                : 'Voice recognition error. Please try again.';
            setError(msg);
            toast.error(msg);
        };
        recognition.onresult = (e) => {
            const text = e.results[0][0].transcript;
            processTranscript(text);
        };

        recognitionRef.current = recognition;
        recognition.start();
    }, [supported, isListening, processTranscript]);

    // ── Stop listening ────────────────────────────────────────────────────────
    const stop = useCallback(() => {
        recognitionRef.current?.stop();
        setIsListening(false);
    }, []);

    // ── Reset state ───────────────────────────────────────────────────────────
    const reset = useCallback(() => {
        setTranscript('');
        setResult(null);
        setError(null);
        setProcessing(false);
    }, []);

    return { isListening, transcript, result, error, processing, supported, start, stop, reset };
}
