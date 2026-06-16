-- =====================================================================
-- top_apps.sql — Daxini.Space Top Apps by Views & Install Intent
-- =====================================================================

-- ─── Top 20 apps by views + install clicks ───────────────────────────────────
SELECT
  app_id                                                         AS app,
  SUM(CASE WHEN event_name = 'app_view'          THEN 1 ELSE 0 END) AS views,
  SUM(CASE WHEN event_name = 'app_install_click' THEN 1 ELSE 0 END) AS installs,
  ROUND(
    SUM(CASE WHEN event_name = 'app_install_click' THEN 1 ELSE 0 END)::NUMERIC
    / NULLIF(SUM(CASE WHEN event_name = 'app_view' THEN 1 ELSE 0 END), 0) * 100, 2
  )                                                              AS install_intent_pct
FROM   analytics_events
WHERE  event_name IN ('app_view', 'app_install_click')
  AND  app_id    != ''
  AND  date_key  >= CURRENT_DATE - INTERVAL '30 days'
GROUP  BY app_id
ORDER  BY views DESC
LIMIT  20;


-- ─── Top apps by install intent (% clicks / views) ───────────────────────────
SELECT
  app_id                                                         AS app,
  SUM(CASE WHEN event_name = 'app_view'          THEN 1 ELSE 0 END) AS views,
  SUM(CASE WHEN event_name = 'app_install_click' THEN 1 ELSE 0 END) AS installs,
  ROUND(
    SUM(CASE WHEN event_name = 'app_install_click' THEN 1 ELSE 0 END)::NUMERIC
    / NULLIF(SUM(CASE WHEN event_name = 'app_view' THEN 1 ELSE 0 END), 0) * 100, 2
  )                                                              AS install_intent_pct
FROM   analytics_events
WHERE  event_name IN ('app_view', 'app_install_click')
  AND  app_id    != ''
  AND  date_key  >= CURRENT_DATE - INTERVAL '30 days'
GROUP  BY app_id
HAVING SUM(CASE WHEN event_name = 'app_view' THEN 1 ELSE 0 END) >= 5  -- min 5 views
ORDER  BY install_intent_pct DESC
LIMIT  20;


-- ─── Daily views for a specific app (replace 'logichub') ─────────────────────
SELECT
  date_key,
  COUNT(*) AS views
FROM   analytics_events
WHERE  event_name = 'app_view'
  AND  app_id     = 'logichub'
  AND  date_key  >= CURRENT_DATE - INTERVAL '30 days'
GROUP  BY date_key
ORDER  BY date_key ASC;
