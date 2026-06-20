'use strict';

/**
 * aiCache — Shared TTL in-memory store for all AI feature results.
 *
 * Key conventions (set by financeAgent.js):
 *   ctx:{userId}               financial context snapshot     2 min
 *   health:{userId}            health score + AI narrative    30 min
 *   budget:{userId}            budget recommendation          30 min
 *   spending:{userId}          spending pattern analysis       1 hr
 *   prediction:{userId}        expense prediction              1 hr
 *   report:{userId}:{y}:{m}    monthly report                  2 hr
 */

class AICache {
    constructor() {
        this._store = new Map();
    }

    get(key) {
        const entry = this._store.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            this._store.delete(key);
            return null;
        }
        return entry.data;
    }

    set(key, data, ttlMs) {
        this._store.set(key, { data, expiresAt: Date.now() + ttlMs });
        return this;
    }

    invalidateUser(userId) {
        for (const key of this._store.keys()) {
            if (key.includes(userId)) this._store.delete(key);
        }
    }

    get size() { return this._store.size; }
}

module.exports = new AICache();
