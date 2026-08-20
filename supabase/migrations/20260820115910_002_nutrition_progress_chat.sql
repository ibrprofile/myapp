/*
# Nutrition, progress, chat, and system tables

1. New Tables
- `meal_entries` — a meal/log entry (raw text, time, confidence)
- `meal_items` — individual food items within a meal with estimated macros
- `body_measurements` — weight, waist, chest, biceps, hips, thigh over time
- `progress_photos` — progress photo storage paths
- `personal_records` — PRs per exercise (max weight, reps, volume)
- `chat_conversations` — conversation metadata
- `chat_messages` — individual messages (user + assistant)
- `ai_events` — structured AI actions (action type + JSON data)
- `notifications` — in-app notifications
- `email_queue` — queued emails for worker
- `habits` — habit definitions and check-ins
- `wellness_logs` — diary of well-being, fatigue, soreness
- `jobs` — background job queue
- `admin_users` — admin role flags

2. Security
- RLS on all user-scoped tables, 4 CRUD policies each, authenticated + auth.uid() = user_id.
- user_id defaults to auth.uid() for seamless client inserts.
*/

-- ============ MEAL ENTRIES ============
CREATE TABLE IF NOT EXISTS meal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_text text,
  meal_type text,
  entry_time timestamptz DEFAULT now(),
  total_calories numeric,
  total_protein numeric,
  total_fat numeric,
  total_carbs numeric,
  confidence text DEFAULT 'medium' CHECK (confidence IN ('low','medium','high')),
  is_estimate boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE meal_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_meals" ON meal_entries;
CREATE POLICY "select_own_meals" ON meal_entries FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_meals" ON meal_entries;
CREATE POLICY "insert_own_meals" ON meal_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_meals" ON meal_entries;
CREATE POLICY "update_own_meals" ON meal_entries FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_meals" ON meal_entries;
CREATE POLICY "delete_own_meals" ON meal_entries FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_meals_user_time ON meal_entries(user_id, entry_time);

-- ============ MEAL ITEMS ============
CREATE TABLE IF NOT EXISTS meal_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_entry_id uuid NOT NULL REFERENCES meal_entries(id) ON DELETE CASCADE,
  food_name text NOT NULL,
  quantity_desc text,
  estimated_calories numeric,
  estimated_protein numeric,
  estimated_fat numeric,
  estimated_carbs numeric,
  is_estimate boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE meal_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_meal_items" ON meal_items;
CREATE POLICY "select_own_meal_items" ON meal_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM meal_entries WHERE meal_entries.id = meal_items.meal_entry_id AND meal_entries.user_id = auth.uid())
);
DROP POLICY IF EXISTS "insert_own_meal_items" ON meal_items;
CREATE POLICY "insert_own_meal_items" ON meal_items FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM meal_entries WHERE meal_entries.id = meal_items.meal_entry_id AND meal_entries.user_id = auth.uid())
);
DROP POLICY IF EXISTS "update_own_meal_items" ON meal_items;
CREATE POLICY "update_own_meal_items" ON meal_items FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM meal_entries WHERE meal_entries.id = meal_items.meal_entry_id AND meal_entries.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM meal_entries WHERE meal_entries.id = meal_items.meal_entry_id AND meal_entries.user_id = auth.uid())
);
DROP POLICY IF EXISTS "delete_own_meal_items" ON meal_items;
CREATE POLICY "delete_own_meal_items" ON meal_items FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM meal_entries WHERE meal_entries.id = meal_items.meal_entry_id AND meal_entries.user_id = auth.uid())
);
CREATE INDEX IF NOT EXISTS idx_meal_items_entry ON meal_items(meal_entry_id);

-- ============ BODY MEASUREMENTS ============
CREATE TABLE IF NOT EXISTS body_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  weight_kg numeric,
  waist_cm numeric,
  chest_cm numeric,
  biceps_cm numeric,
  hips_cm numeric,
  thigh_cm numeric,
  measured_at timestamptz DEFAULT now(),
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_measurements" ON body_measurements;
CREATE POLICY "select_own_measurements" ON body_measurements FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_measurements" ON body_measurements;
CREATE POLICY "insert_own_measurements" ON body_measurements FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_measurements" ON body_measurements;
CREATE POLICY "update_own_measurements" ON body_measurements FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_measurements" ON body_measurements;
CREATE POLICY "delete_own_measurements" ON body_measurements FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_measurements_user_time ON body_measurements(user_id, measured_at);

-- ============ PROGRESS PHOTOS ============
CREATE TABLE IF NOT EXISTS progress_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  caption text,
  taken_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE progress_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_photos" ON progress_photos;
CREATE POLICY "select_own_photos" ON progress_photos FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_photos" ON progress_photos;
CREATE POLICY "insert_own_photos" ON progress_photos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_photos" ON progress_photos;
CREATE POLICY "update_own_photos" ON progress_photos FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_photos" ON progress_photos;
CREATE POLICY "delete_own_photos" ON progress_photos FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ PERSONAL RECORDS ============
CREATE TABLE IF NOT EXISTS personal_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_name text NOT NULL,
  record_type text NOT NULL CHECK (record_type IN ('max_weight','max_reps','max_volume','best_duration')),
  value numeric NOT NULL,
  unit text,
  workout_id uuid REFERENCES workouts(id) ON DELETE SET NULL,
  achieved_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_prs" ON personal_records;
CREATE POLICY "select_own_prs" ON personal_records FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_prs" ON personal_records;
CREATE POLICY "insert_own_prs" ON personal_records FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_prs" ON personal_records;
CREATE POLICY "update_own_prs" ON personal_records FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_prs" ON personal_records;
CREATE POLICY "delete_own_prs" ON personal_records FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_prs_user_exercise ON personal_records(user_id, exercise_name);

-- ============ CHAT CONVERSATIONS ============
CREATE TABLE IF NOT EXISTS chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  context_summary text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_conversations" ON chat_conversations;
CREATE POLICY "select_own_conversations" ON chat_conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_conversations" ON chat_conversations;
CREATE POLICY "insert_own_conversations" ON chat_conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_conversations" ON chat_conversations;
CREATE POLICY "update_own_conversations" ON chat_conversations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_conversations" ON chat_conversations;
CREATE POLICY "delete_own_conversations" ON chat_conversations FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ CHAT MESSAGES ============
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  action_type text,
  action_data jsonb,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_messages" ON chat_messages;
CREATE POLICY "select_own_messages" ON chat_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_messages" ON chat_messages;
CREATE POLICY "insert_own_messages" ON chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_messages" ON chat_messages;
CREATE POLICY "update_own_messages" ON chat_messages FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_messages" ON chat_messages;
CREATE POLICY "delete_own_messages" ON chat_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON chat_messages(conversation_id, created_at);

-- ============ AI EVENTS ============
CREATE TABLE IF NOT EXISTS ai_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  action_type text,
  action_data jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processed','failed','skipped')),
  result jsonb,
  error_message text,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);
ALTER TABLE ai_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_ai_events" ON ai_events;
CREATE POLICY "select_own_ai_events" ON ai_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_ai_events" ON ai_events;
CREATE POLICY "insert_own_ai_events" ON ai_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_ai_events" ON ai_events;
CREATE POLICY "update_own_ai_events" ON ai_events FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_ai_events" ON ai_events;
CREATE POLICY "delete_own_ai_events" ON ai_events FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_ai_events_status ON ai_events(status, created_at);

-- ============ NOTIFICATIONS ============
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  is_read boolean NOT NULL DEFAULT false,
  action_url text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_notifications" ON notifications;
CREATE POLICY "select_own_notifications" ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_notifications" ON notifications;
CREATE POLICY "insert_own_notifications" ON notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_notifications" ON notifications;
CREATE POLICY "update_own_notifications" ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_notifications" ON notifications;
CREATE POLICY "delete_own_notifications" ON notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read, created_at);

-- ============ EMAIL QUEUE ============
CREATE TABLE IF NOT EXISTS email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  to_email text NOT NULL,
  subject text NOT NULL,
  html_body text,
  text_body text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sending','sent','failed')),
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz DEFAULT now(),
  sent_at timestamptz
);
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_email_queue" ON email_queue;
CREATE POLICY "select_own_email_queue" ON email_queue FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status, created_at);

-- ============ HABITS ============
CREATE TABLE IF NOT EXISTS habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  target_value numeric,
  unit text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_habits" ON habits;
CREATE POLICY "select_own_habits" ON habits FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_habits" ON habits;
CREATE POLICY "insert_own_habits" ON habits FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_habits" ON habits;
CREATE POLICY "update_own_habits" ON habits FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_habits" ON habits;
CREATE POLICY "delete_own_habits" ON habits FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS habit_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id uuid NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  value numeric,
  note text,
  checked_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(habit_id, checked_at)
);
ALTER TABLE habit_checkins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_checkins" ON habit_checkins;
CREATE POLICY "select_own_checkins" ON habit_checkins FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_checkins" ON habit_checkins;
CREATE POLICY "insert_own_checkins" ON habit_checkins FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_checkins" ON habit_checkins;
CREATE POLICY "update_own_checkins" ON habit_checkins FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_checkins" ON habit_checkins;
CREATE POLICY "delete_own_checkins" ON habit_checkins FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_checkins_user_date ON habit_checkins(user_id, checked_at);

-- ============ WELLNESS LOGS ============
CREATE TABLE IF NOT EXISTS wellness_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  mood text,
  fatigue_level int CHECK (fatigue_level BETWEEN 1 AND 10),
  soreness_level int CHECK (soreness_level BETWEEN 1 AND 10),
  sleep_hours numeric,
  notes text,
  logged_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE wellness_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_wellness" ON wellness_logs;
CREATE POLICY "select_own_wellness" ON wellness_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_wellness" ON wellness_logs;
CREATE POLICY "insert_own_wellness" ON wellness_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_wellness" ON wellness_logs;
CREATE POLICY "update_own_wellness" ON wellness_logs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_wellness" ON wellness_logs;
CREATE POLICY "delete_own_wellness" ON wellness_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_wellness_user_time ON wellness_logs(user_id, logged_at);

-- ============ JOBS (background queue) ============
CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  job_type text NOT NULL,
  payload jsonb,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','completed','failed')),
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 3,
  last_error text,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  completed_at timestamptz
);
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_jobs" ON jobs;
CREATE POLICY "select_own_jobs" ON jobs FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_jobs" ON jobs;
CREATE POLICY "insert_own_jobs" ON jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status, created_at);

-- ============ ADMIN USERS ============
CREATE TABLE IF NOT EXISTS admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_admin boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_admin_self" ON admin_users;
CREATE POLICY "read_admin_self" ON admin_users FOR SELECT TO authenticated USING (auth.uid() = user_id);
