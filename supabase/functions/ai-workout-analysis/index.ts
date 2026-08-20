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
    const { workoutId } = body;

    const { data: workout } = await supabase.from('workouts').select('*').eq('id', workoutId).eq('user_id', user.id).maybeSingle();
    if (!workout) {
      return new Response(JSON.stringify({ error: 'Workout not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: exercises } = await supabase.from('workout_exercises').select(`
      *,
      workout_sets(*)
    `).eq('workout_id', workoutId);

    const { data: prevWorkouts } = await supabase.from('workouts').select('id,name,total_volume_kg,total_sets,total_reps,duration_sec,completed_at,ai_summary')
      .eq('user_id', user.id).eq('status', 'completed').order('completed_at', { ascending: false }).limit(3);

    const workoutData = {
      current: {
        name: workout.name,
        exercises: (exercises || []).map((e: any) => ({
          name: e.exercise_name,
          sets: (e.workout_sets || []).map((s: any) => ({ weight: s.weight_kg, reps: s.reps })),
        })),
        total_volume: workout.total_volume_kg,
        total_sets: workout.total_sets,
        total_reps: workout.total_reps,
        duration: workout.duration_sec,
      },
      previous: (prevWorkouts || []).map((w: any) => ({
        name: w.name,
        total_volume: w.total_volume_kg,
        total_sets: w.total_sets,
        total_reps: w.total_reps,
        duration: w.duration_sec,
      })),
    };

    const systemPrompt = `Ты — Теса, персональный AI-тренер. Проанализируй завершенную тренировку пользователя и дай персональный отчёт. Ответь в формате JSON:
{
  "summary": "краткое резюме тренировки",
  "stats": { "exercises": 0, "sets": 0, "reps": 0, "volume_kg": 0, "duration": "" },
  "progress_percent": 0,
  "what_went_well": ["...", "..."],
  "what_to_improve": ["...", "..."],
  "next_time_tips": ["...", "..."],
  "personal_comment": "персональный комментарий от Тесы",
  "new_records": [{ "exercise": "...", "type": "max_weight", "value": 0, "unit": "кг" }]
}

Данные тренировки (JSON):
${JSON.stringify(workoutData, null, 2)}

Сравни с предыдущими тренировками. Вычисли прогресс в процентах. Определи личные рекорды. Будь мотивирующим, но честным. Отвечай ТОЛЬКО валидным JSON на русском.`;

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
        temperature: 0.7,
        max_tokens: 2000,
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
    const analysis = JSON.parse(cleanContent);

    await supabase.from('workouts').update({
      ai_summary: analysis.summary,
      ai_recommendation: analysis.personal_comment,
      updated_at: new Date().toISOString(),
    }).eq('id', workoutId);

    if (analysis.new_records) {
      for (const record of analysis.new_records) {
        await supabase.from('personal_records').insert({
          user_id: user.id,
          exercise_name: record.exercise,
          record_type: record.type,
          value: record.value,
          unit: record.unit,
          workout_id: workoutId,
        });
      }
    }

    return new Response(JSON.stringify(analysis), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
