'use strict';

/**
 * AgentCache — shared TTL in-memory cache used by all agents and the coordinator.
 *
 * A single shared instance ensures that if HealthAgent and AdvisorAgent both need
 * the user's financial data within the same 2-minute window, only one DB query fires.
 *
 * Key conventions (enforced by the coordinator):
 *   ctx:{userId}                  — shared financial context (2 min)
 *   health:{userId}               — health score (30 min)
 *   budget:{userId}               — budget advice (30 min)
 *   spending:{userId}             — spending analysis (1 hr)
 *   prediction:{userId}           — expense prediction (1 hr)
 *   report:{userId}:{year}:{month}— monthly report (2 hr)
 *
 * For multi-instance deployments, replace the Map with a Redis adapter
 * that exposes the same get/set/invalidatePattern interface.
 */

class AgentCache {
    constructor() {
        this._store = new Map();
    }

    /** @returns {*|null} cached value, or null if missing or expired */
    get(key) {
        const entry = this._store.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            this._store.delete(key);
            return null;
        }
        return entry.data;
    }

    /** @param {string} key  @param {*} data  @param {number} ttlMs */
    set(key, data, ttlMs) {
        this._store.set(key, { data, expiresAt: Date.now() + ttlMs });
    }

    /**
     * Deletes all cache entries whose key contains `pattern`.
     * Used by the coordinator's invalidateUser(userId) to purge one user's entries.
     * @param {string} pattern
     */
    invalidatePattern(pattern) {
        for (const key of this._store.keys()) {
            if (key.includes(pattern)) this._store.delete(key);
        }
    }

    clear() {
        this._store.clear();
    }

    /** Current size — useful for health checks / debug logs. */
    get size() {
        return this._store.size;
    }
}

module.exports = new AgentCache();
