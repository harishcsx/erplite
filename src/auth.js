const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
const axios = require('axios');
const crypto = require('crypto');

class SessionManager {
    constructor() {
        this.sessions = new Map(); // sessionId -> { jar, meta }
        this.secret = process.env.SESSION_SECRET || 'unilite-default-secret';
    }

    createSession() {
        const sessionId = crypto.randomBytes(16).toString('hex');
        const jar = new CookieJar();
        this.sessions.set(sessionId, {
            jar,
            meta: {
                createdAt: Date.now(),
                lastUsed: Date.now(),
                expires: Date.now() + (24 * 60 * 60 * 1000) // 24h default
            }
        });
        return sessionId;
    }

    getSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.meta.lastUsed = Date.now();
            return session;
        }
        return null;
    }

    getClient(sessionId) {
        let session = this.getSession(sessionId);
        if (!session) {
            // If no session provided or found, we might create a transient one or return null
            return wrapper(axios.create({ withCredentials: true }));
        }
        return wrapper(axios.create({ jar: session.jar, withCredentials: true }));
    }

    invalidate(sessionId) {
        this.sessions.delete(sessionId);
    }
}

module.exports = new SessionManager();
