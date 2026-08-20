export interface UserProfile {
  id: string;
  user_id: string;
  name: string | null;
  age: number | null;
  gender: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  goal: string | null;
  desired_result: string | null;
  workout_frequency: number | null;
  workout_location: string | null;
  workout_duration_min: number | null;
  usual_schedule: string | null;
  busy_times: string | null;
  impossible_days: string | null;
  liked_exercises: string | null;
  disliked_exercises: string | null;
  onboarding_completed: boolean;
  plan_generated: boolean;
  created_at: string;
  updated_at: string;
}

export interface Workout {
  id: string;
  user_id: string;
  plan_id: string | null;
  name: string | null;
  status: 'planned' | 'active' | 'completed' | 'skipped';
  scheduled_date: string | null;
  scheduled_time: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_sec: number | null;
  total_volume_kg: number | null;
  total_sets: number | null;
  total_reps: number | null;
  ai_summary: string | null;
  ai_recommendation: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkoutExercise {
  id: string;
  workout_id: string;
  exercise_id: string | null;
  exercise_name: string;
  sort_order: number;
  notes: string | null;
  workout_sets?: WorkoutSet[];
}

export interface WorkoutSet {
  id: string;
  workout_exercise_id: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  duration_sec: number | null;
  rest_sec: number | null;
  notes: string | null;
  created_at: string;
}

export interface MealEntry {
  id: string;
  user_id: string;
  raw_text: string | null;
  meal_type: string | null;
  entry_time: string;
  total_calories: number | null;
  total_protein: number | null;
  total_fat: number | null;
  total_carbs: number | null;
  confidence: string | null;
  is_estimate: boolean;
  created_at: string;
  updated_at: string;
  meal_items?: MealItem[];
}

export interface MealItem {
  id: string;
  meal_entry_id: string;
  food_name: string;
  quantity_desc: string | null;
  estimated_calories: number | null;
  estimated_protein: number | null;
  estimated_fat: number | null;
  estimated_carbs: number | null;
  is_estimate: boolean;
}

export interface BodyMeasurement {
  id: string;
  user_id: string;
  weight_kg: number | null;
  waist_cm: number | null;
  chest_cm: number | null;
  biceps_cm: number | null;
  hips_cm: number | null;
  thigh_cm: number | null;
  measured_at: string;
  notes: string | null;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  action_type: string | null;
  action_data: any;
  metadata: any;
  created_at: string;
}

export interface ChatConversation {
  id: string;
  user_id: string;
  title: string | null;
  context_summary: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  is_read: boolean;
  action_url: string | null;
  created_at: string;
}

export interface PersonalRecord {
  id: string;
  user_id: string;
  exercise_name: string;
  record_type: 'max_weight' | 'max_reps' | 'max_volume' | 'best_duration';
  value: number;
  unit: string | null;
  workout_id: string | null;
  achieved_at: string;
}

export interface WellnessLog {
  id: string;
  user_id: string;
  mood: string | null;
  fatigue_level: number | null;
  soreness_level: number | null;
  sleep_hours: number | null;
  notes: string | null;
  logged_at: string;
}

export interface WorkoutPlan {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  plan_data: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AIResponse {
  message: string;
  actions: AIAction[];
  executedActions: any[];
  conversationId: string;
}

export interface AIAction {
  action: string;
  data: Record<string, any>;
}
