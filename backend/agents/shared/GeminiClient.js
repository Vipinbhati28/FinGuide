'use strict';

/**
 * GeminiClient — The only file permitted to import @google/generative-ai.
 *
 * Features:
 *   • Singleton — one SDK instance for the whole process lifetime.
 *   • Retry with exponential backoff (3 attempts, 1 s / 2 s / 4 s delays).
 *     Retries on 429 (quota exceeded) and 503 (service unavailable) only.
 *   • generateJSON() strips Markdown fences that Gemini occasionally wraps.
 *   • startChat() returns a native Gemini ChatSession for multi-turn dialogue.
 *
 * To swap models globally (e.g. gemini-1.5-pro for monthly reports), pass
 * model:'gemini-1.5-pro' as an option to generate() or generateJSON().
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

const RETRY_DELAYS = [1000, 2000, 4000]; // ms — 3 attempts total
const RETRYABLE    = new Set([429, 503]);  // HTTP status codes worth retrying

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class GeminiClient {
    constructor() {
        if (!process.env.GEMINI_API_KEY) {
            console.warn(
                '[GeminiClient] ⚠  GEMINI_API_KEY is not set.\n' +
                '              All AI features will throw at runtime.\n' +
                '              Set GEMINI_API_KEY in backend/.env and restart.'
            );
        }
        this._genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
        this._flash = this._genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    }

    // ─── Private: retry wrapper ─────────────────────────────────────────────

    async _withRetry(fn) {
        let lastError;
        for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
            try {
                return await fn();
            } catch (err) {
                lastError = err;
                const status = err?.status ?? err?.httpErrorCode ?? 0;
                const isRetryable = RETRYABLE.has(status) ||
                    (err.message ?? '').includes('quota') ||
                    (err.message ?? '').includes('503');

                if (!isRetryable || attempt === RETRY_DELAYS.length) break;

                const delay = RETRY_DELAYS[attempt];
                console.warn(`[GeminiClient] Retrying in ${delay}ms (attempt ${attempt + 1})…`);
                await sleep(delay);
            }
        }
        throw lastError;
    }

    // ─── Public: single-turn generation ────────────────────────────────────

    /**
     * @param {string}  prompt
     * @param {Object}  [opts]
     * @param {string}  [opts.model] — override model (e.g. 'gemini-1.5-pro')
     * @returns {Promise<string>}
     */
    async generate(prompt, opts = {}) {
        const model = opts.model
            ? this._genAI.getGenerativeModel({ model: opts.model })
            : this._flash;

        return this._withRetry(async () => {
            const result = await model.generateContent(prompt);
            return result.response.text().trim();
        });
    }

    /**
     * Calls generate() and parses the response as JSON.
     * Strips Markdown fences (```json…```) that Gemini occasionally emits.
     *
     * @param {string} prompt
     * @param {Object} [opts]
     * @returns {Promise<Object>}
     */
    async generateJSON(prompt, opts = {}) {
        const full = prompt +
            '\n\n===\nCRITICAL: Return ONLY valid JSON. No markdown, no explanation, no prose.';
        const raw = await this.generate(full, opts);

        const cleaned = raw
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/```\s*$/i, '')
            .trim();

        try {
            return JSON.parse(cleaned);
        } catch {
            throw new Error(
                `[GeminiClient] Response is not valid JSON.\n` +
                `First 300 chars: ${cleaned.slice(0, 300)}`
            );
        }
    }

    /**
     * Opens a multi-turn chat session.
     * @param {Array<{role:'user'|'model', parts:[{text:string}]}>} history
     * @returns {ChatSession}
     */
    startChat(history = []) {
        return this._flash.startChat({ history });
    }
}

module.exports = new GeminiClient();
