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
    const { profile } = body;

    const systemPrompt = `Ты — Теса, персональный AI-тренер. Создай персональный тренировочный план для пользователя на основе его данных. Ответь в формате JSON:
{
  "plan_name": "название плана",
  "description": "краткое описание",
  "plan_data": {
    "summary": "общая стратегия",
    "weekly_schedule": [
      { "day": "Понедельник", "type": "training", "focus": "грудь и трицепс", "exercises": ["жим лежа", "отжимания на брусьях", "разгибания на трицепс"] },
      { "day": "Вторник", "type": "rest" },
      ...
    ],
    "nutrition_guidelines": "рекомендации по питанию",
    "recovery_tips": "рекомендации по восстановлению",
    "milestones": [{ "week": 4, "goal": "цель на 4 неделе" }]
  },
  "greeting": "персональное приветствие от Тесы"
}

Данные пользователя:
- Имя: ${profile.name}
- Возраст: ${profile.age}
- Пол: ${profile.gender}
- Рост: ${profile.height_cm} см
- Вес: ${profile.weight_kg} кг
- Цель: ${profile.goal}
- Желаемый результат: ${profile.desired_result}
- Частота тренировок: ${profile.workout_frequency} раз/нед
- Место: ${profile.workout_location}
- Длительность: ${profile.workout_duration_min} мин
- График: ${profile.usual_schedule}
- Занят: ${profile.busy_times}
- Невозможные дни: ${profile.impossible_days}
- Любимые упражнения: ${profile.liked_exercises}
- Нелюбимые: ${profile.disliked_exercises}

Создай реалистичный, персональный план. Учитывай занятость и предпочтения. Не предлагай тренировки в невозможные дни. Отвечай ТОЛЬКО валидным JSON.`;

    const apiKey = await getApiKey();
    if (!apiKey) throw new Error('API key not configured');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    const response = await fetch(`${PROXYAPI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [{ role: 'user', content: systemPrompt }],
        temperature: 0.8,
        max_tokens: 3000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`ProxyAPI error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const plan = JSON.parse(cleanContent);

    await supabase.from('workout_plans').insert({
      user_id: user.id,
      name: plan.plan_name,
      description: plan.description,
      plan_data: plan.plan_data,
      is_active: true,
    });

    await supabase.from('user_profiles').update({
      plan_generated: true,
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id);

    return new Response(JSON.stringify(plan), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
