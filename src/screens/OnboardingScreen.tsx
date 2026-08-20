import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { generatePlan } from '@/lib/ai';
import './screen.css';

const steps = [
  { key: 'name', title: 'Как тебя зовут?', placeholder: 'Например, Алексей', type: 'text' },
  { key: 'age', title: 'Сколько тебе лет?', placeholder: 'Возраст', type: 'number' },
  { key: 'gender', title: 'Какой у тебя пол?', placeholder: 'Мужской, женский, другой...', type: 'text' },
  { key: 'height_cm', title: 'Какой у тебя рост?', placeholder: 'В сантиметрах', type: 'number' },
  { key: 'weight_kg', title: 'Какой сейчас вес?', placeholder: 'В килограммах', type: 'number' },
  { key: 'goal', title: 'Чего хочешь достичь?', placeholder: 'Напиши своими словами', type: 'text' },
  { key: 'workout_frequency', title: 'Сколько тренировок в неделю?', placeholder: 'Например, 3', type: 'number' },
  { key: 'workout_location', title: 'Где обычно тренируешься?', placeholder: 'Зал, дом, улица...', type: 'text' },
  { key: 'workout_duration_min', title: 'Сколько времени есть на тренировку?', placeholder: 'В минутах', type: 'number' },
  { key: 'usual_schedule', title: 'Как выглядит твой обычный график?', placeholder: 'Расскажи в свободной форме', type: 'text' },
  { key: 'busy_times', title: 'Когда ты занят?', placeholder: 'Например, будни до 18:00', type: 'text' },
  { key: 'liked_exercises', title: 'Какие тренировки нравятся?', placeholder: 'Можно перечислить или описать', type: 'text' },
  { key: 'disliked_exercises', title: 'Какие упражнения не нравятся?', placeholder: 'Что точно не хочешь делать', type: 'text' },
];

export default function OnboardingScreen() {
  const { user, refreshProfile } = useAuth();
  const [index, setIndex] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const step = steps[index];
  const value = values[step.key] || '';

  async function next() {
    if (!value.trim()) return;
    if (index < steps.length - 1) { setIndex(index + 1); return; }
    setGenerating(true); setError('');
    try {
      const profile = { user_id: user?.id, ...values, age: Number(values.age), height_cm: Number(values.height_cm), weight_kg: Number(values.weight_kg), workout_frequency: Number(values.workout_frequency), workout_duration_min: Number(values.workout_duration_min), gender: values.gender || null, disliked_exercises: values.disliked_exercises || null };
      const { error: saveError } = await (await import('@/lib/supabase')).supabase.from('user_profiles').upsert(profile, { onConflict: 'user_id' });
      if (saveError) throw saveError;
      await generatePlan(profile); await refreshProfile();
    } catch (e) { setError('Не удалось сохранить данные. Попробуй ещё раз.'); setGenerating(false); }
  }

  if (generating) return <main className="onboarding-screen plan-building"><div className="plan-orbit"><Sparkles size={32} /></div><span className="eyebrow">ТЕСА РАБОТАЕТ</span><h1>Составляю<br /><span className="gradient-text">твой план</span></h1><div className="build-list">{['Анализ данных','Цель и стратегия','Тренировки','Питание','График','Контроль прогресса'].map((item, i) => <div key={item} className="build-item" style={{ animationDelay: `${i * .35}s` }}><Check size={16} /><span>{item}</span></div>)}</div></main>;

  return <main className="onboarding-screen"><div className="onboarding-top"><span className="brand-mini"><Sparkles size={17} /> Теса</span><span>{index + 1} / {steps.length}</span></div><div className="progress-line"><div style={{ width: `${((index + 1) / steps.length) * 100}%` }} /></div><section className="onboarding-question"><span className="eyebrow">ЗНАКОМСТВО</span><h1>{step.title}</h1><p>Это поможет Тесе лучше подстроиться под тебя.</p><input autoFocus className="input-field onboarding-input" type={step.type} value={value} onChange={e => setValues({ ...values, [step.key]: e.target.value })} onKeyDown={e => e.key === 'Enter' && next()} placeholder={step.placeholder} /></section>{error && <div className="error-message">{error}</div>}<div className="onboarding-actions"><button className="btn-ghost" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0}><ArrowLeft size={18} /></button><button className="btn-primary" onClick={next} disabled={!value.trim()}>{index === steps.length - 1 ? 'Создать план' : 'Продолжить'} <ArrowRight size={18} /></button></div></main>;
}
