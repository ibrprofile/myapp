import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Plus, Dumbbell, TrendingUp, Clock, Weight } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export default function WorkoutsScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [prs, setPrs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [w, p] = await Promise.all([
        supabase.from('workouts').select('*').eq('user_id', user!.id).order('scheduled_date', { ascending: false }).limit(20),
        supabase.from('personal_records').select('*').eq('user_id', user!.id).order('achieved_at', { ascending: false }).limit(5),
      ]);
      setWorkouts(w.data || []);
      setPrs(p.data || []);
      setLoading(false);
    }
    load();
  }, [user]);

  const today = format(new Date(), 'yyyy-MM-dd');
  const todayWorkout = workouts.find(w => w.scheduled_date === today);
  const upcoming = workouts.filter(w => w.status === 'planned' && w.scheduled_date !== today);
  const history = workouts.filter(w => w.status === 'completed');

  async function startWorkout() {
    let workoutId = todayWorkout?.id;
    if (!workoutId) {
      const { data } = await supabase.from('workouts').insert({
        user_id: user!.id,
        name: 'Свободная тренировка',
        status: 'active',
        scheduled_date: today,
        started_at: new Date().toISOString(),
      }).select().single();
      workoutId = data?.id;
    } else {
    await supabase.from('workouts').update({ status: 'active', started_at: new Date().toISOString() }).eq('id', workoutId);
    }
    navigate('/workout/active');
  }

  if (loading) return <main className="workouts-screen"><div className="loading-center">Загрузка...</div></main>;

  return (
    <main className="workouts-screen">
      <header className="screen-header">
        <h1>Тренировки</h1>
        <p>Твой план и история</p>
      </header>

      <button className="btn-primary" onClick={startWorkout}>
        <Dumbbell size={20} /> Начать тренировку
      </button>

      {todayWorkout && (
        <section>
          <span className="card-title" style={{ marginBottom: 12, display: 'block' }}>Сегодня</span>
          <div className="workout-card" onClick={startWorkout}>
            <div className="workout-card-header">
              <h3>{todayWorkout.name || 'Тренировка'}</h3>
              <span className={`workout-status status-${todayWorkout.status}`}>{todayWorkout.status === 'planned' ? 'Запланирована' : 'Активна'}</span>
            </div>
            {todayWorkout.scheduled_time && <div className="workout-meta"><span><Clock size={14} /> {todayWorkout.scheduled_time.slice(0, 5)}</span></div>}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section>
          <span className="card-title" style={{ marginBottom: 12, display: 'block' }}>Предстоящие</span>
          {upcoming.map(w => (
            <div key={w.id} className="workout-card" style={{ marginBottom: 8 }}>
              <div className="workout-card-header">
                <h3>{w.name || 'Тренировка'}</h3>
                <span className="workout-status status-planned">Запланирована</span>
              </div>
              <div className="workout-meta">
                <span><Clock size={14} /> {w.scheduled_date ? format(new Date(w.scheduled_date), 'd MMM', { locale: ru }) : ''}</span>
                {w.scheduled_time && <span>{w.scheduled_time.slice(0, 5)}</span>}
              </div>
            </div>
          ))}
        </section>
      )}

      {prs.length > 0 && (
        <section>
          <span className="card-title" style={{ marginBottom: 12, display: 'block' }}>Личные рекорды</span>
          {prs.map(pr => (
            <div key={pr.id} className="workout-card" style={{ marginBottom: 8 }}>
              <div className="workout-card-header">
                <h3>{pr.exercise_name}</h3>
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>{pr.value}{pr.unit ? ` ${pr.unit}` : ''}</span>
              </div>
              <div className="workout-meta">
                <span><TrendingUp size={14} /> {pr.record_type === 'max_weight' ? 'Макс. вес' : pr.record_type === 'max_reps' ? 'Макс. повторения' : 'Рекорд'}</span>
              </div>
            </div>
          ))}
        </section>
      )}

      {history.length > 0 && (
        <section>
          <span className="card-title" style={{ marginBottom: 12, display: 'block' }}>История</span>
          {history.map(w => (
            <div key={w.id} className="workout-card" style={{ marginBottom: 8 }}>
              <div className="workout-card-header">
                <h3>{w.name || 'Тренировка'}</h3>
                <span className="workout-status status-completed">Завершена</span>
              </div>
              <div className="workout-meta">
                <span><Clock size={14} /> {w.completed_at ? format(new Date(w.completed_at), 'd MMM', { locale: ru }) : ''}</span>
                {w.total_volume_kg != null && <span><Weight size={14} /> {Math.round(w.total_volume_kg)} кг</span>}
                {w.total_sets != null && <span>{w.total_sets} подходов</span>}
              </div>
              {w.ai_summary && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{w.ai_summary}</p>}
            </div>
          ))}
        </section>
      )}

      {workouts.length === 0 && (
        <div className="empty-state">
          <Dumbbell size={48} />
          <p>Пока нет тренировок.<br />Нажми «Начать тренировку».</p>
        </div>
      )}
    </main>
  );
}
