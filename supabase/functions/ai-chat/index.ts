import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const AI_MODEL = Deno.env.get('AI_MODEL') || 'gpt-5-nano';
const PROXYAPI_BASE_URL = Deno.env.get('PROXYAPI_BASE_URL') || 'https://api.proxyapi.ru/openai/v1';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

async function getApiKey(): Promise<string> {
  const { data } = await supabase.from('app_config').select('value').eq('key', 'PROXYAPI_API_KEY').maybeSingle();
  return data?.value || '';
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AIAction {
  action: string;
  data: Record<string, any>;
}

interface AIResponse {
  message: string;
  actions: AIAction[];
}

async function getUserContext(userId: string) {
  const [profile, goals, schedule, recentWorkouts, recentMeals, recentMeasurements, recentChat] = await Promise.all([
    supabase.from('user_profiles').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('user_goals').select('*').eq('user_id', userId).eq('is_active', true),
    supabase.from('user_schedule').select('*').eq('user_id', userId),
    supabase.from('workouts').select('id,name,status,scheduled_date,completed_at,total_volume_kg,total_sets,total_reps,duration_sec,ai_summary')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
    supabase.from('meal_entries').select('id,raw_text,entry_time,total_calories,total_protein,total_fat,total_carbs,confidence')
      .eq('user_id', userId).order('entry_time', { ascending: false }).limit(10),
    supabase.from('body_measurements').select('*').eq('user_id', userId).order('measured_at', { ascending: false }).limit(10),
    supabase.from('chat_messages').select('role,content,action_type,created_at')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
  ]);

  return {
    profile: profile.data,
    goals: goals.data || [],
    schedule: schedule.data || [],
    recentWorkouts: recentWorkouts.data || [],
    recentMeals: recentMeals.data || [],
    recentMeasurements: recentMeasurements.data || [],
    recentChat: (recentChat.data || []).reverse(),
  };
}

function buildSystemPrompt(ctx: any): string {
  const p = ctx.profile || {};
  const goals = (ctx.goals || []).map((g: any) => `${g.goal_type}: ${g.target_value || ''} ${g.target_unit || ''} — ${g.description || ''}`).join('; ');
  const schedule = (ctx.schedule || []).map((s: any) => `День ${s.day_of_week}: ${s.is_available ? 'свободен' : 'занят'} ${s.available_from || ''}-${s.available_to || ''} ${s.note || ''}`).join('; ');
  const workouts = (ctx.recentWorkouts || []).map((w: any) => `${w.name || 'Тренировка'} (${w.status}, ${w.scheduled_date || ''}, объем: ${w.total_volume_kg || 0}кг, ${w.total_sets || 0} подходов)`).join('\n');
  const meals = (ctx.recentMeals || []).map((m: any) => `${m.entry_time}: ${m.raw_text} (~${m.total_calories || 0}ккал, Б:${m.total_protein || 0} Ж:${m.total_fat || 0} У:${m.total_carbs || 0})`).join('\n');
  const measurements = (ctx.recentMeasurements || []).slice(0, 3).map((m: any) => `${m.measured_at}: вес ${m.weight_kg || '-'}кг, талия ${m.waist_cm || '-'}см`).join('\n');
  const chatHistory = (ctx.recentChat || []).map((m: any) => `${m.role}: ${m.content}`).join('\n');

  return `Ты — Теса, персональный AI-тренер, диетолог и менеджер пользователя. Ты говоришь на русском языке, дружелюбно, мотивирующе, но профессионально. Ты не робот, а заботливый наставник.

ВАЖНЫЕ ПРАВИЛА:
1. Ты не просто разговариваешь — ты выполняешь действия. Когда пользователь сообщает о тренировке, еде, весе, расписании — ты преобразуешь это в структурированные данные.
2. Никогда не ставь диагнозы, не назначай лекарства, не давай медицинские рекомендации. При жалобах на здоровье рекомендуй обратиться к врачу.
3. Для еды: оценки калорий и макросов всегда приблизительные. Указывай уверенность оценки (low/medium/high).
4. Не заставляй пользователя заполнять формы. Понимай естественный язык.
5. Будь concise — отвечай коротко и по делу, как настоящий тренер в мессенджере.

КОНТЕКСТ ПОЛЬЗОВАТЕЛЯ:
- Имя: ${p.name || 'неизвестно'}
- Возраст: ${p.age || '?'} лет
- Пол: ${p.gender || '?'}
- Рост: ${p.height_cm || '?'} см
- Вес: ${p.weight_kg || '?'} кг
- Главная цель: ${p.goal || '?'}
- Желаемый результат: ${p.desired_result || '?'}
- Частота тренировок: ${p.workout_frequency || '?'} раз/нед
- Место тренировок: ${p.workout_location || '?'}
- Длительность тренировки: ${p.workout_duration_min || '?'} мин
- График: ${p.usual_schedule || '?'}
- Занятые времена: ${p.busy_times || '?'}
- Невозможные дни: ${p.impossible_days || '?'}
- Любимые упражнения: ${p.liked_exercises || '?'}
- Нелюбимые упражнения: ${p.disliked_exercises || '?'}

АКТИВНЫЕ ЦЕЛИ: ${goals || 'нет'}

РАСПИСАНИЕ: ${schedule || 'не задано'}

ПОСЛЕДНИЕ ТРЕНИРОВКИ:
${workouts || 'нет данных'}

ПОСЛЕДНИЕ ПРИЕМЫ ПИЩИ:
${meals || 'нет данных'}

ПОСЛЕДНИЕ ИЗМЕРЕНИЯ:
${measurements || 'нет данных'}

НЕДАВНИЙ ЧАТ:
${chatHistory || 'нет истории'}

ФОРМАТ ОТВЕТА:
Ты ВСЕГДА отвечаешь в формате JSON. Верни объект:
{
  "message": "твой текст ответа пользователю (на русском, дружелюбный, короткий)",
  "actions": [
    {
      "action": "create_meal",
      "data": { "food_description": "...", "items": [...], "estimated_calories": 0, "estimated_protein": 0, "estimated_fat": 0, "estimated_carbs": 0, "confidence": "medium" }
    }
  ]
}

ДОСТУПНЫЕ ДЕЙСТВИЯ:
- create_meal: { food_description, items: [{food_name, quantity_desc, estimated_calories, estimated_protein, estimated_fat, estimated_carbs}], estimated_calories, estimated_protein, estimated_fat, estimated_carbs, confidence }
- create_workout_set: { exercise, weight, reps, set_number }
- create_measurement: { weight_kg, waist_cm, chest_cm, biceps_cm, hips_cm, thigh_cm }
- reschedule_workout: { old_date, new_date, reason }
- update_goal: { goal_type, target_value, target_unit, description }
- update_schedule: { day_of_week, available_from, available_to, is_available, note }
- log_wellness: { mood, fatigue_level, soreness_level, sleep_hours, notes }
- generate_plan: { plan_name, description, plan_data }
- create_notification: { type, title, body }

Если действие не нужно — верни пустой массив actions: [].
Если информации недостаточно для действия — задай уточняющий вопрос в message и не создавай действие.
ВСЕГДА возвращай только валидный JSON, без markdown, без пояснений вне JSON.`;
}

async function callAI(systemPrompt: string, messages: ChatMessage[], apiKey: string, maxRetries = 2): Promise<any> {
  const allMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${PROXYAPI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: allMessages,
          temperature: 0.7,
          max_tokens: 2000,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errText = await response.text();
        if (response.status >= 500 && attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        throw new Error(`ProxyAPI error ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      let parsed: AIResponse;
      try {
        const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(cleanContent);
      } catch {
        parsed = { message: content, actions: [] };
      }

      return parsed;
    } catch (err) {
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error('AI request failed after retries');
}

async function executeAction(userId: string, action: AIAction): Promise<any> {
  const { action: type, data } = action;

  switch (type) {
    case 'create_meal': {
      const mealInsert: any = {
        user_id: userId,
        raw_text: data.food_description,
        total_calories: data.estimated_calories,
        total_protein: data.estimated_protein,
        total_fat: data.estimated_fat,
        total_carbs: data.estimated_carbs,
        confidence: data.confidence || 'medium',
        is_estimate: true,
      };
      const { data: meal, error } = await supabase.from('meal_entries').insert(mealInsert).select().single();
      if (error) throw error;
      if (data.items && meal) {
        const items = data.items.map((it: any) => ({
          meal_entry_id: meal.id,
          food_name: it.food_name,
          quantity_desc: it.quantity_desc,
          estimated_calories: it.estimated_calories,
          estimated_protein: it.estimated_protein,
          estimated_fat: it.estimated_fat,
          estimated_carbs: it.estimated_carbs,
          is_estimate: true,
        }));
        await supabase.from('meal_items').insert(items);
      }
      return { meal_id: meal?.id };
    }
    case 'create_measurement': {
      const { error } = await supabase.from('body_measurements').insert({
        user_id: userId,
        weight_kg: data.weight_kg,
        waist_cm: data.waist_cm,
        chest_cm: data.chest_cm,
        biceps_cm: data.biceps_cm,
        hips_cm: data.hips_cm,
        thigh_cm: data.thigh_cm,
      });
      if (error) throw error;
      if (data.weight_kg) {
        await supabase.from('user_profiles').update({ weight_kg: data.weight_kg, updated_at: new Date().toISOString() }).eq('user_id', userId);
      }
      return { recorded: true };
    }
    case 'update_goal': {
      await supabase.from('user_goals').update({ is_active: false }).eq('user_id', userId).eq('goal_type', data.goal_type);
      const { error } = await supabase.from('user_goals').insert({
        user_id: userId,
        goal_type: data.goal_type,
        target_value: data.target_value,
        target_unit: data.target_unit,
        description: data.description,
        is_active: true,
      });
      if (error) throw error;
      return { updated: true };
    }
    case 'update_schedule': {
      const { error } = await supabase.from('user_schedule').upsert({
        user_id: userId,
        day_of_week: data.day_of_week,
        available_from: data.available_from,
        available_to: data.available_to,
        is_available: data.is_available,
        note: data.note,
      }, { onConflict: 'user_id,day_of_week' });
      if (error) throw error;
      return { updated: true };
    }
    case 'log_wellness': {
      const { error } = await supabase.from('wellness_logs').insert({
        user_id: userId,
        mood: data.mood,
        fatigue_level: data.fatigue_level,
        soreness_level: data.soreness_level,
        sleep_hours: data.sleep_hours,
        notes: data.notes,
      });
      if (error) throw error;
      return { logged: true };
    }
    case 'create_notification': {
      const { error } = await supabase.from('notifications').insert({
        user_id: userId,
        type: data.type,
        title: data.title,
        body: data.body,
      });
      if (error) throw error;
      return { created: true };
    }
    case 'generate_plan': {
      const { error } = await supabase.from('workout_plans').insert({
        user_id: userId,
        name: data.plan_name,
        description: data.description,
        plan_data: data.plan_data,
        is_active: true,
      });
      if (error) throw error;
      await supabase.from('user_profiles').update({ plan_generated: true, updated_at: new Date().toISOString() }).eq('user_id', userId);
      return { generated: true };
    }
    case 'create_workout_set': {
      let workoutId = data.workout_id;
      if (!workoutId) {
        const { data: activeW } = await supabase.from('workouts').select('id').eq('user_id', userId).eq('status', 'active').maybeSingle();
        if (!activeW) {
          const { data: newW } = await supabase.from('workouts').insert({
            user_id: userId,
            name: 'Тренировка',
            status: 'active',
            started_at: new Date().toISOString(),
          }).select().single();
          workoutId = newW?.id;
        } else {
          workoutId = activeW.id;
        }
      }
      let exerciseId = data.workout_exercise_id;
      if (!exerciseId) {
        const { data: ex } = await supabase.from('workout_exercises').insert({
          workout_id: workoutId,
          exercise_name: data.exercise,
          sort_order: 0,
        }).select().single();
        exerciseId = ex?.id;
      }
      const setNumber = data.set_number || 1;
      const { error } = await supabase.from('workout_sets').insert({
        workout_exercise_id: exerciseId,
        set_number: setNumber,
        weight_kg: data.weight,
        reps: data.reps,
      });
      if (error) throw error;
      return { workout_id: workoutId, exercise_id: exerciseId };
    }
    case 'reschedule_workout': {
      const { data: workout } = await supabase.from('workouts').select('id').eq('user_id', userId).eq('scheduled_date', data.old_date).eq('status', 'planned').maybeSingle();
      if (!workout) return { skipped: true, reason: 'Workout not found for old_date' };
      const { error } = await supabase.from('workouts').update({
        scheduled_date: data.new_date,
        updated_at: new Date().toISOString(),
      }).eq('id', workout.id);
      if (error) throw error;
      return { rescheduled: true, old_date: data.old_date, new_date: data.new_date };
    }
    default:
      return { skipped: true, reason: `Unknown action: ${type}` };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const { message, conversationId, mode } = body;

    if (!message) {
      return new Response(JSON.stringify({ error: 'Message required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const ctx = await getUserContext(user.id);
    const systemPrompt = buildSystemPrompt(ctx);

    let convId = conversationId;
    if (!convId) {
      const { data: conv } = await supabase.from('chat_conversations').insert({
        user_id: user.id,
        title: message.slice(0, 50),
      }).select().single();
      convId = conv?.id;
    }

    await supabase.from('chat_messages').insert({
      conversation_id: convId,
      user_id: user.id,
      role: 'user',
      content: message,
    });

    const recentMessages = (ctx.recentChat || []).slice(-10).map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const aiMessages: ChatMessage[] = [
      ...recentMessages,
      { role: 'user', content: message },
    ];

    const apiKey = await getApiKey();
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured', message: 'Теса сейчас немного занята. Данные сохранены, я обработаю их чуть позже.' }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const aiResult = await callAI(systemPrompt, aiMessages, apiKey);

    const executedActions: any[] = [];
    for (const action of aiResult.actions || []) {
      try {
        const result = await executeAction(user.id, action);
        executedActions.push({ action: action.action, result });
      } catch (err) {
        executedActions.push({ action: action.action, error: err.message });
      }
    }

    await supabase.from('chat_messages').insert({
      conversation_id: convId,
      user_id: user.id,
      role: 'assistant',
      content: aiResult.message,
      action_type: (aiResult.actions || []).length > 0 ? aiResult.actions[0].action : null,
      action_data: (aiResult.actions || []).length > 0 ? aiResult.actions[0].data : null,
      metadata: { executedActions },
    });

    await supabase.from('chat_conversations').update({ updated_at: new Date().toISOString() }).eq('id', convId);

    return new Response(JSON.stringify({
      message: aiResult.message,
      actions: aiResult.actions || [],
      executedActions,
      conversationId: convId,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({
      error: err.message,
      message: 'Теса сейчас немного занята. Данные сохранены, я обработаю их чуть позже.',
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
