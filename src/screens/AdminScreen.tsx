import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Users, Activity, Mail, Cpu, AlertCircle } from 'lucide-react';

export default function AdminScreen() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ users: 0, workouts: 0, meals: 0, emails: 0, jobs: 0, aiEvents: 0 });

  useEffect(() => {
    async function check() {
      const { data } = await supabase.from('admin_users').select('*').eq('user_id', user!.id).maybeSingle();
      setIsAdmin(!!data);
      if (data) {
        const [u, w, m, e, j, a] = await Promise.all([
          supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
          supabase.from('workouts').select('id', { count: 'exact', head: true }),
          supabase.from('meal_entries').select('id', { count: 'exact', head: true }),
          supabase.from('email_queue').select('id', { count: 'exact', head: true }).eq('status', 'queued'),
          supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'queued'),
          supabase.from('ai_events').select('id', { count: 'exact', head: true }),
        ]);
        setStats({ users: u.count || 0, workouts: w.count || 0, meals: m.count || 0, emails: e.count || 0, jobs: j.count || 0, aiEvents: a.count || 0 });
      }
      setLoading(false);
    }
    check();
  }, [user]);

  if (loading) return <main className="admin-screen"><div className="loading-center">Проверка доступа...</div></main>;

  if (!isAdmin) return (
    <main className="admin-screen">
      <div className="empty-state"><AlertCircle size={48} /><p>Доступ только для администраторов.</p></div>
    </main>
  );

  return (
    <main className="admin-screen">
      <header className="screen-header">
        <h1>Админ-панель</h1>
        <p>Системная статистика</p>
      </header>

      <div className="admin-stat"><div><span>Пользователей</span></div><strong>{stats.users}</strong></div>
      <div className="admin-stat"><div><span>Тренировок</span></div><strong>{stats.workouts}</strong></div>
      <div className="admin-stat"><div><span>Приёмов пищи</span></div><strong>{stats.meals}</strong></div>
      <div className="admin-stat"><div><span>AI-событий</span></div><strong>{stats.aiEvents}</strong></div>
      <div className="admin-stat"><div><span>Писем в очереди</span></div><strong>{stats.emails}</strong></div>
      <div className="admin-stat"><div><span>Задач в очереди</span></div><strong>{stats.jobs}</strong></div>

      <section className="card" style={{ marginTop: 12 }}>
        <span className="card-title">AI-модель</span>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Текущая: gpt-5-nano (задаётся через переменную окружения AI_MODEL)</p>
      </section>
    </main>
  );
}
