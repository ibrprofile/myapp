import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import AuthScreen from '@/screens/AuthScreen';
import OnboardingScreen from '@/screens/OnboardingScreen';
import DashboardScreen from '@/screens/DashboardScreen';
import WorkoutsScreen from '@/screens/WorkoutsScreen';
import NutritionScreen from '@/screens/NutritionScreen';
import ProgressScreen from '@/screens/ProgressScreen';
import ChatScreen from '@/screens/ChatScreen';
import ActiveWorkoutScreen from '@/screens/ActiveWorkoutScreen';
import BottomNav from '@/components/BottomNav';
import AdminScreen from '@/screens/AdminScreen';
import { Loader2 } from 'lucide-react';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }
  if (!profile?.onboarding_completed) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

export default function App() {
  const location = useLocation();
  const { user, profile } = useAuth();

  const showNav = user && profile?.onboarding_completed &&
    !['/auth', '/onboarding', '/workout/active'].includes(location.pathname);

  return (
    <div className="app-container">
      <Routes>
        <Route path="/auth" element={user ? <Navigate to={profile?.onboarding_completed ? '/' : '/onboarding'} replace /> : <AuthScreen />} />
        <Route path="/onboarding" element={<ProtectedRoute><OnboardingScreen /></ProtectedRoute>} />
        <Route path="/" element={<ProtectedRoute><OnboardingGate><DashboardScreen /></OnboardingGate></ProtectedRoute>} />
        <Route path="/workouts" element={<ProtectedRoute><OnboardingGate><WorkoutsScreen /></OnboardingGate></ProtectedRoute>} />
        <Route path="/nutrition" element={<ProtectedRoute><OnboardingGate><NutritionScreen /></OnboardingGate></ProtectedRoute>} />
        <Route path="/progress" element={<ProtectedRoute><OnboardingGate><ProgressScreen /></OnboardingGate></ProtectedRoute>} />
        <Route path="/chat" element={<ProtectedRoute><OnboardingGate><ChatScreen /></OnboardingGate></ProtectedRoute>} />
        <Route path="/workout/active" element={<ProtectedRoute><OnboardingGate><ActiveWorkoutScreen /></OnboardingGate></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><AdminScreen /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {showNav && <BottomNav />}
    </div>
  );
}
