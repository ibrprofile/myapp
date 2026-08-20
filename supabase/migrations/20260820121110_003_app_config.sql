/*
# App configuration table for server-side secrets

1. New Tables
- `app_config` — stores server-side configuration like API keys
  - `key` (text, primary key): config key name
  - `value` (text): the value
  - `created_at`, `updated_at`

2. Security
- RLS enabled, NO policies added — table is completely locked down.
- Only the service role (used by edge functions) can read/write, bypassing RLS.
- The anon/authenticated roles cannot access this table at all.
*/

CREATE TABLE IF NOT EXISTS app_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
