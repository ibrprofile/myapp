import { FormEvent, useState } from 'react';
import { ArrowRight, LockKeyhole, Mail, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import './screen.css';

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setBusy(true);
    const result = mode === 'login' ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);
    if (result.error) setError(result.error);
  }

  return <main className="auth-screen">
    <div className="auth-orb" />
    <div className="auth-brand"><div className="logo-mark"><Sparkles size={24} /></div><span>Теса</span></div>
    <section className="auth-card glass-strong">
      <span className="eyebrow">AI-КОМПАНЬОН</span>
      <h1>{mode === 'login' ? 'С возвращением' : 'Начнём знакомство'}</h1>
      <p className="muted">{mode === 'login' ? 'Твой персональный ритм уже ждёт тебя.' : 'Теса поможет превратить цели в привычки.'}</p>
      <form onSubmit={submit} className="form-stack">
        <label><span>Email</span><div className="field-icon"><Mail size={17} /><input className="input-field" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required /></div></label>
        <label><span>Пароль</span><div className="field-icon"><LockKeyhole size={17} /><input className="input-field" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Минимум 6 символов" minLength={6} required /></div></label>
        {error && <div className="error-message">{error}</div>}
        <button className="btn-primary" disabled={busy}>{busy ? 'Подожди...' : mode === 'login' ? 'Войти' : 'Создать аккаунт'} {!busy && <ArrowRight size={18} />}</button>
      </form>
      <button className="switch-auth" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}>{mode === 'login' ? 'Впервые здесь? Создать аккаунт' : 'Уже есть аккаунт? Войти'}</button>
    </section>
    <p className="auth-note">Твои данные принадлежат только тебе</p>
  </main>;
}
