import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { analyzeWorkout } from '@/lib/ai';
import { ArrowLeft, Plus, Check, Timer, X, Dumbbell, Activity, Zap } from 'lucide-react';

interface ExerciseData {
  id: string;
  exercise_name: string;
  sets: { weight_kg: number | null; reps: number | null }[];
}

export default function ActiveWorkoutScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [workout, setWorkout] = useState<any>(null);
  const [exercises, setExercises] = useState<ExerciseData[]>([]);
  const [newExercise, setNewExercise] = useState('');
  const [inputText, setInputText] = useState('');
  const [activeExerciseIdx, setActiveExerciseIdx] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [restRemaining, setRestRemaining] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [showFinishScreen, setShowFinishScreen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('workouts').select('*').eq('user_id', user!.id).eq('status', 'active').maybeSingle();
      if (!data) { navigate('/workouts'); return; }
      setWorkout(data);
      const { data: exs } = await supabase.from('workout_exercises').select('*').eq('workout_id', data.id).order('sort_order');
      const exWithSets: ExerciseData[] = [];
      for (const ex of exs || []) {
        const { data: sets } = await supabase.from('workout_sets').select('*').eq('workout_exercise_id', ex.id).order('set_number');
        exWithSets.push({ id: ex.id, exercise_name: ex.exercise_name, sets: (sets || []).map((s: any) => ({ weight_kg: s.weight_kg, reps: s.reps })) });
      }
      setExercises(exWithSets);
    }
    load();
  }, [user]);

  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    if (restTimer && restTimer > 0) {
      setRestRemaining(restTimer);
      restRef.current = setInterval(() => {
        setRestRemaining(r => {
          if (r <= 1) { if (restRef.current) clearInterval(restRef.current); setRestTimer(null); return 0; }
          return r - 1;
        });
      }, 1000);
      return () => { if (restRef.current) clearInterval(restRef.current); };
    }
  }, [restTimer]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  async function addExercise() {
    if (!newExercise.trim() || !workout) return;
    const { data } = await supabase.from('workout_exercises').insert({
      workout_id: workout.id,
      exercise_name: newExercise.trim(),
      sort_order: exercises.length,
    }).select().single();
    setExercises([...exercises, { id: data.id, exercise_name: newExercise.trim(), sets: [] }]);
    setActiveExerciseIdx(exercises.length);
    setNewExercise('');
  }

  async function addSet(exIdx: number, weight: number | null, reps: number | null) {
    const ex = exercises[exIdx];
    const setNumber = ex.sets.length + 1;
    const { data } = await supabase.from('workout_sets').insert({
      workout_exercise_id: ex.id,
      set_number: setNumber,
      weight_kg: weight,
      reps: reps,
    }).select().single();
    const newSets = [...ex.sets, { weight_kg: weight, reps: reps }];
    const newExercises = [...exercises];
    newExercises[exIdx] = { ...ex, sets: newSets };
    setExercises(newExercises);
    setRestTimer(90);
  }

  function parseSetInput(text: string): { weight: number | null; reps: number | null } {
    const wMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:кг|kg|с|к)?/i);
    const rMatch = text.match(/(\d+)\s*(?:раз|повтор|rep|x)/i);
    const simpleMatch = text.match(/^(\d+(?:\.\d+)?)\s*(?:на|x|×|\*)\s*(\d+)/i);
    if (simpleMatch) return { weight: parseFloat(simpleMatch[1]), reps: parseInt(simpleMatch[2]) };
    const reverseMatch = text.match(/^(\d+)\s*(?:раз|повтор|rep)?/i);
    if (wMatch && rMatch) {
      const w = parseFloat(wMatch[1]);
      const r = parseInt(rMatch[1]);
      if (text.indexOf(wMatch[0]) < text.indexOf(rMatch[0])) return { weight: w, reps: r };
      return { weight: w, reps: r };
    }
    if (reverseMatch && !wMatch) return { weight: null, reps: parseInt(reverseMatch[1]) };
    if (wMatch) return { weight: parseFloat(wMatch[1]), reps: null };
    if (rMatch) return { weight: null, reps: parseInt(rMatch[1]) };
    return { weight: null, reps: null };
  }

  function handleSetInput(exIdx: number) {
    if (!inputText.trim()) return;
    const { weight, reps } = parseSetInput(inputText);
    if (weight === null && reps === null) return;
    addSet(exIdx, weight, reps);
    setInputText('');
  }

  const totalVolume = exercises.reduce((sum, ex) => sum + ex.sets.reduce((s, set) => s + (set.weight_kg || 0) * (set.reps || 0), 0), 0);
  const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  const totalReps = exercises.reduce((sum, ex) => sum + ex.sets.reduce((s, set) => s + (set.reps || 0), 0), 0);

  const finishWorkout = useCallback(async () => {
    if (!workout) return;
    setFinishing(true);
    const completedAt = new Date().toISOString();
    const duration = Math.round((new Date(completedAt).getTime() - new Date(workout.started_at).getTime()) / 1000);
    await supabase.from('workouts').update({
      status: 'completed',
      completed_at: completedAt,
      duration_sec: duration,
      total_volume_kg: totalVolume,
      total_sets: totalSets,
      total_reps: totalReps,
    }).eq('id', workout.id);
    try {
      const result = await analyzeWorkout(workout.id);
      setAnalysis(result);
    } catch {
      setAnalysis({ summary: 'Тренировка завершена!', personal_comment: 'Анализ будет доступен позже.' });
    }
    setFinishing(false);
    setShowFinishScreen(true);
  }, [workout, totalVolume, totalSets, totalReps]);

  if (showFinishScreen && analysis) {
    return (
      <main className="active-workout" style={{ justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#0a0a0f' }}>
            <Check size={32} />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700 }}>Тренировка завершена</h1>
        </div>
        <div className="aw-stats">
          <div className="aw-stat"><strong>{exercises.length}</strong><span>Упражнений</span></div>
          <div className="aw-stat"><strong>{totalSets}</strong><span>Подходов</span></div>
          <div className="aw-stat"><strong>{totalReps}</strong><span>Повторений</span></div>
          <div className="aw-stat"><strong>{Math.round(totalVolume)}</strong><span>Объём кг</span></div>
        </div>
        {analysis.stats?.duration && <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>Время: {analysis.stats.duration}</p>}
        {analysis.progress_percent != null && (
          <div style={{ textAlign: 'center', margin: '12px 0' }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: analysis.progress_percent >= 0 ? 'var(--success)' : 'var(--warning)' }}>
              {analysis.progress_percent >= 0 ? '+' : ''}{analysis.progress_percent}%
            </span>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>к прошлой тренировке</p>
          </div>
        )}
        <div className="tesa-message" style={{ marginTop: 16 }}>
          <div className="tesa-avatar"><Activity size={18} /></div>
          <p>{analysis.personal_comment || analysis.summary}</p>
        </div>
        {analysis.what_went_well?.length > 0 && (
          <section className="card">
            <span className="card-title">Что получилось хорошо</span>
            {analysis.what_went_well.map((item: string, i: number) => <p key={i} style={{ fontSize: 14 }}>• {item}</p>)}
          </section>
        )}
        {analysis.what_to_improve?.length > 0 && (
          <section className="card">
            <span className="card-title">Что улучшить</span>
            {analysis.what_to_improve.map((item: string, i: number) => <p key={i} style={{ fontSize: 14 }}>• {item}</p>)}
          </section>
        )}
        {analysis.next_time_tips?.length > 0 && (
          <section className="card">
            <span className="card-title">В следующий раз</span>
            {analysis.next_time_tips.map((item: string, i: number) => <p key={i} style={{ fontSize: 14 }}>• {item}</p>)}
          </section>
        )}
        <button className="btn-primary" onClick={() => navigate('/workouts')} style={{ marginTop: 16 }}>Готово</button>
      </main>
    );
  }

  if (finishing) {
    return (
      <main className="active-workout plan-building">
        <div className="plan-orbit"><Activity size={32} /></div>
        <span className="eyebrow">ТЕСА АНАЛИЗИРУЕТ</span>
        <h1>Анализирую<br /><span className="gradient-text">тренировку</span></h1>
        <div className="build-list">
          {['Анализ нагрузки', 'Сравнение с прошлыми', 'Оценка прогресса', 'Рекомендации'].map((item, i) => (
            <div key={item} className="build-item" style={{ animationDelay: `${i * 0.4}s` }}><Check size={16} /><span>{item}</span></div>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="active-workout">
      <header className="aw-header">
        <button onClick={() => navigate('/workouts')} style={{ color: 'var(--text-secondary)', display: 'flex' }}><ArrowLeft size={24} /></button>
        <div style={{ flex: 1 }}>
          <span className="eyebrow">АКТИВНАЯ ТРЕНИРОВКА</span>
          <div className="aw-timer">{formatTime(elapsed)}</div>
        </div>
        <button onClick={finishWorkout} style={{ color: 'var(--success)', fontWeight: 600, fontSize: 15 }}>Завершить</button>
      </header>

      <div className="aw-stats">
        <div className="aw-stat"><strong>{exercises.length}</strong><span>Упражн.</span></div>
        <div className="aw-stat"><strong>{totalSets}</strong><span>Подходов</span></div>
        <div className="aw-stat"><strong>{Math.round(totalVolume)}</strong><span>Объём кг</span></div>
      </div>

      {restTimer !== null && restRemaining > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '16px', borderRadius: 'var(--radius-md)', background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.2)' }}>
          <Timer size={20} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>Отдых: {restRemaining}с</span>
          <button onClick={() => { setRestTimer(null); if (restRef.current) clearInterval(restRef.current); }} style={{ color: 'var(--text-tertiary)', display: 'flex' }}><X size={18} /></button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <input className="input-field" style={{ flex: 1 }} value={newExercise} onChange={e => setNewExercise(e.target.value)} onKeyDown={e => e.key === 'Enter' && addExercise()} placeholder="Название упражнения..." />
        <button onClick={addExercise} style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)', padding: '0 16px', color: 'var(--accent)' }}><Plus size={20} /></button>
      </div>

      {exercises.map((ex, exIdx) => (
        <div key={ex.id} className="exercise-block">
          <h3>
            {ex.exercise_name}
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{ex.sets.length} подходов</span>
          </h3>
          {ex.sets.map((set, sIdx) => (
            <div key={sIdx} className="set-row">
              <div className="set-num">{sIdx + 1}</div>
              <div className="set-data">
                <span><strong>{set.weight_kg ?? '-'}</strong> кг</span>
                <span>× <strong>{set.reps ?? '-'}</strong></span>
              </div>
            </div>
          ))}
          <div className="aw-input-row">
            <input
              autoFocus={activeExerciseIdx === exIdx}
              value={activeExerciseIdx === exIdx ? inputText : ''}
              onChange={e => { setInputText(e.target.value); setActiveExerciseIdx(exIdx); }}
              onKeyDown={e => e.key === 'Enter' && handleSetInput(exIdx)}
              placeholder="Например: 60 на 10"
            />
            <button onClick={() => handleSetInput(exIdx)}>Добавить</button>
          </div>
        </div>
      ))}

      {exercises.length === 0 && (
        <div className="empty-state">
          <Dumbbell size={48} />
          <p>Добавь первое упражнение.<br />Напиши его название выше.</p>
        </div>
      )}
    </main>
  );
}
