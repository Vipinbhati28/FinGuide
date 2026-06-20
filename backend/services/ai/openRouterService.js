'use strict';

const OpenAI = require('openai');

const PRIMARY_MODEL   = process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat-v3-0324';
const FALLBACK_MODELS = ['qwen/qwen3-32b', 'meta-llama/llama-3.3-70b-instruct'];
const RETRY_DELAYS    = [1000, 2000, 4000]; // ms — for 503 transient errors

const sleep = ms => new Promise(r => setTimeout(r, ms));

class OpenRouterService {
    constructor() {
        if (!process.env.OPENROUTER_API_KEY) {
            console.warn(
                '[OpenRouter] ⚠  OPENROUTER_API_KEY not set.\n' +
                '              AI features will fail at runtime.\n' +
                '              Add OPENROUTER_API_KEY to backend/.env and restart.'
            );
        }
        this._client = new OpenAI({
            apiKey:  process.env.OPENROUTER_API_KEY || 'not-set',
            baseURL: 'https://openrouter.ai/api/v1',
            defaultHeaders: {
                'HTTP-Referer': process.env.PRODUCTION_FRONTEND_URL || 'https://finguide-frontend.onrender.com',
                'X-Title':      'FinGuide',
            },
            timeout: 55_000, // slightly under Render's 60s timeout
        });
    }

    // ── Private: single model call ─────────────────────────────────────────────

    async _callModel(model, messages) {
        const res = await this._client.chat.completions.create({ model, messages });
        return res.choices[0].message.content.trim();
    }

    // ── Private: retry wrapper for transient 503s; fast-fail on long 429s ─────

    async _withRetry(fn) {
        let lastErr;
        for (let i = 0; i <= RETRY_DELAYS.length; i++) {
            try {
                return await fn();
            } catch (err) {
                lastErr = err;
                const status = err?.status ?? 0;
                const msg    = err.message ?? '';

                if (status === 429) {
                    const waitSec = parseInt(
                        err?.headers?.['retry-after'] ?? err?.headers?.['x-ratelimit-reset-requests'] ?? '60',
                        10
                    );
                    if (waitSec > 30) {
                        console.warn(`[OpenRouter] 429 — retry-after=${waitSec}s, failing fast`);
                        break;
                    }
                    console.warn(`[OpenRouter] 429 — waiting ${waitSec}s…`);
                    await sleep(waitSec * 1000 + 500);
                    continue;
                }

                if ((status === 503 || msg.includes('503')) && i < RETRY_DELAYS.length) {
                    console.warn(`[OpenRouter] 503 — retry in ${RETRY_DELAYS[i]}ms (attempt ${i + 1})`);
                    await sleep(RETRY_DELAYS[i]);
                    continue;
                }

                break; // auth / bad-request — no point retrying
            }
        }
        throw lastErr;
    }

    // ── Public: chat with automatic model fallback ─────────────────────────────
    // Falls through: PRIMARY → fallback[0] → fallback[1]

    async chat(messages) {
        const models  = [PRIMARY_MODEL, ...FALLBACK_MODELS];
        let   lastErr;

        for (const model of models) {
            try {
                return await this._withRetry(() => this._callModel(model, messages));
            } catch (err) {
                lastErr = err;
                if ([429, 502, 503].includes(err?.status)) {
                    console.warn(`[OpenRouter] ${model} failed (${err.status}), trying fallback…`);
                    continue;
                }
                throw err; // auth/bad-request — don't try other models
            }
        }

        throw lastErr;
    }

    // ── Public: chat() + JSON parse with fence-strip ───────────────────────────

    async chatJSON(messages) {
        const messagesWithInstruction = [
            ...messages,
            { role: 'user', content: 'CRITICAL: Your ENTIRE response must be valid JSON only. No markdown fences, no prose, no explanation.' },
        ];

        const raw = await this.chat(messagesWithInstruction);

        const cleaned = raw
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i,    '')
            .replace(/```\s*$/i,    '')
            .trim();

        try {
            return JSON.parse(cleaned);
        } catch {
            throw new Error(`[OpenRouter] Non-JSON response. First 300 chars: ${cleaned.slice(0, 300)}`);
        }
    }
}

module.exports = new OpenRouterService();
