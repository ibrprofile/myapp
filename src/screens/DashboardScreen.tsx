import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import BodyOrb from '@/components/BodyOrb';
import { Dumbbell, Flame, Scale, Clock, Sparkles, Bell } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export default function DashboardScreen() {
  const { profile, user } = useAuth();
  const [todayWorkout, setTodayWorkout] = useState<any>(null);
  const [todayMeals, setTodayMeals] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const today = format(new Date(), 'yyyy-MM-dd');
      const startOfDay = `${today}T00:00:00`;
      const endOfDay = `${today}T23:59:59`;

      const [workouts, meals, notifs] = await Promise.all([
        supabase.from('workouts').select('*').eq('user_id', user!.id).eq('scheduled_date', today).maybeSingle(),
        supabase.from('meal_entries').select('*').eq('user_id', user!.id).gte('entry_time', startOfDay).lte('entry_time', endOfDay).order('entry_time', { ascending: false }),
        supabase.from('notifications').select('*').eq('user_id', user!.id).eq('is_read', false).order('created_at', { ascending: false }).limit(5),
      ]);

      setTodayWorkout(workouts.data);
      setTodayMeals(meals.data || []);
      setNotifications(notifs.data || []);
      setLoading(false);
    }
    load();
  }, [user]);

  const totalCalories = todayMeals.reduce((sum, m) => sum + (m.total_calories || 0), 0);
  const totalProtein = todayMeals.reduce((sum, m) => sum + (m.total_protein || 0), 0);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
  const firstName = profile?.name?.split(' ')[0] || '';

  return (
    <main className="dashboard">
      <header className="dash-header">
        <div className="dash-greeting">
          {greeting},<strong>{firstName ? ` ${firstName}` : ''}</strong>
        </div>
        <div style={{ position: 'relative' }}>
          <button style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '10px', color: 'var(--text-secondary)', display: 'flex' }}>
            <Bell size={20} />
          </button>
          {notifications.length > 0 && (
            <span style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
          )}
        </div>
      </header>

      <BodyOrb weight={profile?.weight_kg ?? null} />

      <div className="tesa-message">
        <div className="tesa-avatar"><Sparkles size={18} /></div>
        <p>
          {todayWorkout
            ? `Сегодня у тебя тренировка — ${todayWorkout.name || 'программа'}. Готов? Нажми «Начать» в разделе тренировок.`
            : 'Сегодня день отдыха. Можешь использовать его для восстановления или лёгкой активности.'}
          {totalCalories > 0 && ` Уже записано ${Math.round(totalCalories)} ккал сегодня.`}
        </p>
      </div>

      <section className="card">
        <span className="card-title">Что сегодня</span>
        <div className="today-item">
          <div className="today-item-icon"><Dumbbell size={18} /></div>
          <div className="today-item-text">
            <strong>{todayWorkout ? todayWorkout.name || 'Тренировка' : 'День отдыха'}</strong>
            <span>{todayWorkout?.scheduled_time ? `В ${todayWorkout.scheduled_time.slice(0, 5)}` : 'Восстановление'}</span>
          </div>
        </div>
        <div className="today-item">
          <div className="today-item-icon"><Flame size={18} /></div>
          <div className="today-item-text">
            <strong>{Math.round(totalCalories)} ккал</strong>
            <span>Питание сегодня · Б: {Math.round(totalProtein)} г</span>
          </div>
        </div>
        <div className="today-item">
          <div className="today-item-icon"><Scale size={18} /></div>
          <div className="today-item-text">
            <strong>{profile?.weight_kg ? `${profile.weight_kg} кг` : 'Не записан'}</strong>
            <span>Текущий вес</span>
          </div>
        </div>
      </section>

      {notifications.length > 0 && (
        <section className="card">
          <span className="card-title">Уведомления</span>
          {notifications.map((n) => (
            <div key={n.id} className="today-item">
              <div className="today-item-icon"><Bell size={18} /></div>
              <div className="today-item-text">
                <strong>{n.title}</strong>
                <span>{n.body}</span>
              </div>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
