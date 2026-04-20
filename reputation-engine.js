(function registerReputationEngine(global) {
  'use strict';

  const PROFILE_PREFIX = 'daxini.passport.profile.';
  const CREATOR_KEY = 'daxini.creator.reputation';

  function safeParse(value, fallback) {
    try {
      return JSON.parse(value);
    } catch (_error) {
      return fallback;
    }
  }

  function readCreatorStore() {
    return safeParse(localStorage.getItem(CREATOR_KEY), {});
  }

  function writeCreatorStore(store) {
    localStorage.setItem(CREATOR_KEY, JSON.stringify(store));
  }

  function normalizeSignals(signals) {
    return {
      downloads: Number(signals.downloads || 0),
      ratings: Number(signals.ratings || 0),
      remixes: Number(signals.remixes || 0),
      session_activity: Number(signals.session_activity || 0),
      active_days: Number(signals.active_days || 0),
      session_streak: Number(signals.session_streak || 0),
      forks: Number(signals.forks || 0),
      templates_used: Number(signals.templates_used || 0)
    };
  }

  function calculateReputation(signals) {
    const normalized = normalizeSignals(signals);
    return (
      normalized.downloads * 2 +
      normalized.ratings * 5 +
      normalized.remixes * 3 +
      normalized.session_activity
    );
  }

  function badgeFromScore(score) {
    if (score >= 500) return { key: 'legendary', label: 'Legendary Creator' };
    if (score >= 250) return { key: 'elite', label: 'Elite Creator' };
    if (score >= 100) return { key: 'rising', label: 'Rising Creator' };
    return { key: 'none', label: 'No badge yet' };
  }

  function profileKey(passportToken) {
    return PROFILE_PREFIX + passportToken;
  }

  function ensurePassportProfile(passportToken) {
    if (!passportToken) return null;
    const key = profileKey(passportToken);
    const existing = safeParse(localStorage.getItem(key), null);
    if (existing && existing.passport_token === passportToken) return existing;

    const profile = {
      passport_token: passportToken,
      created_at: new Date().toISOString(),
      reputation: {
        overall: 0,
        creators: {},
        stats: normalizeSignals({}),
        badge: badgeFromScore(0)
      }
    };
    localStorage.setItem(key, JSON.stringify(profile));
    return profile;
  }

  function getPassportProfile(passportToken) {
    const profile = ensurePassportProfile(passportToken);
    if (!profile) return null;
    return profile;
  }

  function writePassportProfile(passportToken, profile) {
    localStorage.setItem(profileKey(passportToken), JSON.stringify(profile));
    return profile;
  }

  function updateCreatorReputation(creatorId, activity) {
    const normalizedCreator = String(creatorId || 'community').toLowerCase();
    const store = readCreatorStore();
    const current = normalizeSignals(store[normalizedCreator] || {});
    const nextSignals = normalizeSignals({
      downloads: current.downloads + Number(activity.downloads || 0),
      ratings: current.ratings + Number(activity.ratings || 0),
      remixes: current.remixes + Number(activity.remixes || 0),
      session_activity: current.session_activity + Number(activity.session_activity || 0),
      active_days: current.active_days + Number(activity.active_days || 0),
      session_streak: current.session_streak + Number(activity.session_streak || 0),
      forks: current.forks + Number(activity.forks || 0),
      templates_used: current.templates_used + Number(activity.templates_used || 0)
    });

    const reputation = calculateReputation(nextSignals);
    store[normalizedCreator] = {
      ...nextSignals,
      reputation,
      badge: badgeFromScore(reputation),
      updated_at: new Date().toISOString()
    };
    writeCreatorStore(store);
    return store[normalizedCreator];
  }

  function updatePassportReputation(passportToken, activity) {
    const profile = ensurePassportProfile(passportToken);
    if (!profile) return null;

    const current = normalizeSignals(profile.reputation.stats || {});
    const nextSignals = normalizeSignals({
      downloads: current.downloads + Number(activity.downloads || 0),
      ratings: current.ratings + Number(activity.ratings || 0),
      remixes: current.remixes + Number(activity.remixes || 0),
      session_activity: current.session_activity + Number(activity.session_activity || 0),
      active_days: current.active_days + Number(activity.active_days || 0),
      session_streak: current.session_streak + Number(activity.session_streak || 0),
      forks: current.forks + Number(activity.forks || 0),
      templates_used: current.templates_used + Number(activity.templates_used || 0)
    });

    const creator = activity.creator ? updateCreatorReputation(activity.creator, activity) : null;
    const overall = calculateReputation(nextSignals);

    profile.reputation = {
      overall,
      creators: {
        ...(profile.reputation.creators || {}),
        ...(creator ? { [String(activity.creator || '').toLowerCase()]: creator } : {})
      },
      stats: nextSignals,
      badge: badgeFromScore(overall),
      updated_at: new Date().toISOString()
    };

    return writePassportProfile(passportToken, profile);
  }

  function recordSessionActivity(passportToken) {
    const profile = ensurePassportProfile(passportToken);
    if (!profile) return null;

    const today = new Date().toISOString().slice(0, 10);
    const lastActive = profile.last_active_day || '';
    const oneDayMs = 24 * 60 * 60 * 1000;
    const dayGap = lastActive ? Math.floor((Date.parse(today) - Date.parse(lastActive)) / oneDayMs) : null;

    const activeDayIncrement = lastActive === today ? 0 : 1;
    const streak = dayGap === 1
      ? Number(profile.reputation?.stats?.session_streak || 0) + 1
      : 1;

    profile.last_active_day = today;
    const updated = updatePassportReputation(passportToken, {
      session_activity: 1,
      active_days: activeDayIncrement,
      session_streak: activeDayIncrement ? streak : Number(profile.reputation?.stats?.session_streak || 1)
    });
    return updated;
  }

  function getCreatorReputation(creatorId) {
    const normalizedCreator = String(creatorId || 'community').toLowerCase();
    const store = readCreatorStore();
    const creator = store[normalizedCreator];
    if (!creator) {
      return {
        reputation: 0,
        badge: badgeFromScore(0),
        downloads: 0,
        ratings: 0,
        remixes: 0,
        session_activity: 0
      };
    }
    return creator;
  }

  global.DaxiniReputationEngine = {
    calculateReputation,
    ensurePassportProfile,
    getPassportProfile,
    updatePassportReputation,
    recordSessionActivity,
    getCreatorReputation,
    badgeFromScore
  };
})(window);
