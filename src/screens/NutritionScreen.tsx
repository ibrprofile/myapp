import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { callAIChat } from '@/lib/ai';
import { Plus, Flame, Send, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export default function NutritionScreen() {
  const { user } = useAuth();
  const [meals, setMeals] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadMeals(); }, [user]);

  async function loadMeals() {
    const today = format(new Date(), 'yyyy-MM-dd');
    const { data } = await supabase.from('meal_entries').select('*').eq('user_id', user!.id).gte('entry_time', `${today}T00:00:00`).lte('entry_time', `${today}T23:59:59`).order('entry_time', { ascending: false });
    setMeals(data || []);
  }

  async function addMeal() {
    if (!input.trim() || sending) return;
    setSending(true); setError('');
    try {
      await callAIChat(`Я поел: ${input}`);
      setInput('');
      await loadMeals();
    } catch (e: any) {
      setError(e.message || 'Не удалось обработать. Попробуй ещё раз.');
    }
    setSending(false);
  }

  const totalCalories = meals.reduce((s, m) => s + (m.total_calories || 0), 0);
  const totalProtein = meals.reduce((s, m) => s + (m.total_protein || 0), 0);
  const totalFat = meals.reduce((s, m) => s + (m.total_fat || 0), 0);
  const totalCarbs = meals.reduce((s, m) => s + (m.total_carbs || 0), 0);

  return (
    <main className="nutrition-screen">
      <header className="screen-header">
        <h1>Питание</h1>
        <p>Просто опиши, что съел</p>
      </header>

      <section className="card">
        <div className="calorie-ring">
          <div className="calorie-display">
            <strong>{Math.round(totalCalories)}</strong>
            <span>ккал сегодня</span>
          </div>
        </div>
        <div className="macro-grid">
          <div className="macro-card"><span>Белки</span><strong>{Math.round(totalProtein)}<small> г</small></strong></div>
          <div className="macro-card"><span>Жиры</span><strong>{Math.round(totalFat)}<small> г</small></strong></div>
          <div className="macro-card"><span>Углеводы</span><strong>{Math.round(totalCarbs)}<small> г</small></strong></div>
          <div className="macro-card"><span>Приёмов</span><strong>{meals.length}</strong></div>
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="input-field"
          style={{ flex: 1 }}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addMeal()}
          placeholder="Что ты съел? Напиши своими словами"
          disabled={sending}
        />
        <button className="chat-send-btn" onClick={addMeal} disabled={sending || !input.trim()}>
          {sending ? <Loader2 size={20} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {meals.length > 0 ? (
        <section>
          <span className="card-title" style={{ marginBottom: 12, display: 'block' }}>Сегодня</span>
          {meals.map(m => (
            <div key={m.id} className="meal-entry" style={{ marginBottom: 8 }}>
              <div className="meal-entry-header">
                <strong>{Math.round(m.total_calories || 0)} ккал</strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {m.is_estimate && <span className="estimate-badge">примерно</span>}
                  <span className="meal-entry-time">{format(new Date(m.entry_time), 'HH:mm')}</span>
                </div>
              </div>
              <p className="meal-entry-text">{m.raw_text}</p>
              <div className="meal-macros">
                <span>Б: {Math.round(m.total_protein || 0)} г</span>
                <span>Ж: {Math.round(m.total_fat || 0)} г</span>
                <span>У: {Math.round(m.total_carbs || 0)} г</span>
              </div>
            </div>
          ))}
        </section>
      ) : (
        <div className="empty-state">
          <Flame size={48} />
          <p>Пока ничего не записано.<br />Напиши выше, что ты съел.</p>
        </div>
      )}
    </main>
  );
}
