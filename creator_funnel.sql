-- =====================================================================
-- creator_funnel.sql — Daxini.Space Creator Funnel
-- =====================================================================

-- ─── 30-day creator funnel aggregation ───────────────────────────────────────
SELECT
  SUM(creator_signup)    AS total_creator_signups,
  SUM(app_publish)       AS total_apps_published,
  SUM(returning_creator) AS total_returning_creators,
  SUM(returning_user)    AS total_returning_users,

  -- Creator funnel rates
  ROUND(SUM(app_publish)::NUMERIC       / NULLIF(SUM(creator_signup),    0) * 100, 2) AS publish_conversion_pct,
  ROUND(SUM(returning_creator)::NUMERIC / NULLIF(SUM(creator_signup),    0) * 100, 2) AS creator_retention_pct

FROM analytics_daily_counts
WHERE date_key >= CURRENT_DATE - INTERVAL '30 days';


-- ─── Daily creator trend ──────────────────────────────────────────────────────
SELECT
  date_key,
  creator_signup,
  app_publish,
  returning_creator
FROM analytics_daily_counts
WHERE date_key >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY date_key ASC;


-- ─── Creator drop-off ─────────────────────────────────────────────────────────
SELECT
  'Signup → Publish'        AS funnel_step,
  ROUND((1 - SUM(app_publish)::NUMERIC / NULLIF(SUM(creator_signup), 0)) * 100, 2) AS drop_off_pct
FROM analytics_daily_counts WHERE date_key >= CURRENT_DATE - INTERVAL '30 days';


-- ─── Most active creators (from event log) ───────────────────────────────────
-- Firestore equivalent:
--   db.collection("analyticsEvents")
--     .where("event_name", "==", "app_publish")
--     .orderBy("created_at", "desc")
--     .limit(500)

SELECT
  creator_id,
  COUNT(*)                          AS total_publishes,
  MAX(created_at)                   AS last_publish_at,
  MIN(created_at)                   AS first_publish_at
FROM analytics_events
WHERE event_name   = 'app_publish'
  AND date_key    >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY creator_id
ORDER BY total_publishes DESC
LIMIT 20;
