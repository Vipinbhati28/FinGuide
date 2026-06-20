'use strict';

/**
 * GeminiClient — AI client backed by xAI Grok (OpenAI-compatible API).
 *
 * Keeps the same interface as the previous Gemini implementation so all
 * agents work without changes:
 *   generate(prompt)       → Promise<string>
 *   generateJSON(prompt)   → Promise<Object>
 *   startChat(history)     → ChatSession  (has .sendMessage(text))
 *
 * Retry policy:
 *   503 (transient)  → exponential backoff 1s / 2s / 4s, 3 attempts
 *   429 (rate-limit) → respect x-ratelimit-reset or retry-after header;
 *                      if wait > 30s, fail immediately
 */

const OpenAI = require('openai');

const MODEL        = 'grok-3-fast';
const RETRY_DELAYS = [1000, 2000, 4000];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ── ChatSession ────────────────────────────────────────────────────────────────
// Mimics Gemini's ChatSession.sendMessage() so AdvisorAgent and FinanceAgent
// need no changes.
class ChatSession {
    constructor(client, history) {
        this._client  = client;
        this._history = history; // [{role:'user'|'assistant', content:string}]
    }

    async sendMessage(text) {
        this._history.push({ role: 'user', content: text });

        const completion = await this._client.chat.completions.create({
            model:    MODEL,
            messages: this._history,
        });

        const reply = completion.choices[0].message.content.trim();
        this._history.push({ role: 'assistant', content: reply });

        return { response: { text: () => reply } };
    }
}

// ── XaiClient ──────────────────────────────────────────────────────────────────
class XaiClient {
    constructor() {
        if (!process.env.XAI_API_KEY) {
            console.warn(
                '[AI] ⚠  XAI_API_KEY is not set.\n' +
                '         All AI features will throw at runtime.\n' +
                '         Set XAI_API_KEY in backend/.env and restart.'
            );
        }
        this._client = new OpenAI({
            apiKey:  process.env.XAI_API_KEY || 'not-set',
            baseURL: 'https://api.x.ai/v1',
        });
    }

    // ─── Private: retry wrapper ──────────────────────────────────────────────

    async _withRetry(fn) {
        let lastError;
        for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
            try {
                return await fn();
            } catch (err) {
                lastError = err;
                const status  = err?.status ?? 0;
                const msg     = err.message ?? '';

                if (status === 429 || msg.includes('429')) {
                    // Respect the retry-after from the API response
                    const waitSec = err?.headers?.['retry-after']
                        ? parseInt(err.headers['retry-after'], 10)
                        : 60;
                    if (waitSec > 30) {
                        console.warn(`[AI] Rate-limited — retry in ${waitSec}s (not waiting, failing fast)`);
                        break;
                    }
                    const waitMs = waitSec * 1000 + 500;
                    console.warn(`[AI] Rate-limited — waiting ${waitMs}ms…`);
                    await sleep(waitMs);
                    continue;
                }

                const isRetryable = status === 503 || msg.includes('503');
                if (!isRetryable || attempt === RETRY_DELAYS.length) break;

                console.warn(`[AI] Retrying in ${RETRY_DELAYS[attempt]}ms (attempt ${attempt + 1})…`);
                await sleep(RETRY_DELAYS[attempt]);
            }
        }
        throw lastError;
    }

    // ─── Public: single-turn generation ─────────────────────────────────────

    async generate(prompt) {
        return this._withRetry(async () => {
            const completion = await this._client.chat.completions.create({
                model:    MODEL,
                messages: [{ role: 'user', content: prompt }],
            });
            return completion.choices[0].message.content.trim();
        });
    }

    // ─── Public: JSON generation ─────────────────────────────────────────────

    async generateJSON(prompt) {
        const full = prompt +
            '\n\n===\nCRITICAL: Return ONLY valid JSON. No markdown, no explanation, no prose.';
        const raw = await this.generate(full);

        const cleaned = raw
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i,    '')
            .replace(/```\s*$/i,    '')
            .trim();

        try {
            return JSON.parse(cleaned);
        } catch {
            throw new Error(
                `[AI] Response is not valid JSON.\nFirst 300 chars: ${cleaned.slice(0, 300)}`
            );
        }
    }

    // ─── Public: multi-turn chat session ────────────────────────────────────

    startChat(history = []) {
        // Convert Gemini history format → OpenAI format
        // Gemini: [{role:'user'|'model', parts:[{text:string}]}]
        // OpenAI: [{role:'user'|'assistant', content:string}]
        const openaiHistory = history.map(m => ({
            role:    m.role === 'model' ? 'assistant' : m.role,
            content: m.parts?.[0]?.text ?? m.content ?? '',
        }));
        return new ChatSession(this._client, openaiHistory);
    }
}

module.exports = new XaiClient();
