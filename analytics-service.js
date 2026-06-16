/**
 * analytics-service.js — Daxini.Space Creator & Discovery Analytics Engine v1
 *
 * Architecture:
 *   - Client-side JS module, included via <script> in index.html
 *   - Writes events to Firestore via REST (no SDK dependency required)
 *   - Two atomic Firestore writes per event:
 *       1. analyticsEvents       → immutable event log per occurrence
 *       2. analyticsDailyCounts  → mutable daily counter (fast dashboard reads)
 *   - Fire-and-forget: analytics failures NEVER block the product flow
 *
 * Canonical Events:
 *   Discovery:  search_performed | category_opened | app_view | app_install_click | external_link_click
 *   Creator:    creator_signup | app_publish | returning_creator
 *   Retention:  returning_user
 */

const DaxiniAnalytics = (() => {
  // ─── Config ──────────────────────────────────────────────────────────────────
  const FIRESTORE_PROJECT_ID = 'logichub-app'; // Shared Firebase project
  const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents`;

  const RETURNING_USER_KEY    = 'ds_last_seen_at';
  const RETURNING_CREATOR_KEY = 'ds_creator_last_seen_at';
  const SESSION_KEY           = 'ds_session_id';
  const MS_IN_24H             = 24 * 60 * 60 * 1000;

  // ─── Canonical Events ─────────────────────────────────────────────────────────
  const EVENTS = Object.freeze({
    // Discovery
    SEARCH_PERFORMED:   'search_performed',
    CATEGORY_OPENED:    'category_opened',
    APP_VIEW:           'app_view',
    APP_INSTALL_CLICK:  'app_install_click',
    EXTERNAL_LINK_CLICK:'external_link_click',
    // Creator
    CREATOR_SIGNUP:     'creator_signup',
    APP_PUBLISH:        'app_publish',
    RETURNING_CREATOR:  'returning_creator',
    // Retention
    RETURNING_USER:     'returning_user',
  });

  const VALID_EVENTS = new Set(Object.values(EVENTS));

  // ─── Internal Helpers ─────────────────────────────────────────────────────────

  /** Returns or creates a stable session ID for this browser tab session */
  function getSessionId() {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = `ds_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  }

  /** Derives today's date key: "2026-06-17" */
  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  /** Firestore REST: write a new analyticsEvents document */
  async function writeEventDoc(payload) {
    const docId = `${payload.event_name}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const url = `${FIRESTORE_BASE}/analyticsEvents/${docId}`;
    const body = {
      fields: {
        event_name:    { stringValue: payload.event_name },
        user_id:       { stringValue: payload.user_id    || '' },
        creator_id:    { stringValue: payload.creator_id || '' },
        app_id:        { stringValue: payload.app_id     || '' },
        session_id:    { stringValue: payload.session_id || '' },
        date_key:      { stringValue: payload.date_key },
        metadata_json: { stringValue: JSON.stringify(payload.metadata || {}) },
        created_at:    { timestampValue: new Date().toISOString() },
      }
    };
    await fetch(`${url}?key=${window.__DAXINI_API_KEY__ || ''}`, {
      method: 'PATCH', // PATCH = create-or-merge in Firestore REST
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  /** Firestore REST: increment a daily counter via transforms */
  async function incrementDailyCounter(eventName, dateKey) {
    const docId  = dateKey; // doc ID = "2026-06-17"
    const url    = `${FIRESTORE_BASE}/analyticsDailyCounts/${docId}:commit`;
    const body   = {
      writes: [{
        transform: {
          document: `projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/analyticsDailyCounts/${docId}`,
          fieldTransforms: [
            { fieldPath: eventName,    increment: { integerValue: '1' } },
            { fieldPath: 'date_key',   setToServerValue: 'REQUEST_TIME' },
            { fieldPath: 'last_updated', setToServerValue: 'REQUEST_TIME' },
          ]
        }
      }]
    };
    await fetch(`https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents:commit?key=${window.__DAXINI_API_KEY__ || ''}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  // ─── Public API ───────────────────────────────────────────────────────────────

  /**
   * Core tracking function — fire-and-forget.
   *
   * @param {string} eventName   - One of EVENTS values
   * @param {object} opts
   * @param {string} [opts.userId]
   * @param {string} [opts.creatorId]
   * @param {string} [opts.appId]
   * @param {object} [opts.metadata]
   */
  async function track(eventName, opts = {}) {
    if (!VALID_EVENTS.has(eventName)) {
      console.warn(`[DaxiniAnalytics] Unknown event: "${eventName}"`);
      return;
    }
    const dateKey = todayKey();
    const payload = {
      event_name: eventName,
      user_id:    opts.userId    || '',
      creator_id: opts.creatorId || '',
      app_id:     opts.appId     || '',
      session_id: getSessionId(),
      date_key:   dateKey,
      metadata:   opts.metadata  || {},
    };

    try {
      // Parallel writes: immutable log + daily counter
      await Promise.all([
        writeEventDoc(payload),
        incrementDailyCounter(eventName, dateKey),
      ]);
    } catch (err) {
      // Silent fail — analytics must never break the platform
      console.warn(`[DaxiniAnalytics] Event "${eventName}" failed silently:`, err.message);
    }
  }

  /**
   * Returning-user gate (24 h window).
   * Reads last_seen_at from localStorage. If gap > 24 h, emits returning_user.
   * Always updates last_seen_at after check.
   *
   * @param {string} [userId]
   */
  async function trackReturningUser(userId) {
    const last = parseInt(localStorage.getItem(RETURNING_USER_KEY) || '0', 10);
    const now  = Date.now();
    if (!last || (now - last) > MS_IN_24H) {
      await track(EVENTS.RETURNING_USER, { userId });
    }
    localStorage.setItem(RETURNING_USER_KEY, now.toString());
  }

  /**
   * Returning-creator gate (24 h window).
   *
   * @param {string} creatorId
   */
  async function trackReturningCreator(creatorId) {
    const last = parseInt(localStorage.getItem(RETURNING_CREATOR_KEY) || '0', 10);
    const now  = Date.now();
    if (!last || (now - last) > MS_IN_24H) {
      await track(EVENTS.RETURNING_CREATOR, { creatorId });
    }
    localStorage.setItem(RETURNING_CREATOR_KEY, now.toString());
  }

  // ─── Auto-initialise on page load ────────────────────────────────────────────
  function init(userId) {
    // Track returning user status every page load
    trackReturningUser(userId || '');
  }

  // ─── Expose ───────────────────────────────────────────────────────────────────
  return {
    EVENTS,
    track,
    trackReturningUser,
    trackReturningCreator,
    init,
  };
})();

window.DaxiniAnalytics = DaxiniAnalytics;
