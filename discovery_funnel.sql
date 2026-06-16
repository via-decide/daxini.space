-- =====================================================================
-- discovery_funnel.sql — Daxini.Space Discovery Funnel
-- =====================================================================

-- ─── 30-day discovery funnel aggregation ─────────────────────────────────────
SELECT
  SUM(search_performed)    AS total_searches,
  SUM(app_view)            AS total_views,
  SUM(app_install_click)   AS total_install_clicks,
  SUM(category_opened)     AS total_categories_opened,
  SUM(external_link_click) AS total_external_clicks,

  -- Funnel rates
  ROUND(SUM(app_view)::NUMERIC          / NULLIF(SUM(search_performed), 0) * 100, 2) AS view_rate_pct,
  ROUND(SUM(app_install_click)::NUMERIC / NULLIF(SUM(app_view),         0) * 100, 2) AS install_intent_pct

FROM analytics_daily_counts
WHERE date_key >= CURRENT_DATE - INTERVAL '30 days';


-- ─── Daily discovery trend ────────────────────────────────────────────────────
SELECT
  date_key,
  search_performed,
  app_view,
  app_install_click
FROM analytics_daily_counts
WHERE date_key >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY date_key ASC;


-- ─── Drop-off between funnel steps ───────────────────────────────────────────
SELECT
  'Search → View'         AS funnel_step,
  ROUND((1 - SUM(app_view)::NUMERIC / NULLIF(SUM(search_performed), 0)) * 100, 2) AS drop_off_pct
FROM analytics_daily_counts WHERE date_key >= CURRENT_DATE - INTERVAL '30 days'

UNION ALL

SELECT
  'View → Install Click',
  ROUND((1 - SUM(app_install_click)::NUMERIC / NULLIF(SUM(app_view), 0)) * 100, 2)
FROM analytics_daily_counts WHERE date_key >= CURRENT_DATE - INTERVAL '30 days'

ORDER BY drop_off_pct DESC;
