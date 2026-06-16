-- =====================================================================
-- top_searches.sql — Daxini.Space Top Search Terms
-- =====================================================================
-- Reads metadata_json from analyticsEvents where event_name = 'search_performed'.
-- The query field is stored as: metadata_json->>'query'

-- ─── Top 20 search terms — all time ──────────────────────────────────────────
SELECT
  metadata_json ->> 'query'                              AS query,
  COUNT(*)                                               AS count,
  MAX(created_at)                                        AS last_searched_at
FROM   analytics_events
WHERE  event_name = 'search_performed'
  AND  (metadata_json ->> 'query') IS NOT NULL
  AND  LENGTH(TRIM(metadata_json ->> 'query')) > 0
GROUP  BY metadata_json ->> 'query'
ORDER  BY count DESC
LIMIT  20;


-- ─── Top 20 search terms — last 7 days ───────────────────────────────────────
SELECT
  metadata_json ->> 'query'                              AS query,
  COUNT(*)                                               AS count
FROM   analytics_events
WHERE  event_name = 'search_performed'
  AND  date_key  >= CURRENT_DATE - INTERVAL '7 days'
  AND  (metadata_json ->> 'query') IS NOT NULL
GROUP  BY metadata_json ->> 'query'
ORDER  BY count DESC
LIMIT  20;


-- ─── Search volume by day ─────────────────────────────────────────────────────
SELECT
  date_key,
  COUNT(*)   AS searches
FROM   analytics_events
WHERE  event_name = 'search_performed'
  AND  date_key  >= CURRENT_DATE - INTERVAL '30 days'
GROUP  BY date_key
ORDER  BY date_key ASC;
