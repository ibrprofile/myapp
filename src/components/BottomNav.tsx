import { NavLink } from 'react-router-dom';
import { Home, Dumbbell, UtensilsCrossed, TrendingUp, MessageCircle } from 'lucide-react';
import '@/components/BottomNav.css';

export default function BottomNav() {
  const items = [
    { to: '/', icon: Home, label: 'Главная' },
    { to: '/workouts', icon: Dumbbell, label: 'Тренировки' },
    { to: '/nutrition', icon: UtensilsCrossed, label: 'Питание' },
    { to: '/progress', icon: TrendingUp, label: 'Прогресс' },
    { to: '/chat', icon: MessageCircle, label: 'Теса' },
  ];

  return (
    <nav className="bottom-nav">
      {items.map(({ to, icon: Icon, label }) => (
        <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Icon size={22} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
