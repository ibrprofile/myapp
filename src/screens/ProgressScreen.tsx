import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { callAIChat } from '@/lib/ai';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, BarChart, Bar, CartesianGrid } from 'recharts';
import { Plus, TrendingUp, Scale, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export default function ProgressScreen() {
  const { user } = useAuth();
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [meals, setMeals] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, [user]);

  async function load() {
    const [m, w, meals] = await Promise.all([
      supabase.from('body_measurements').select('*').eq('user_id', user!.id).order('measured_at', { ascending: true }).limit(30),
      supabase.from('workouts').select('*').eq('user_id', user!.id).eq('status', 'completed').order('completed_at', { ascending: true }).limit(15),
      supabase.from('meal_entries').select('*').eq('user_id', user!.id).order('entry_time', { ascending: true }).limit(30),
    ]);
    setMeasurements(m.data || []);
    setWorkouts(w.data || []);
    setMeals(meals.data || []);
  }

  async function addMeasurement() {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await callAIChat(input);
      setInput('');
      await load();
    } catch (e: any) {
      setError(e.message || 'Не удалось сохранить. Попробуй ещё раз.');
    }
    setSending(false);
  }

  const weightData = measurements.filter(m => m.weight_kg).map(m => ({
    date: format(new Date(m.measured_at), 'd MMM', { locale: ru }),
    weight: m.weight_kg,
  }));

  const volumeData = workouts.map(w => ({
    date: w.completed_at ? format(new Date(w.completed_at), 'd MMM', { locale: ru }) : '',
    volume: w.total_volume_kg || 0,
  }));

  const caloriesData = meals.map(m => ({
    date: format(new Date(m.entry_time), 'd MMM', { locale: ru }),
    calories: m.total_calories || 0,
  }));

  const latest = measurements[measurements.length - 1];

  return (
    <main className="progress-screen">
      <header className="screen-header">
        <h1>Прогресс</h1>
        <p>Твоя динамика</p>
      </header>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="input-field"
          style={{ flex: 1 }}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addMeasurement()}
          placeholder="Например: вес 78.4, талия 82"
          disabled={sending}
        />
        <button className="chat-send-btn" onClick={addMeasurement} disabled={sending || !input.trim()}>
          <Plus size={18} />
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {latest && (
        <section className="card">
          <span className="card-title">Текущие параметры</span>
          <div className="macro-grid">
            {latest.weight_kg && <div className="macro-card"><span>Вес</span><strong>{latest.weight_kg}<small> кг</small></strong></div>}
            {latest.waist_cm && <div className="macro-card"><span>Талия</span><strong>{latest.waist_cm}<small> см</small></strong></div>}
            {latest.chest_cm && <div className="macro-card"><span>Грудь</span><strong>{latest.chest_cm}<small> см</small></strong></div>}
            {latest.biceps_cm && <div className="macro-card"><span>Бицепс</span><strong>{latest.biceps_cm}<small> см</small></strong></div>}
            {latest.hips_cm && <div className="macro-card"><span>Бёдра</span><strong>{latest.hips_cm}<small> см</small></strong></div>}
            {latest.thigh_cm && <div className="macro-card"><span>Бедро</span><strong>{latest.thigh_cm}<small> см</small></strong></div>}
          </div>
        </section>
      )}

      {weightData.length > 1 && (
        <section className="chart-card">
          <h3><Scale size={16} style={{ display: 'inline', marginRight: 6 }} />Вес</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={weightData}>
              <XAxis dataKey="date" tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={['auto', 'auto']} tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
              <Tooltip contentStyle={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', borderRadius: 8, color: 'var(--text-primary)' }} />
              <Line type="monotone" dataKey="weight" stroke="var(--accent)" strokeWidth={2} dot={{ fill: 'var(--accent)', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}

      {volumeData.length > 0 && (
        <section className="chart-card">
          <h3><Activity size={16} style={{ display: 'inline', marginRight: 6 }} />Объём тренировок</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={volumeData}>
              <XAxis dataKey="date" tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
              <Tooltip contentStyle={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', borderRadius: 8, color: 'var(--text-primary)' }} />
              <Bar dataKey="volume" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {caloriesData.length > 1 && (
        <section className="chart-card">
          <h3><TrendingUp size={16} style={{ display: 'inline', marginRight: 6 }} />Калории</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={caloriesData}>
              <XAxis dataKey="date" tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
              <Tooltip contentStyle={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', borderRadius: 8, color: 'var(--text-primary)' }} />
              <Line type="monotone" dataKey="calories" stroke="var(--accent-secondary)" strokeWidth={2} dot={{ fill: 'var(--accent-secondary)', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}

      {weightData.length === 0 && volumeData.length === 0 && (
        <div className="empty-state">
          <TrendingUp size={48} />
          <p>Пока нет данных для графиков.<br />Запиши вес или заверши тренировку.</p>
        </div>
      )}
    </main>
  );
}
