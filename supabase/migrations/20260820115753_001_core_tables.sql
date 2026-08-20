/*
# Core tables for Tesa AI companion app

1. Overview
This migration creates the foundational tables for a multi-user AI fitness companion app.
Every table is owner-scoped (user_id) with RLS enabled and authenticated-only policies.
The app uses Supabase Auth (email/password) — no custom auth tables.

2. New Tables
- `user_profiles` — onboarding data: name, age, gender, height, goals, preferences
- `user_goals` — current and historical goals (weight target, strength target, etc.)
- `user_schedule` — availability windows and busy times for workout planning
- `workout_plans` — AI-generated training plans
- `workouts` — individual workout sessions (planned or completed)
- `exercises` — exercise catalog (shared, not user-scoped)
- `workout_exercises` — exercises within a workout
- `workout_sets` — sets within an exercise (weight, reps, rest)
- `meal_entries` — a meal/log entry (time, description, confidence)
- `meal_items` — individual food items within a meal (calories, macros, estimate flag)
- `body_measurements` — weight, waist, chest, biceps, hips, thigh
- `progress_photos` — progress photo URLs with timestamps
- `personal_records` — PRs: max weight, max reps, max volume
- `chat_conversations` — conversation metadata
- `chat_messages` — individual messages (user + assistant)
- `ai_events` — structured AI actions (action type + JSON data) for audit/execution
- `notifications` — in-app notifications
- `email_queue` — queued emails for the worker
- `habits` — habit tracking (water, sleep, protein, etc.)
- `jobs` — background job queue for cron/worker processing
- `wellness_logs` — diary of well-being, fatigue, soreness

3. Security
- RLS enabled on ALL user-scoped tables.
- 4 CRUD policies per table (select/insert/update/delete), scoped TO authenticated with auth.uid() = user_id.
- `exercises` table is shared catalog: SELECT to anon, authenticated; writes authenticated only.
- `user_id` columns default to auth.uid() so client inserts without explicit user_id succeed.
*/

-- ============ USER PROFILES ============
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  age int,
  gender text CHECK (gender IN ('male','female','other')),
  height_cm numeric,
  weight_kg numeric,
  goal text,
  desired_result text,
  workout_frequency int,
  workout_location text,
  workout_duration_min int,
  usual_schedule text,
  busy_times text,
  impossible_days text,
  liked_exercises text,
  disliked_exercises text,
  onboarding_completed boolean NOT NULL DEFAULT false,
  plan_generated boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_profile" ON user_profiles;
CREATE POLICY "select_own_profile" ON user_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_profile" ON user_profiles;
CREATE POLICY "insert_own_profile" ON user_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_profile" ON user_profiles;
CREATE POLICY "update_own_profile" ON user_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_profile" ON user_profiles;
CREATE POLICY "delete_own_profile" ON user_profiles FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ USER GOALS ============
CREATE TABLE IF NOT EXISTS user_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_type text NOT NULL,
  target_value numeric,
  target_unit text,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_goals" ON user_goals;
CREATE POLICY "select_own_goals" ON user_goals FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_goals" ON user_goals;
CREATE POLICY "insert_own_goals" ON user_goals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_goals" ON user_goals;
CREATE POLICY "update_own_goals" ON user_goals FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_goals" ON user_goals;
CREATE POLICY "delete_own_goals" ON user_goals FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ USER SCHEDULE ============
CREATE TABLE IF NOT EXISTS user_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week int CHECK (day_of_week BETWEEN 0 AND 6),
  available_from time,
  available_to time,
  is_available boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE user_schedule ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_schedule" ON user_schedule;
CREATE POLICY "select_own_schedule" ON user_schedule FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_schedule" ON user_schedule;
CREATE POLICY "insert_own_schedule" ON user_schedule FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_schedule" ON user_schedule;
CREATE POLICY "update_own_schedule" ON user_schedule FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_schedule" ON user_schedule;
CREATE POLICY "delete_own_schedule" ON user_schedule FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ EXERCISES (shared catalog) ============
CREATE TABLE IF NOT EXISTS exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  muscle_groups text[],
  equipment text,
  is_compound boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_exercises" ON exercises;
CREATE POLICY "read_exercises" ON exercises FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "insert_exercises" ON exercises;
CREATE POLICY "insert_exercises" ON exercises FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_exercises" ON exercises;
CREATE POLICY "update_exercises" ON exercises FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============ WORKOUT PLANS ============
CREATE TABLE IF NOT EXISTS workout_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  plan_data jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE workout_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_plans" ON workout_plans;
CREATE POLICY "select_own_plans" ON workout_plans FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_plans" ON workout_plans;
CREATE POLICY "insert_own_plans" ON workout_plans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_plans" ON workout_plans;
CREATE POLICY "update_own_plans" ON workout_plans FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_plans" ON workout_plans;
CREATE POLICY "delete_own_plans" ON workout_plans FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ WORKOUTS ============
CREATE TABLE IF NOT EXISTS workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES workout_plans(id) ON DELETE SET NULL,
  name text,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','active','completed','skipped')),
  scheduled_date date,
  scheduled_time time,
  started_at timestamptz,
  completed_at timestamptz,
  duration_sec int,
  total_volume_kg numeric,
  total_sets int,
  total_reps int,
  ai_summary text,
  ai_recommendation text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_workouts" ON workouts;
CREATE POLICY "select_own_workouts" ON workouts FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_workouts" ON workouts;
CREATE POLICY "insert_own_workouts" ON workouts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_workouts" ON workouts;
CREATE POLICY "update_own_workouts" ON workouts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_workouts" ON workouts;
CREATE POLICY "delete_own_workouts" ON workouts FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_workouts_user_status ON workouts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_workouts_user_date ON workouts(user_id, scheduled_date);

-- ============ WORKOUT EXERCISES ============
CREATE TABLE IF NOT EXISTS workout_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id uuid NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id uuid REFERENCES exercises(id) ON DELETE SET NULL,
  exercise_name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_wo_exercises" ON workout_exercises;
CREATE POLICY "select_own_wo_exercises" ON workout_exercises FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM workouts WHERE workouts.id = workout_exercises.workout_id AND workouts.user_id = auth.uid())
);
DROP POLICY IF EXISTS "insert_own_wo_exercises" ON workout_exercises;
CREATE POLICY "insert_own_wo_exercises" ON workout_exercises FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM workouts WHERE workouts.id = workout_exercises.workout_id AND workouts.user_id = auth.uid())
);
DROP POLICY IF EXISTS "update_own_wo_exercises" ON workout_exercises;
CREATE POLICY "update_own_wo_exercises" ON workout_exercises FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM workouts WHERE workouts.id = workout_exercises.workout_id AND workouts.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM workouts WHERE workouts.id = workout_exercises.workout_id AND workouts.user_id = auth.uid())
);
DROP POLICY IF EXISTS "delete_own_wo_exercises" ON workout_exercises;
CREATE POLICY "delete_own_wo_exercises" ON workout_exercises FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM workouts WHERE workouts.id = workout_exercises.workout_id AND workouts.user_id = auth.uid())
);
CREATE INDEX IF NOT EXISTS idx_wo_exercises_workout ON workout_exercises(workout_id);

-- ============ WORKOUT SETS ============
CREATE TABLE IF NOT EXISTS workout_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_exercise_id uuid NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  set_number int NOT NULL DEFAULT 1,
  weight_kg numeric,
  reps int,
  duration_sec int,
  rest_sec int,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_sets" ON workout_sets;
CREATE POLICY "select_own_sets" ON workout_sets FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM workout_exercises we
    JOIN workouts w ON w.id = we.workout_id
    WHERE we.id = workout_sets.workout_exercise_id AND w.user_id = auth.uid()
  )
);
DROP POLICY IF EXISTS "insert_own_sets" ON workout_sets;
CREATE POLICY "insert_own_sets" ON workout_sets FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM workout_exercises we
    JOIN workouts w ON w.id = we.workout_id
    WHERE we.id = workout_sets.workout_exercise_id AND w.user_id = auth.uid()
  )
);
DROP POLICY IF EXISTS "update_own_sets" ON workout_sets;
CREATE POLICY "update_own_sets" ON workout_sets FOR UPDATE TO authenticated USING (
  EXISTS (
    SELECT 1 FROM workout_exercises we
    JOIN workouts w ON w.id = we.workout_id
    WHERE we.id = workout_sets.workout_exercise_id AND w.user_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM workout_exercises we
    JOIN workouts w ON w.id = we.workout_id
    WHERE we.id = workout_sets.workout_exercise_id AND w.user_id = auth.uid()
  )
);
DROP POLICY IF EXISTS "delete_own_sets" ON workout_sets;
CREATE POLICY "delete_own_sets" ON workout_sets FOR DELETE TO authenticated USING (
  EXISTS (
    SELECT 1 FROM workout_exercises we
    JOIN workouts w ON w.id = we.workout_id
    WHERE we.id = workout_sets.workout_exercise_id AND w.user_id = auth.uid()
  )
);
CREATE INDEX IF NOT EXISTS idx_sets_exercise ON workout_sets(workout_exercise_id);
