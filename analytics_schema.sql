-- =====================================================================
-- Daxini.Space Analytics Schema — v1
-- Primary datastore: Firestore
-- This SQL is the schema contract and PostgreSQL migration template.
-- =====================================================================

-- ─── analyticsEvents — Immutable event log ───────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_events (
  id            TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
  event_name    TEXT        NOT NULL
                            CHECK (event_name IN (
                              'search_performed',
                              'category_opened',
                              'app_view',
                              'app_install_click',
                              'external_link_click',
                              'creator_signup',
                              'app_publish',
                              'returning_creator',
                              'returning_user'
                            )),
  user_id       TEXT        NOT NULL DEFAULT '',
  creator_id    TEXT        NOT NULL DEFAULT '',
  app_id        TEXT        NOT NULL DEFAULT '',
  session_id    TEXT        NOT NULL DEFAULT '',
  metadata_json JSONB       NOT NULL DEFAULT '{}',
  date_key      DATE        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (id)
);

-- Index patterns matching dashboard queries
CREATE INDEX IF NOT EXISTS idx_ds_ae_event      ON analytics_events (event_name);
CREATE INDEX IF NOT EXISTS idx_ds_ae_date       ON analytics_events (date_key);
CREATE INDEX IF NOT EXISTS idx_ds_ae_user       ON analytics_events (user_id);
CREATE INDEX IF NOT EXISTS idx_ds_ae_creator    ON analytics_events (creator_id);
CREATE INDEX IF NOT EXISTS idx_ds_ae_app        ON analytics_events (app_id);
CREATE INDEX IF NOT EXISTS idx_ds_ae_event_date ON analytics_events (event_name, date_key);


-- ─── analyticsDailyCounts — Mutable daily aggregates ─────────────────────────
CREATE TABLE IF NOT EXISTS analytics_daily_counts (
  date_key             DATE    NOT NULL,
  search_performed     INTEGER NOT NULL DEFAULT 0,
  category_opened      INTEGER NOT NULL DEFAULT 0,
  app_view             INTEGER NOT NULL DEFAULT 0,
  app_install_click    INTEGER NOT NULL DEFAULT 0,
  external_link_click  INTEGER NOT NULL DEFAULT 0,
  creator_signup       INTEGER NOT NULL DEFAULT 0,
  app_publish          INTEGER NOT NULL DEFAULT 0,
  returning_creator    INTEGER NOT NULL DEFAULT 0,
  returning_user       INTEGER NOT NULL DEFAULT 0,
  last_updated         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (date_key)
);

-- ─── Materialised Analytics View ─────────────────────────────────────────────
CREATE OR REPLACE VIEW analytics_platform_funnel AS
SELECT
  date_key,
  -- Discovery
  search_performed,
  category_opened,
  app_view,
  app_install_click,
  external_link_click,
  -- Creator
  creator_signup,
  app_publish,
  returning_creator,
  -- Retention
  returning_user,

  -- Discovery Funnel Rates
  ROUND(app_view::NUMERIC            / NULLIF(search_performed, 0) * 100, 2) AS view_rate_pct,
  ROUND(app_install_click::NUMERIC   / NULLIF(app_view,         0) * 100, 2) AS install_intent_pct,

  -- Creator Funnel Rates
  ROUND(app_publish::NUMERIC         / NULLIF(creator_signup,   0) * 100, 2) AS publish_conversion_pct,
  ROUND(returning_creator::NUMERIC   / NULLIF(creator_signup,   0) * 100, 2) AS creator_retention_pct

FROM analytics_daily_counts
ORDER BY date_key DESC;
