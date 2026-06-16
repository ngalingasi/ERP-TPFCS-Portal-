import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router';
import { ErpAuthProvider } from './context/AuthContext';
import { ThemeProvider }   from './context/ThemeContext';
import { useErpAuth }      from './store/authStore';
import LoginPage     from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage   from './pages/ProfilePage';
import AdminPage     from './pages/AdminPage';
import MonitoringPage from './pages/MonitoringPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useErpAuth();
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function LoginRoute() {
  const { isAuthenticated } = useErpAuth();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <LoginPage />;
}

export default function App() {
  return (
    <ThemeProvider>
      <ErpAuthProvider>
        <Router>
          <Routes>
            <Route path="/"          element={<LoginRoute />} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/profile"   element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/admin"     element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
            <Route path="/monitoring" element={<ProtectedRoute><MonitoringPage /></ProtectedRoute>} />
            <Route path="*"          element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </ErpAuthProvider>
    </ThemeProvider>
  );
}
